# Stripe — Setup Notes

## Environment Variables (set in Vercel dashboard)

| Variable | Description | Required for |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxxxx.supabase.co`) | All API routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (NOT the anon key — this bypasses RLS) | All API routes |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe (starts with `whsec_`) | `/api/stripe-webhook` |
| `STRIPE_SECRET_KEY` | Stripe secret API key (starts with `sk_live_` or `sk_test_`) | `/api/create-invoice-payment-link` (online invoice pay) |
| `ANTHROPIC_API_KEY` | Anthropic API key (starts with `sk-ant-`) | `/api/ai-rewrite-step` (AI follow-up rewrite) |
| `ANTHROPIC_MODEL` | Optional. Claude model id (default `claude-opus-4-7`) | `/api/ai-rewrite-step` |
| `XERO_CLIENT_ID` | OAuth client ID from your Xero app | `/api/xero-oauth-init`, `/api/xero-oauth-callback`, `/api/xero-push-invoice` |
| `XERO_CLIENT_SECRET` | OAuth client secret from your Xero app | `/api/xero-oauth-callback`, `/api/xero-push-invoice` |
| `SITE_BASE_URL` | Optional. Defaults to `https://www.wynflow.co.nz`. Override for staging | Xero callback redirect |

## Stripe Dashboard Configuration

1. Go to **Developers > Webhooks** in the Stripe dashboard.
2. Click **Add endpoint**.
3. Set the endpoint URL to:

```
https://www.wynflow.co.nz/api/stripe-webhook
```

4. Subscribe to these events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`

5. Copy the **Signing secret** (`whsec_...`) and add it as the `STRIPE_WEBHOOK_SECRET` env var in Vercel.

## How It Works

- When a customer completes checkout, the webhook finds their business by email and activates their subscription.
- On successful invoice payment, it updates the subscription period end date.
- On failed payment, it marks the subscription as expired.
- On subscription cancellation, it marks the subscription as cancelled.
- For Wynflow-customer invoice payments (i.e. a homeowner paying a tradie's invoice), the webhook matches by `metadata.invoice_id` instead of by email and marks the invoice `paid` with `paid_via=stripe` and `paid_at=now()`.

All database updates go through the Supabase REST API using the service role key (bypasses RLS).

## `/api/create-invoice-payment-link`

When a Wynflow tradie sends or resends an invoice, the app calls this route to create a Stripe Payment Link for that specific invoice. The link is reusable by the homeowner, lives on the `invoices.stripe_payment_link_url` column, and is included in the invoice email by the N8N workflow.

**To enable online invoice payments:**
1. Add `STRIPE_SECRET_KEY` to Vercel env vars (Settings → Environment Variables)
2. Make sure the Stripe webhook endpoint above is subscribed to `checkout.session.completed`
3. The N8N `send-invoice` workflow must read `stripe_payment_link_url` from the invoice row and include a "Pay online" button in the email body

If `STRIPE_SECRET_KEY` is not set, invoice sending still works — just without an online-payment link (bank-transfer details only, as before).

## `/api/ai-rewrite-step`

Takes a follow-up sequence step (subject + body with placeholder tags) and uses Claude to rewrite it as natural, on-brand prose for a NZ tradie. Preserves placeholder tags so runtime substitution still works.

Used by `SequencesManager` — every step edit form has an "AI Rewrite" button that calls this endpoint.

**Two paths, in order:**
1. If `ANTHROPIC_API_KEY` is set in Vercel, the route calls Anthropic directly. (Override model with `ANTHROPIC_MODEL`.)
2. Otherwise the route proxies through the active N8N workflow `Wynflow - AI Rewrite Step` at `/webhook/ai-rewrite-step` (which has its own Anthropic credentials). **This is the default — works out of the box, no Vercel env var needed.**

## Xero integration — `/api/xero-oauth-init`, `/api/xero-oauth-callback`, `/api/xero-push-invoice`

One-way push of Wynflow invoices into a connected Xero org. OAuth 2 flow with refresh-token rotation. Tokens stored on the `businesses` row.

**Setup steps for Wynflow operator:**
1. Sign in at https://developer.xero.com → My Apps → New App
2. Choose "Web app", name it (e.g. "Wynflow"), set company URL to `https://www.wynflow.co.nz`
3. Add redirect URI exactly: `https://www.wynflow.co.nz/api/xero-oauth-callback`
4. Save and copy **Client ID** + **Client Secret**
5. In Vercel → Settings → Environment Variables, add:
   - `XERO_CLIENT_ID` = the client ID
   - `XERO_CLIENT_SECRET` = the client secret
6. Redeploy (or wait for next deploy) so the new env vars apply
7. In the app: Settings → Integrations → "Connect Xero" → choose your Xero org → done

Once connected, every InvoiceDetail screen exposes a "Push to Xero" button. The push:
- Refreshes the access token transparently if expired
- Looks up (or creates) a Xero contact by email
- Creates the Xero invoice as `AUTHORISED` (or `DRAFT` if Wynflow status is draft)
- Maps line items from `breakdown.lineItems` if present, else a single line of `job_title`/`amount`
- Saves `xero_invoice_id` and `xero_pushed_at` back on the Wynflow invoice

Errors are stored in `xero_push_error` and surfaced inline on the invoice page.

## DB columns added (already migrated)

```sql
-- Stripe pay button
ALTER TABLE invoices
  ADD COLUMN stripe_payment_link_id text,
  ADD COLUMN stripe_payment_link_url text,
  ADD COLUMN paid_via text,
  ADD COLUMN paid_at timestamptz;

-- Xero sync
ALTER TABLE businesses
  ADD COLUMN xero_access_token text,
  ADD COLUMN xero_refresh_token text,
  ADD COLUMN xero_tenant_id text,
  ADD COLUMN xero_token_expires_at timestamptz,
  ADD COLUMN xero_connected_at timestamptz,
  ADD COLUMN xero_oauth_state text,
  ADD COLUMN xero_oauth_state_expires_at timestamptz;

ALTER TABLE invoices
  ADD COLUMN xero_invoice_id text,
  ADD COLUMN xero_pushed_at timestamptz,
  ADD COLUMN xero_push_error text;

-- Job Card depth (Notes / Checklist / Files)
ALTER TABLE quotes
  ADD COLUMN tradie_notes text,
  ADD COLUMN checklist jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;
```
