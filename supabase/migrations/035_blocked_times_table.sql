-- 035: Ensure the blocked_times table exists.
--
-- The original `003_blocked_times.sql` created this table, but on the production
-- project it was never applied (the table is absent from PostgREST's schema
-- cache: PGRST205). Its trailing statement re-narrows the `audit_logs.action`
-- check constraint, which now conflicts with the wider constraint added by
-- later migrations — so re-running 003 as-is can fail and roll back the table
-- creation. This migration is idempotent and only (re)creates the table + indexes.
--
-- Admin (office_admin / super_admin) calendar "block time" uses this table.

CREATE TABLE IF NOT EXISTS blocked_times (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_slot VARCHAR(20) NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES admins(id),
  created_by_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_times_office_date ON blocked_times(office_id, date);
CREATE INDEX IF NOT EXISTS idx_blocked_times_date ON blocked_times(date);

-- Ask PostgREST to pick up the new table immediately (otherwise the API may keep
-- returning PGRST205 until the schema cache refreshes).
NOTIFY pgrst, 'reload schema';
