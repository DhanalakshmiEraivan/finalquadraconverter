# QuadraConverter Signature Runtime Fix — v6

## 1. Supabase — mandatory

Open **Supabase Dashboard → SQL Editor** and run:

`supabase/migrations/20260823190000_signature_runtime_fix.sql`

This fixes the `Bucket not found` error by creating the private `signature-files` bucket and its RLS policies. It also repairs the signature request functions and makes sequential signing order database-enforced.

Do this on the same Supabase project used by QuadraConverter.

## 2. Frontend environment — mandatory for real PKI signing

In the frontend production environment, set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_SIGNING_API_URL=https://YOUR_PUBLIC_SIGNING_API_DOMAIN
```

Do **not** use `http://localhost:8000` in the deployed frontend.

For local development:

```env
VITE_SIGNING_API_URL=http://localhost:8000
```

For a deployed site such as `https://quadraconverter.in`, the signing API must be an externally reachable HTTPS address, for example:

```env
VITE_SIGNING_API_URL=https://api.quadraconverter.in
```

The actual domain is yours; the example above is only a naming example.

## 3. FastAPI signing server

Set these variables on the **server**, not in React:

```env
CORS_ORIGINS=https://quadraconverter.in,https://www.quadraconverter.in
QUADRA_SIGNING_KEY_FILE=/secure/signer-key.pem
QUADRA_SIGNING_CERT_FILE=/secure/signer-cert.pem
QUADRA_SIGNING_CHAIN_FILE=/secure/issuer-chain.pem
QUADRA_SIGNING_KEY_PASSPHRASE=YOUR_SECRET
QUADRA_TSA_URL=https://YOUR-RFC3161-TSA-ENDPOINT
```

The API now exposes:

`GET /health`

A healthy response reports whether PKI and TSA material are configured.

## 4. Signature Templates

`src/pages/SignaturesPage.tsx` now contains built-in templates instead of requiring a saved local template first.

The user selects a template, enters their name/initials/signature text, and then runs the signing tool. Custom setups can optionally be saved to the device.

The old **“No saved template found on this device”** first-run problem is removed.

## 5. Signer order

`get_public_signing_session()` now blocks a later signer until all earlier signers are actually signed when the request is sequential.

The public signing page polls every 10 seconds, so a waiting signer does not have to manually refresh the page.

The signer must also:

- provide their full name;
- use a typed, drawn, or uploaded signature;
- confirm signing consent;
- then submit the signing action.

## 6. Precision Placement / Sign PDF

The frontend no longer silently points a production browser at localhost. If the signing API is configured, it performs a real HTTPS request to:

`POST /sign-pdf`

If the browser cannot reach the API, the UI now reports the actual deployment/configuration problem instead of the generic `Failed to fetch` message.

## 7. Signed File & Proof

The signed output is produced by the signing tool and remains available in the current signing session for:

- preview;
- download;
- proof download;
- native share;
- verification.

If signing fails, the credit reservation is refunded.

## 8. Payment

UPI checkout already requires both:

- UTR / transaction ID;
- payment screenshot.

The screenshot is uploaded to the private `payment-screenshots` bucket and is required by the approval RPC.

## 9. Signature Suite pricing

No separate Signature Suite is required. Signature tools use the same daily conversion-credit system.

The runtime fix migration also removes the obsolete `signature_suite` plan from the subscription/payment plan constraints.
