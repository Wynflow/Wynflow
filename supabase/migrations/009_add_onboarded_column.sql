-- Add onboarded flag to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false;
