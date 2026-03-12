-- 002_subscription_check_function.sql
-- Creates (or replaces) a function that checks a business's subscription status.
-- Returns JSON: { status, trial_days_remaining, is_blocked }

CREATE OR REPLACE FUNCTION check_subscription_status(business_uuid UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  biz RECORD;
  days_left int;
  result jsonb;
BEGIN
  SELECT subscription_status, trial_ends_at
  INTO biz
  FROM businesses
  WHERE id = business_uuid;

  -- Business not found
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'expired',
      'trial_days_remaining', NULL,
      'is_blocked', true
    );
  END IF;

  -- Active paid subscription
  IF biz.subscription_status = 'active' THEN
    RETURN jsonb_build_object(
      'status', 'active',
      'trial_days_remaining', NULL,
      'is_blocked', false
    );
  END IF;

  -- Trialing — check whether trial is still valid
  IF biz.subscription_status = 'trialing' THEN
    IF biz.trial_ends_at IS NOT NULL AND biz.trial_ends_at > now() THEN
      days_left := GREATEST(0, EXTRACT(DAY FROM (biz.trial_ends_at - now()))::int);
      RETURN jsonb_build_object(
        'status', 'trialing',
        'trial_days_remaining', days_left,
        'is_blocked', false
      );
    ELSE
      -- Trial has expired
      RETURN jsonb_build_object(
        'status', 'expired',
        'trial_days_remaining', 0,
        'is_blocked', true
      );
    END IF;
  END IF;

  -- Expired or cancelled (or any other status)
  RETURN jsonb_build_object(
    'status', biz.subscription_status,
    'trial_days_remaining', NULL,
    'is_blocked', true
  );
END;
$$;
