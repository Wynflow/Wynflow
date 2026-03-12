# Wynflow — Pre-Launch To-Do List

## Stripe Webhook Setup
- [ ] Set env vars in Vercel dashboard:
  - `SUPABASE_URL` — your Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY` — found in Supabase → Settings → API
  - `STRIPE_WEBHOOK_SECRET` — generated when you create the webhook in Stripe
- [ ] In Stripe dashboard → Developers → Webhooks → Add endpoint:
  - URL: `https://www.wynflow.co.nz/api/stripe-webhook`
  - Events to subscribe to:
    - `checkout.session.completed`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`
    - `customer.subscription.deleted`
- [ ] Test with Stripe CLI: `stripe trigger checkout.session.completed`

## Supabase Auth
- [ ] Enable "Confirm email" in Supabase → Authentication → Providers → Email

## Supabase Migrations
- [x] Run `001_add_subscription_fields.sql` in SQL Editor
- [x] Run `002_subscription_check_function.sql` in SQL Editor

## Before Go-Live
- [ ] Test full signup flow: sign up → verify email → create account → Stripe checkout
- [ ] Test trial expiry paywall (set a test user's trial_ends_at to the past)
- [ ] Test Stripe webhook updates subscription_status to 'active' after payment
- [ ] Verify login still works for existing users
