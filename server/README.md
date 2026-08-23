# QuadraConverter Conversion Server

This server provides the reliable, layout-sensitive conversions that should not be attempted with browser-only libraries.

## Supported server conversions

- DOC/DOCX → PDF
- PPT/PPTX → PDF
- XLS/XLSX → PDF
- PDF → DOCX (editable text/images where extractable)
- PDF → PPTX (page-preserving slides)
- PDF → XLSX (table/text reconstruction)
- HTML → PDF
- PDF unlock/protect/PDF-A

LibreOffice is used for Office → PDF rendering. PyMuPDF, pdfplumber, python-docx, openpyxl and python-pptx are used for PDF → Office extraction/building.

## Run locally

1. Install Python 3.11+ and LibreOffice.
2. From the project root run `pip install -r server/requirements.txt`.
3. Start with `uvicorn server.converter_api:app --host 0.0.0.0 --port 8000`.
4. Set `VITE_CONVERTER_API_URL=http://localhost:8000` in the frontend `.env`.

## Docker

The included Dockerfile installs LibreOffice, qpdf and Ghostscript automatically.

## Important PDF conversion note

PDF is a fixed-layout format, so arbitrary PDF → editable Office conversion cannot be mathematically identical for every document. QuadraConverter now extracts text blocks, images and tables instead of converting the PDF into a single screenshot or simply changing the extension. Scanned PDFs still require OCR for best editable-text results.

## Cryptographic PDF signing

The API also exposes `POST /sign-pdf`. It embeds a PDF digital signature using pyHanko and an X.509 certificate/private key.

For development, if `QUADRA_SIGNING_KEY_FILE` and `QUADRA_SIGNING_CERT_FILE` are empty, the server creates a self-signed RSA certificate automatically. This is cryptographically valid but will not be trusted by Adobe Acrobat until the certificate is trusted.

For production, configure:

```env
QUADRA_SIGNING_KEY_FILE=/secure/signer-key.pem
QUADRA_SIGNING_CERT_FILE=/secure/signer-cert.pem
QUADRA_SIGNING_CHAIN_FILE=/secure/issuer-chain.pem
QUADRA_SIGNING_KEY_PASSPHRASE=your-secret
QUADRA_TSA_URL=https://your-rfc3161-tsa.example/tsa
```

Keep the private key on the server or in an HSM/remote signing service. Never expose it through Vite or a `VITE_*` variable.
