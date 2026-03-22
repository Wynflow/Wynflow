-- Add materials_margin column to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS materials_margin numeric DEFAULT 0;
