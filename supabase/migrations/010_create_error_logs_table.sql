-- Error logs table for the Wynflow Error Reports N8N workflow
-- The N8N workflow (id JumQbnwecCKt5w9X) POSTs errors to Supabase via service_role.
-- Matches the payload sent by src/App.jsx reportError() → /webhook/error-report
-- after formatting in the N8N "Format Error Data" node.

CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text,              -- e.g. "🔴 CRITICAL" / "🟡 WARNING"
  context text,               -- e.g. "AI_QUOTE_GENERATION", "SEND_QUOTE", "REACT_CRASH"
  message text,               -- the error message
  screen text,                -- which app screen the error happened on
  user_email text,            -- user's email (or "anonymous")
  business_id text,           -- business id (text to match N8N payload, not a FK)
  stack_trace text,           -- first 5 lines of the JS stack
  url text,                   -- window.location.href at the time
  user_agent text,            -- navigator.userAgent
  created_at timestamptz DEFAULT now()
);

-- Indexes for the most common queries: recent errors, errors by severity, errors by user
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs (severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_email ON error_logs (user_email);
CREATE INDEX IF NOT EXISTS idx_error_logs_business_id ON error_logs (business_id);

-- RLS: only service_role (used by the N8N workflow) can write.
-- Regular authenticated users cannot read/write error logs — this is ops data, not user data.
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role can read error_logs" ON error_logs
  FOR SELECT TO service_role USING (true);

CREATE POLICY "service_role can insert error_logs" ON error_logs
  FOR INSERT TO service_role WITH CHECK (true);
