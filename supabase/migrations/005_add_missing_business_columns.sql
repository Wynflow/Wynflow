-- Add missing columns to businesses table
-- These were referenced in app code but never migrated
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS gst_inclusive boolean DEFAULT true;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ai_pricing_mode text DEFAULT 'flexible';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS default_payment_terms text DEFAULT '7 days';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS default_show_breakdown boolean DEFAULT true;
