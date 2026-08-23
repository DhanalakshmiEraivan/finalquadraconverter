# QuadraConverter — Production Hardening Build

This build focuses on the requested production fixes: signatures, daily-credit metering, UPI proof, mobile previews, image-to-PDF, layout, and deployment safety.

## Signature suite — 16 tools, no separate package

All 16 signature tools are available from the same Signature page and use the same **5 free conversion credits per day** as every other tool.

The tools are:

1. Create Signature
2. Typed Signature
3. Draw Signature
4. Initials
5. Upload Signature
6. Sign PDF
7. Sign Image
8. Precision Placement
9. Multi-page Sign
10. Request Signatures
11. Signer Order
12. Signature Templates
13. Verify Signature
14. Document Hash
15. Audit Trail
16. Signed File & Proof

A successful action reserves one credit. If a processing operation fails, the reserved credit is automatically refunded.

### Cryptographic signing model

The PDF workflow now has two layers:

- visible signature placement in the PDF;
- SHA-256 hashing and ECDSA P-256 integrity proof in the browser;
- optional server-side PAdES signing using an X.509 certificate and private key;
- optional RFC 3161 timestamping when `QUADRA_TSA_URL` is configured.

The included server can generate a self-signed certificate for a ready-to-run development environment. A self-signed certificate is **not** automatically trusted by Adobe Acrobat. For production trust, configure a CA-issued certificate/private key and certificate chain.

## Signing API

Start the conversion/signing server:

```bash
pip install -r server/requirements.txt
uvicorn server.converter_api:app --host 0.0.0.0 --port 8000
```

Frontend `.env`:

```env
VITE_CONVERTER_API_URL=http://localhost:8000
VITE_SIGNING_API_URL=http://localhost:8000
```

For a trusted production signer:

```env
QUADRA_SIGNING_KEY_FILE=/secure/path/signer-key.pem
QUADRA_SIGNING_CERT_FILE=/secure/path/signer-cert.pem
QUADRA_SIGNING_CHAIN_FILE=/secure/path/issuer-chain.pem
QUADRA_SIGNING_KEY_PASSPHRASE=your-secret
QUADRA_TSA_URL=https://your-rfc3161-tsa.example/tsa
```

Never put the private signing key in the React/Vite frontend.

## UPI payment proof

Paid plans still use QR + UTR verification, but **a payment screenshot is now mandatory**.

The frontend:

1. validates the screenshot type and size;
2. uploads it to the private `payment-screenshots` bucket;
3. stores the private storage path with the UTR;
4. submits the payment request;
5. allows the admin to open the screenshot through a short-lived signed URL;
6. prevents the database approval RPC from approving a request without a screenshot.

## Mobile PDF preview

PDF live previews no longer depend on a remote PDF.js worker CDN. The preview renders through a local bundled PDF.js worker and a canvas-based viewer with page controls, which is much more reliable on Android browsers and WebViews.

## Image → PDF

`Image to PDF` now accepts multiple JPG/PNG/WebP files. Each source image becomes a separate PDF page, with the image scaled proportionally into the A4 page without changing its source pixels.

## Layout / blank space

The application now uses a dedicated flex shell so the footer is anchored naturally at the end of the document rather than leaving an artificial viewport-sized region underneath it. This applies globally to the landing page, dashboard, tools, pricing, signatures, and informational pages.

## Supabase migration

Run the new migration after the existing migrations:

`supabase/migrations/20260823170000_production_hardening.sql`

It adds:

- `signature-files` private storage;
- signing-request token generation;
- sequential signer enforcement;
- payment screenshot storage;
- admin screenshot access policy;
- mandatory screenshot validation during payment approval.

## Build checks

The tool audit currently reports:

- 91 tools
- 91 unique IDs
- 87 engines
- 0 missing dispatch cases
- 0 missing converter exports

The local environment used to prepare this archive did not contain a complete npm dependency installation, so a full production `npm run build` should be run after `npm install` in the target deployment environment.
