-- 001_add_subscription_fields.sql
-- Adds subscription/billing columns to the businesses table.
-- Safe to re-run: uses IF NOT EXISTS / conditional checks.

-- 1. Add trial_ends_at with a default for new rows
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '14 days');

-- 2. Add Stripe identifiers
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- 3. Add subscription period end (from Stripe webhook data)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;

-- 4. Backfill trial_ends_at for existing trialing rows that don't have it set yet
UPDATE businesses
SET trial_ends_at = created_at + interval '14 days'
WHERE subscription_status = 'trialing'
  AND trial_ends_at IS NULL;
