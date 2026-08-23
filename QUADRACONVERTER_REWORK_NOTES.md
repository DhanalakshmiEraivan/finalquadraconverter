# QuadraConverter UI + Signature Runtime Rework

## What was hardened

- Reworked the global visual system around a light `#f5f7fb` surface with deep navy/black `#040720` and a restrained royal-blue scale.
- Removed the nested viewport-height behavior that was causing an extra full-screen section and large blank space before the footer on the Tools page.
- Hardened the shared app shell so route content cannot force a second viewport through nested minimum heights.
- Standardized Auth and Reset Password surfaces with the new light background.
- Added safer signature-tool switching so stale output, verification results, request links, and hashes do not leak between tools.
- Prevented switching signature tools while a signing operation is running.
- Fixed signature preview object-URL lifecycle to prevent repeated blob URL leaks.
- Hardened signature-image upload validation and file-size limits.
- Preserved the uploaded signature image MIME type when downloading it instead of always labelling it as PNG.
- Made signature data URL parsing fail clearly for malformed/empty data.
- Hardened the ECDSA integrity proof flow by signing the exact document-hash bytes directly.
- Improved PDF page-count reset behavior when replacing an input file.
- Added an explicit already-signed state to public signing links instead of allowing the user to enter a form that the database would later reject.
- Added timeout and clearer network/CORS errors to public signing API calls.
- Added validation for public signing image uploads.
- Kept the existing tool dispatch coverage intact: all discovered tool engines still have dispatch cases and all referenced converter functions are exported.

## Validation performed

- Tool audit: 91 tools, 91 unique IDs, 87 engines, 0 missing dispatch cases, 0 missing converter exports.
- Local import-path audit: no missing local TypeScript/TSX imports found.
- Python signing/converter server syntax check: passed with `python3 -m py_compile server/converter_api.py`.
- Full TypeScript build/typecheck could not be executed in this environment because the uploaded ZIP does not contain a usable dependency installation and package installation cannot complete without external package access. The source itself was checked for syntax-level issues with the available TypeScript compiler.

## Important upload note

The uploaded ZIP did **not** contain a `.env` file or a populated `node_modules` directory. They therefore were not removed or overwritten by this rework. Use your original local `.env` and dependency installation when running the project.
