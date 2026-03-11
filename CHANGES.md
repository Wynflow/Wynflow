# Changes — 12 March 2026

Batch of fixes and features applied to `src/App.jsx`, `index.html`, and the N8N invoice email workflow.

## 1. Wynflow Logo → Dashboard Navigation
- **Sidebar logo** (desktop) now has `onClick` to navigate to dashboard
- Previously had no click handler, just decorative

## 2. Historical Quotes for AI Training
- **New `HistoricalQuotes` component** — full screen for adding old quotes (pre-Wynflow) to train the AI
- Fields: job title, amount, customer name, description, outcome (Won/Lost/Accepted)
- Stored in `quotes` table with `source: "historical"` tag
- Accessible via **Settings → Pricing & AI Estimates → Historical Quotes** link
- AI webhook calls now send up to 30 quotes (was 20) with `source` tag so N8N/AI can weight historical data appropriately
- Delete button on each historical quote
- **Supabase requirement:** Add `source` column to quotes table: `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS source text DEFAULT 'wynflow';`

## 3. Favicon / PWA Icon Fix
- Added `manifest.json` with proper icon definitions (32x32, 180x180, 512x512)
- Added `<link rel="manifest">` to `index.html`
- Existing favicon files were correct — the missing manifest was why Google/browsers weren't picking up the W icon

## 4. AI Description Removed from Invoice Detail
- Removed the `description` display from InvoiceDetail — was showing long AI-generated scope text that was confusing
- Invoice financials (amount, GST, due date, terms) still show correctly
- The full scope/description is still available in the PDF and in the linked quote

## 5. Quote Status Label: "Sent" → "Awaiting Response"
- `statusConfig.sent.label` changed from "Sent" to "Awaiting Response"
- QuotesList tab label changed from "Sent" to "Awaiting"
- Better describes the actual state — the quote is sent, you're waiting for a response

## 6. Delete Invoice (with confirmation)
- Added `deleteInvoice` function to `InvoiceDetail`
- Delete button appears in all action sections (draft, sent/viewed, overdue)
- Confirmation prompt: "Are you sure you want to delete this invoice? This cannot be undone."
- Added `DELETE_INVOICE` reducer action

## 7. Delete Quote (with confirmation)
- Added `deleteQuote` function to `QuoteDetail`
- Delete button in the sent/opened actions card
- Standalone delete button for accepted/booked/declined/requested quotes
- Confirmation prompt with same pattern
- Added `DELETE_QUOTE` reducer action

## 8. Logout Flow Fix
- Sidebar and Settings logout now:
  - Calls `supabase.auth_signOut()`
  - Clears `supabase.token` and `supabase.user` (were persisting after logout)
  - Clears cookies
  - Dispatches `LOGOUT`
  - Calls `window.history.replaceState(null, "", "/")` to update URL to root
- Prevents stale auth state and URL mismatch after logout

## 9. Analytics: "Accept" → "Respond" Terminology
- "When Do Customers Accept?" → "When Do Customers Respond?"
- "Which follow-up email triggered the acceptance" → "...triggered the response"
- Dashboard: "When customers accept your quotes" → "When customers respond to your quotes"
- Activity feed: "accepted your quote" → "responded — accepted"
- Help Centre article updated to match
- Note: "Win Rate", "Accepted", "Booked" labels kept as-is — they're distinct statuses, not general terminology

## 10. Invoice Email Template — Financials Only
- **Updated N8N workflow JSON** (`Desktop/Wynflow_3_-_Send_Invoice_Email.json`)
- Removed: scope of work, full breakdown (materials, labour, callout), notes, deposit info
- Kept: invoice number, job title, line items table, subtotal, GST, total due, due date, bank/payment details
- Both email paths (with PDF attachment and without) updated identically
- **You need to re-import this workflow into N8N** to apply the changes

## New Icons Imported
- `Trash2` — delete buttons
- `History` — historical quotes feature

## Supabase Actions Needed
```sql
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS source text DEFAULT 'wynflow';
```

## N8N Actions Needed
- Re-import `Wynflow_3_-_Send_Invoice_Email.json` from Desktop into N8N
