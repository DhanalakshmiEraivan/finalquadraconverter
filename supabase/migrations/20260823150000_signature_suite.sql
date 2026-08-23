-- QuadraConverter Signature Suite
-- 16 premium tools + signing requests + cryptographic proof audit trail.

CREATE TABLE IF NOT EXISTS signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  signer_emails text[] NOT NULL DEFAULT '{}',
  signing_order text NOT NULL DEFAULT 'parallel' CHECK (signing_order IN ('parallel','sequential')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','completed','cancelled')),
  document_hash text,
  proof jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS signature_requests_owner ON signature_requests;
CREATE POLICY signature_requests_owner ON signature_requests
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR is_admin())
  WITH CHECK (auth.uid() = owner_id OR is_admin());

CREATE INDEX IF NOT EXISTS signature_requests_owner_idx ON signature_requests(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS signature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES signature_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  signer_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
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
    AND EXISTS (
      SELECT 1 FROM signature_requests r
      WHERE r.id = signature_events.request_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS signature_events_request_idx ON signature_events(request_id, created_at DESC);

-- Add a dedicated premium Signature Suite subscription.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='subscriptions'::regclass AND conname='subscriptions_plan_check') THEN
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_plan_check;
  END IF;
  ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
    CHECK (plan IN ('starter','pro','business','signature_suite'));
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_requests'::regclass AND conname='payment_requests_plan_check') THEN
    ALTER TABLE payment_requests DROP CONSTRAINT payment_requests_plan_check;
  END IF;
  ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_plan_check
    CHECK (plan IN ('starter','pro','business','signature_suite'));
END $$;

CREATE OR REPLACE FUNCTION approve_payment_request(payment_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  p payment_requests;
  exp timestamptz;
  expected numeric;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO p FROM payment_requests WHERE id=payment_request_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Payment request not found'; END IF;
  IF p.status='approved' THEN RETURN jsonb_build_object('ok',true,'status','approved'); END IF;
  IF p.utr IS NULL OR length(trim(p.utr))<6 THEN RAISE EXCEPTION 'A UTR/transaction ID is required'; END IF;

  expected := CASE p.plan
    WHEN 'starter' THEN 199
    WHEN 'pro' THEN 499
    WHEN 'business' THEN 1999
    WHEN 'signature_suite' THEN 299
    ELSE 0
  END;

  IF p.amount <> expected THEN RAISE EXCEPTION 'Payment amount does not match the plan'; END IF;

  UPDATE subscriptions SET status='expired',updated_at=now()
  WHERE user_id=p.user_id AND status='active';

  exp:=now()+interval '30 days';

  INSERT INTO subscriptions(user_id,plan,status,starts_at,expires_at,payment_request_id)
  VALUES(p.user_id,p.plan,'active',now(),exp,p.id);

  UPDATE payment_requests SET status='approved',verified_at=now(),verified_by=auth.uid()
  WHERE id=p.id;

  RETURN jsonb_build_object('ok',true,'status','approved','expires_at',exp);
END;
$$;

GRANT EXECUTE ON FUNCTION approve_payment_request(uuid) TO authenticated;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE INDEX IF NOT EXISTS signature_signers_request_idx ON signature_signers(request_id, signer_order);
CREATE INDEX IF NOT EXISTS signature_signers_token_idx ON signature_signers(token_hash);

CREATE OR REPLACE FUNCTION get_public_signing_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s signature_signers; r signature_requests;
BEGIN
  SELECT * INTO s FROM signature_signers WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') AND token_expires_at > now();
  IF s.id IS NULL THEN RETURN jsonb_build_object('valid',false,'message','Signing link is invalid or expired.'); END IF;
  SELECT * INTO r FROM signature_requests WHERE id=s.request_id;
  RETURN jsonb_build_object(
    'valid',true,'request_id',r.id,'document_name',r.document_name,'signer_id',s.id,
    'signer_email',s.email,'signer_order',s.signer_order,'status',s.status,'expires_at',s.token_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION complete_public_signing_session(p_token text, p_proof jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s signature_signers; r signature_requests;
BEGIN
  SELECT * INTO s FROM signature_signers WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') AND token_expires_at > now() FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Signing link is invalid or expired'; END IF;
  UPDATE signature_signers SET status='signed', signed_at=now(), proof=p_proof WHERE id=s.id;
  UPDATE signature_requests SET updated_at=now(), status='completed' WHERE id=s.request_id
    AND NOT EXISTS (SELECT 1 FROM signature_signers x WHERE x.request_id=s.request_id AND x.status <> 'signed');
  RETURN jsonb_build_object('ok',true,'signed_at',now());
END;
$$;

REVOKE ALL ON FUNCTION get_public_signing_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_signing_session(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION complete_public_signing_session(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_public_signing_session(text,jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION reject_payment_request(payment_request_id uuid, reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  UPDATE payment_requests
  SET status='rejected', verified_at=now(), verified_by=auth.uid(), admin_note=COALESCE(reason, admin_note)
  WHERE id=payment_request_id AND status IN('pending','submitted');
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment request not found or already processed'; END IF;
  RETURN jsonb_build_object('ok',true,'status','rejected');
END;
$$;
GRANT EXECUTE ON FUNCTION reject_payment_request(uuid, text) TO authenticated;
