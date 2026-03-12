# Stripe Webhook — Setup Notes

## Environment Variables (set in Vercel dashboard)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (NOT the anon key — this bypasses RLS) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe (starts with `whsec_`) |

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

All database updates go through the Supabase REST API using the service role key (bypasses RLS).
