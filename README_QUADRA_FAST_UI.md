# QuadraConverter Fast UI + Conversion Upgrade

This build keeps the existing Supabase/auth/payment/backend integrations intact and upgrades the experience around them.

## Included
- Premium light + dark-ink-blue visual system.
- Category command bar directly below the navbar.
- Hover mega-menu showing every tool in the selected category.
- One-click navigation from any menu item directly to its tool workspace.
- Responsive mobile category navigation.
- Premium conversion progress animation with smooth visual progress.
- Faster PDF → Excel backend path using native table/text extraction first and OCR only as a fallback.
- Existing PDF → Word / PDF → PowerPoint native extraction paths retained.
- LibreOffice Office → PDF pipeline retained without changing the API contract.
- Live payment approval detection through the existing Supabase realtime subscriptions.
- Professional payment receipt card in the dashboard.
- Client-generated A4 PDF payment receipt with receipt number, customer, plan, UTR, verified date, amount and status.
- Payment approval notification with receipt download action.

## Run
1. Install frontend dependencies with `npm install`.
2. Keep the existing `.env` values and backend URL/integrations.
3. Start frontend with the existing Vite command.
4. Start `server/converter_api.py` with the existing FastAPI deployment process.

## Important
Conversion speed is constrained by the actual file size/content, CPU/RAM, LibreOffice startup time, OCR requirements, and the deployed server. This build removes unnecessary frontend waiting and uses native extraction before expensive OCR where possible; it does not fake conversion completion.
