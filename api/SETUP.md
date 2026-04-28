# Stripe — Setup Notes

## Environment Variables (set in Vercel dashboard)

| Variable | Description | Required for |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxxxx.supabase.co`) | All API routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (NOT the anon key — this bypasses RLS) | All API routes |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe (starts with `whsec_`) | `/api/stripe-webhook` |
| `STRIPE_SECRET_KEY` | Stripe secret API key (starts with `sk_live_` or `sk_test_`) | `/api/create-invoice-payment-link` (online invoice pay) |

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

## DB columns added (already migrated)

```sql
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_url text,
  ADD COLUMN IF NOT EXISTS paid_via text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;
```
