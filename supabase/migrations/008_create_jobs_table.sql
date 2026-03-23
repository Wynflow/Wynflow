-- Create jobs table for scheduling
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  title text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  address text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean DEFAULT false,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  assigned_to text[] DEFAULT '{}',
  notes text,
  color text,
  amount numeric,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- RLS policy: jobs visible only to their business owner
CREATE POLICY "Users can manage their own business jobs"
  ON jobs FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Indexes for calendar queries
CREATE INDEX idx_jobs_business_starts ON jobs(business_id, starts_at);
CREATE INDEX idx_jobs_quote ON jobs(quote_id);

-- Add employee_tags to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS employee_tags text[] DEFAULT '{}';
