-- QuadraConverter production hardening
-- 1) Signatures use the same 5 daily conversion credits as every other tool.
-- 2) Signature requests can create expiring signer tokens.
-- 3) Payment approval requires a payment screenshot as well as a UTR.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Signature document storage
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('signature-files', 'signature-files', false)
ON CONFLICT (id) DO NOTHING;

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
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS signature_files_delete_own ON storage.objects;
CREATE POLICY signature_files_delete_own
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'signature-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS document_path text;
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- -----------------------------------------------------------------------------
-- Create a request + signer tokens atomically.
-- The raw token is returned only at creation time; only its SHA-256 hash is kept.
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
  IF p_document_name IS NULL OR trim(p_document_name) = '' THEN RAISE EXCEPTION 'Document name is required'; END IF;
  IF p_signer_emails IS NULL OR cardinality(p_signer_emails) = 0 THEN RAISE EXCEPTION 'At least one signer is required'; END IF;

  INSERT INTO signature_requests(owner_id, document_name, document_path, signer_emails, signing_order, status)
  VALUES(auth.uid(), p_document_name, p_document_path, p_signer_emails, p_signing_order, 'sent')
  RETURNING id INTO request_id;

  FOREACH email IN ARRAY p_signer_emails LOOP
    position_no := position_no + 1;
    token := rtrim(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=');
    INSERT INTO signature_signers(request_id, email, signer_order, token_hash)
    VALUES(request_id, trim(email), position_no, encode(digest(token, 'sha256'), 'hex'));
    signer_json := signer_json || jsonb_build_array(jsonb_build_object('email', trim(email), 'order', position_no, 'token', token));
  END LOOP;

  INSERT INTO signature_events(request_id, actor_id, event_type, metadata)
  VALUES(request_id, auth.uid(), 'request_created', jsonb_build_object('signer_count', cardinality(p_signer_emails), 'signing_order', p_signing_order));

  RETURN jsonb_build_object('request_id', request_id, 'signers', signer_json);
END;
$$;

REVOKE ALL ON FUNCTION create_signature_request(text,text,text[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_signature_request(text,text,text[],text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Public signing session: enforce sequential order.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_public_signing_session(p_token text, p_proof jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public AS $$
DECLARE
  s signature_signers;
  r signature_requests;
  earlier_pending integer;
BEGIN
  SELECT * INTO s
  FROM signature_signers
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND token_expires_at > now()
  FOR UPDATE;

  IF s.id IS NULL THEN RAISE EXCEPTION 'Signing link is invalid or expired'; END IF;
  SELECT * INTO r FROM signature_requests WHERE id=s.request_id FOR UPDATE;

  IF r.signing_order = 'sequential' THEN
    SELECT count(*) INTO earlier_pending
    FROM signature_signers x
    WHERE x.request_id = s.request_id
      AND x.signer_order < s.signer_order
      AND x.status <> 'signed';
    IF earlier_pending > 0 THEN RAISE EXCEPTION 'The previous signer must complete the request first'; END IF;
  END IF;

  UPDATE signature_signers SET status='signed', signed_at=now(), proof=p_proof WHERE id=s.id;
  INSERT INTO signature_events(request_id, actor_id, event_type, signer_email, metadata)
  VALUES(s.request_id, NULL, 'public_signer_signed', s.email, jsonb_build_object('signer_id', s.id, 'proof_hash', p_proof->>'documentHash'));
  UPDATE signature_requests SET updated_at=now(), completed_at=now(), status='completed'
  WHERE id=s.request_id
    AND NOT EXISTS (SELECT 1 FROM signature_signers x WHERE x.request_id=s.request_id AND x.status <> 'signed');

  RETURN jsonb_build_object('ok',true,'signed_at',now(),'request_id',s.request_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- Payment screenshot is mandatory for new submissions and approvals.
-- -----------------------------------------------------------------------------
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS payment_screenshot_path text;
CREATE INDEX IF NOT EXISTS payment_requests_screenshot_idx ON payment_requests(payment_screenshot_path);

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-screenshots', 'payment-screenshots', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS payment_screenshots_insert_own ON storage.objects;
CREATE POLICY payment_screenshots_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS payment_screenshots_select_own ON storage.objects;
CREATE POLICY payment_screenshots_select_own
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin())
);

DROP POLICY IF EXISTS payment_screenshots_delete_own ON storage.objects;
CREATE POLICY payment_screenshots_delete_own
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin())
);

CREATE OR REPLACE FUNCTION approve_payment_request(payment_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public AS $$
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
  IF p.payment_screenshot_path IS NULL OR trim(p.payment_screenshot_path) = '' THEN RAISE EXCEPTION 'Payment screenshot is required before approval'; END IF;

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
