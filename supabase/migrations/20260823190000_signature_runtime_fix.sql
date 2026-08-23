-- QuadraConverter signature runtime repair
-- Run this migration in Supabase SQL Editor after the existing migrations.
-- It is intentionally idempotent so it can be safely re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Core tables (safe if the earlier signature migration was not applied yet)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_path text,
  signer_emails text[] NOT NULL DEFAULT '{}',
  signing_order text NOT NULL DEFAULT 'sequential' CHECK (signing_order IN ('parallel','sequential')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','completed','cancelled')),
  document_hash text,
  proof jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS document_path text;
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE TABLE IF NOT EXISTS signature_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES signature_requests(id) ON DELETE CASCADE,
  email text NOT NULL,
  signer_order integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','opened','signed','declined')),
  token_hash text NOT NULL UNIQUE,
  token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  signed_at timestamptz,
  proof jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES signature_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  signer_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Storage bucket: this fixes "Bucket not found".
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('signature-files', 'signature-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS signature_files_insert_own ON storage.objects;
CREATE POLICY signature_files_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'signature-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS signature_files_select_own ON storage.objects;
CREATE POLICY signature_files_select_own
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'signature-files'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin())
);

DROP POLICY IF EXISTS signature_files_delete_own ON storage.objects;
CREATE POLICY signature_files_delete_own
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'signature-files'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin())
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS signature_requests_owner ON signature_requests;
CREATE POLICY signature_requests_owner ON signature_requests
FOR ALL TO authenticated
USING (auth.uid() = owner_id OR is_admin())
WITH CHECK (auth.uid() = owner_id OR is_admin());

ALTER TABLE signature_signers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS signature_signers_owner ON signature_signers;
CREATE POLICY signature_signers_owner ON signature_signers
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM signature_requests r WHERE r.id = signature_signers.request_id AND (r.owner_id = auth.uid() OR is_admin()))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM signature_requests r WHERE r.id = signature_signers.request_id AND (r.owner_id = auth.uid() OR is_admin()))
);

ALTER TABLE signature_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS signature_events_owner_read ON signature_events;
CREATE POLICY signature_events_owner_read ON signature_events
FOR SELECT TO authenticated
USING (
  actor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM signature_requests r
    WHERE r.id = signature_events.request_id
      AND (r.owner_id = auth.uid() OR is_admin())
  )
);

DROP POLICY IF EXISTS signature_events_owner_insert ON signature_events;
CREATE POLICY signature_events_owner_insert ON signature_events
FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND EXISTS (SELECT 1 FROM signature_requests r WHERE r.id = signature_events.request_id AND r.owner_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS signature_requests_owner_idx ON signature_requests(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS signature_signers_request_idx ON signature_signers(request_id, signer_order);
CREATE INDEX IF NOT EXISTS signature_signers_token_idx ON signature_signers(token_hash);
CREATE INDEX IF NOT EXISTS signature_events_request_idx ON signature_events(request_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Request creation: deterministic order and token return only at creation time.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_signature_request(
  p_document_name text,
  p_document_path text,
  p_signer_emails text[],
  p_signing_order text DEFAULT 'sequential'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public AS $$
DECLARE
  request_id uuid;
  email text;
  token text;
  signer_json jsonb := '[]'::jsonb;
  position_no integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_signing_order NOT IN ('parallel','sequential') THEN RAISE EXCEPTION 'Invalid signing order'; END IF;
  IF nullif(trim(p_document_name), '') IS NULL THEN RAISE EXCEPTION 'Document name is required'; END IF;
  IF p_signer_emails IS NULL OR cardinality(p_signer_emails) = 0 THEN RAISE EXCEPTION 'At least one signer is required'; END IF;

  INSERT INTO signature_requests(owner_id, document_name, document_path, signer_emails, signing_order, status)
  VALUES(auth.uid(), trim(p_document_name), p_document_path, p_signer_emails, p_signing_order, 'sent')
  RETURNING id INTO request_id;

  FOREACH email IN ARRAY p_signer_emails LOOP
    IF nullif(trim(email), '') IS NULL THEN CONTINUE; END IF;
    position_no := position_no + 1;
    token := rtrim(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=');
    INSERT INTO signature_signers(request_id, email, signer_order, token_hash)
    VALUES(request_id, trim(email), position_no, encode(digest(token, 'sha256'), 'hex'));
    signer_json := signer_json || jsonb_build_array(jsonb_build_object('email', trim(email), 'order', position_no, 'token', token));
  END LOOP;

  IF position_no = 0 THEN RAISE EXCEPTION 'At least one valid signer email is required'; END IF;

  INSERT INTO signature_events(request_id, actor_id, event_type, metadata)
  VALUES(request_id, auth.uid(), 'request_created', jsonb_build_object('signer_count', position_no, 'signing_order', p_signing_order));

  RETURN jsonb_build_object('request_id', request_id, 'signers', signer_json);
END;
$$;

REVOKE ALL ON FUNCTION create_signature_request(text,text,text[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_signature_request(text,text,text[],text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Public session: do not let signer #2 open/complete a sequential request early.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_public_signing_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public AS $$
DECLARE
  s signature_signers;
  r signature_requests;
  earlier_pending integer := 0;
BEGIN
  SELECT * INTO s
  FROM signature_signers
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND token_expires_at > now();

  IF s.id IS NULL THEN
    RETURN jsonb_build_object('valid',false,'message','Signing link is invalid or expired.');
  END IF;

  SELECT * INTO r FROM signature_requests WHERE id=s.request_id;

  IF s.status = 'signed' THEN
    RETURN jsonb_build_object('valid',true,'can_sign',false,'already_signed',true,
      'message','This signer has already completed the signing step.',
      'request_id',r.id,'document_name',r.document_name,'signer_id',s.id,
      'signer_email',s.email,'signer_order',s.signer_order,'status',s.status,'expires_at',s.token_expires_at);
  END IF;

  IF r.signing_order = 'sequential' THEN
    SELECT count(*) INTO earlier_pending
    FROM signature_signers x
    WHERE x.request_id=s.request_id
      AND x.signer_order < s.signer_order
      AND x.status <> 'signed';
  END IF;

  IF earlier_pending > 0 THEN
    RETURN jsonb_build_object(
      'valid',true,'can_sign',false,'waiting',true,
      'message',format('Waiting for signer %s to complete the document first.', s.signer_order - 1),
      'request_id',r.id,'document_name',r.document_name,'signer_id',s.id,
      'signer_email',s.email,'signer_order',s.signer_order,'status',s.status,'expires_at',s.token_expires_at
    );
  END IF;

  UPDATE signature_signers SET status='opened' WHERE id=s.id AND status='pending';

  INSERT INTO signature_events(request_id, actor_id, event_type, signer_email, metadata)
  VALUES(s.request_id, NULL, 'public_signer_opened', s.email, jsonb_build_object('signer_order', s.signer_order));

  RETURN jsonb_build_object(
    'valid',true,'can_sign',true,'waiting',false,
    'request_id',r.id,'document_name',r.document_name,'signer_id',s.id,
    'signer_email',s.email,'signer_order',s.signer_order,'status','opened','expires_at',s.token_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION complete_public_signing_session(p_token text, p_proof jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public AS $$
DECLARE
  s signature_signers;
  r signature_requests;
  earlier_pending integer := 0;
  remaining integer := 0;
BEGIN
  SELECT * INTO s
  FROM signature_signers
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND token_expires_at > now()
  FOR UPDATE;

  IF s.id IS NULL THEN RAISE EXCEPTION 'Signing link is invalid or expired'; END IF;
  IF s.status = 'signed' THEN RAISE EXCEPTION 'This signer has already completed the signing step'; END IF;

  SELECT * INTO r FROM signature_requests WHERE id=s.request_id FOR UPDATE;

  IF r.signing_order = 'sequential' THEN
    SELECT count(*) INTO earlier_pending
    FROM signature_signers x
    WHERE x.request_id=s.request_id
      AND x.signer_order < s.signer_order
      AND x.status <> 'signed';
    IF earlier_pending > 0 THEN RAISE EXCEPTION 'The previous signer must complete the request first'; END IF;
  END IF;

  UPDATE signature_signers
  SET status='signed', signed_at=now(), proof=p_proof
  WHERE id=s.id;

  INSERT INTO signature_events(request_id, actor_id, event_type, signer_email, metadata)
  VALUES(s.request_id, NULL, 'public_signer_signed', s.email,
    jsonb_build_object('signer_id', s.id, 'signer_order', s.signer_order, 'proof_hash', p_proof->>'documentHash'));

  SELECT count(*) INTO remaining
  FROM signature_signers x
  WHERE x.request_id=s.request_id AND x.status <> 'signed';

  UPDATE signature_requests
  SET updated_at=now(), completed_at=CASE WHEN remaining=0 THEN now() ELSE completed_at END,
      status=CASE WHEN remaining=0 THEN 'completed' ELSE 'sent' END
  WHERE id=s.request_id;

  RETURN jsonb_build_object('ok',true,'signed_at',now(),'request_id',s.request_id,'remaining_signers',remaining);
END;
$$;

REVOKE ALL ON FUNCTION get_public_signing_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_signing_session(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION complete_public_signing_session(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_public_signing_session(text,jsonb) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Remove the obsolete paid Signature Suite option from database plan constraints.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='subscriptions'::regclass AND conname='subscriptions_plan_check') THEN
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_plan_check;
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
      CHECK (plan IN ('starter','pro','business'));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_requests'::regclass AND conname='payment_requests_plan_check') THEN
    ALTER TABLE payment_requests DROP CONSTRAINT payment_requests_plan_check;
    ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_plan_check
      CHECK (plan IN ('starter','pro','business'));
  END IF;
END $$;
