# QuadraConverter — Fixed Run Guide

## What was fixed

- Restored the complete `ToolWorkspace` conversion dispatcher. Every tool engine declared in `src/data/tools.ts` now has a real dispatch case.
- Fixed the "conversion completed but no result is shown" path by validating every returned Blob and filename before displaying the result.
- Fixed multi-result conversions such as PDF-to-images and PDF splitting.
- Fixed server-backed PDF/Office conversions so the frontend uses the FastAPI conversion service.
- Added clear authentication handling before consuming conversion credits.
- Made free-credit reservation atomic and tied every free reservation to a unique reservation ID.
- Secured refunds so a user cannot repeatedly call a public refund RPC to manufacture credits.
- Failed conversions refund exactly the reservation that was consumed.
- Kept successful conversions charged exactly once.
- Removed exposed Resend API secrets from the project environment examples.
- Kept the existing Supabase pricing: Starter ₹199, Pro ₹499, Business ₹1999.

## Frontend

From the project root:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

The Vite app normally runs at `http://localhost:5173`.

Set `VITE_CONVERTER_API_URL` in `.env` to the URL of the FastAPI server. For local development:

```env
VITE_CONVERTER_API_URL=http://localhost:8000
```

## Conversion server

### Local Python

Install Python 3.11+ and the packages in `server/requirements.txt`.

The server also needs these system programs for the full conversion set:

- LibreOffice
- qpdf
- Ghostscript
- Tesseract OCR

Start it with:

```bash
uvicorn server.converter_api:app --host 0.0.0.0 --port 8000
```

Then check:

```text
http://localhost:8000/health
```

### Docker

The included `server/Dockerfile` installs LibreOffice, qpdf, Ghostscript and Tesseract automatically:

```bash
docker build -t quadraconverter-api ./server
docker run --rm -p 8000:10000 -e CORS_ORIGINS=http://localhost:5173 quadraconverter-api
```

## Supabase

Run the migrations in this order:

1. `supabase/migrations/20260803083942_create_profiles_and_conversions.sql`
2. `supabase/migrations/20260815180000_fix_usage_and_upi_payments.sql`

The second migration creates the secure conversion reservation mechanism used by the frontend.

## Environment

Copy `.env.example` to `.env` and fill in your real values.

Never commit a real `RESEND_API_KEY` to Git or ship it in frontend source code.

## Important

Browser-only tools do not require the FastAPI server. Office/PDF conversions that depend on LibreOffice, qpdf, Ghostscript or the server extraction pipeline do.

For production, point `VITE_CONVERTER_API_URL` to your deployed FastAPI service and set `CORS_ORIGINS` there to your actual frontend origin(s).
