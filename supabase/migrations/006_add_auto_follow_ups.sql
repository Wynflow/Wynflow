-- Add auto_follow_ups toggle to businesses table
-- Defaults to true (existing behaviour preserved)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS auto_follow_ups boolean DEFAULT true;
