-- Track when a user has completed (or dismissed) the demo onboarding flow.
-- Used for (a) analytics on the signup → demo → first-quote funnel,
-- (b) suppressing the dashboard rescue banner for users who've seen the demo.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS demo_completed_at timestamptz;
