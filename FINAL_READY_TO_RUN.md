# QuadraConverter — Final Ready-to-Run Build

This package is the finalized project tree based on the uploaded QuadraConverter project, with the signature runtime repairs and UI hardening applied.

## Important

There are two parts:

1. **Frontend** — Vite + React + TypeScript.
2. **Conversion API** — FastAPI/Python in `server/`.

The Supabase migrations under `supabase/migrations/` must be applied to the same Supabase project used by the frontend.

## Run on Windows

### 1. Frontend

```powershell
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:5173`.

### 2. Conversion API

```powershell
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn converter_api:app --host 0.0.0.0 --port 8000
```

Set:

```env
VITE_CONVERTER_API_URL=http://localhost:8000
```

### 3. Supabase

Run all SQL files in `supabase/migrations/` in timestamp order.

At minimum the signature runtime requires:

`20260823190000_signature_runtime_fix.sql`

This migration creates/repairs:

- signature requests
- signer records
- sequential/parallel enforcement
- token hashing
- audit events
- private signature storage bucket
- public signing-session RPCs
- request creation RPC

## Signature fixes included

### Signer Order

The Signer Order tool is now an actual workflow creator rather than a local setting only.

- Upload the PDF.
- Add at least two signer emails.
- Choose Sequential or Parallel.
- Run the tool.
- A real Supabase signing request is created.
- Sequential signing is enforced server-side.
- Signer links are generated immediately.

### Signature Templates

Run now creates:

- reusable `.qsignature.json` template
- PNG signature preview
- local saved setup

The template contains signer details, signature text, font, placement, signing order and version metadata.

### Request Signatures

The request flow:

1. uploads the PDF to the private signature bucket
2. creates signer records and secure tokens
3. creates an audit event
4. generates seven-day signed document links
5. exposes the public signer page
6. blocks sequential signers until the previous signer is complete
7. records signed events and cryptographic proof

### Signed File & Proof

The latest signed artifact is now persisted in IndexedDB.

That fixes the previous state-only behavior where changing tools/reloading could produce:

`There is no signed artifact ready to download. Run a signing tool first.`

If a signed artifact was already created on the same browser/device, the Download tool can recover it.

## Logo

The React `Logo.tsx` component was removed.

The application now uses the image asset:

`public/logo.svg`

Replace that file with your actual logo image/SVG without changing React code.

## Conversion speed

The conversion backend already uses native PDF extraction before OCR fallback. The browser does not add an artificial wait.

However, no arbitrary Office/PDF conversion can honestly be guaranteed to finish in exactly 2–5 seconds. OCR, scanned pages, large PDFs and cold LibreOffice processes can take longer.

For the fastest production setup:

- keep the API server warm
- deploy close to users
- use SSD storage
- install LibreOffice/qpdf/Ghostscript/Tesseract locally on the API host
- avoid OCR unless the PDF is actually scanned
- use native PDF extraction whenever possible

## Production environment

Set at least:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_CONVERTER_API_URL=https://YOUR-CONVERTER-API.example.com
CORS_ORIGINS=https://YOUR-FRONTEND.example.com
```

For real PKI/PAdES signing, configure:

```env
VITE_SIGNING_API_URL=https://YOUR-CONVERTER-API.example.com
QUADRA_SIGNING_KEY_FILE=
QUADRA_SIGNING_CERT_FILE=
QUADRA_SIGNING_CHAIN_FILE=
QUADRA_SIGNING_KEY_PASSPHRASE=
QUADRA_TSA_URL=
QUADRA_SIGNING_SUBJECT=QuadraConverter Production Signer
```

Without an accredited certificate/remote-signing provider, the browser ECDSA proof is tamper evidence and should not be presented as a government/CA-issued DSC.

## Optional email delivery

`supabase/functions/send-signature-request/index.ts` is available for Resend-based delivery.

Configure the Supabase function secrets described in the existing function README/comments before enabling production email delivery.

## Verification

After setup, test this sequence:

1. Sign up.
2. Sign in.
3. Open Signatures.
4. Create a typed signature.
5. Sign a PDF.
6. Download the signed PDF.
7. Switch to Signed File & Proof.
8. Run it again and confirm the persisted artifact downloads.
9. Open Verify Signature.
10. Upload the signed PDF and `.qsign.json`.
11. Create a Signer Order with two emails.
12. Open signer 1 link and sign.
13. Open signer 2 link and verify that sequential mode was blocked before signer 1 completed.
14. Complete signer 2 and inspect Audit Trail.
