-- Leads table for outbound lead generation pipeline
-- Used by N8N workflows: Google Maps scrape → Hunter.io enrichment → cold email sequences

CREATE TABLE IF NOT EXISTS leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  website text,
  trade text,
  city text,
  google_rating numeric,
  review_count integer DEFAULT 0,
  google_maps_url text,
  source text DEFAULT 'google_maps',
  status text DEFAULT 'new' CHECK (status IN ('new', 'enriched', 'contacted', 'replied', 'converted', 'unsubscribed')),
  email_verified boolean DEFAULT false,
  sequence_step integer DEFAULT 0,
  last_contacted_at timestamptz,
  lead_score integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_trade ON leads (trade);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads (city);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email);

-- Dedupe index: prevent importing same business twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_dedup ON leads (business_name, city) WHERE city IS NOT NULL;

-- RLS: Only authenticated users can access (admin only for now)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read leads" ON leads
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert leads" ON leads
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update leads" ON leads
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete leads" ON leads
  FOR DELETE TO authenticated USING (true);
