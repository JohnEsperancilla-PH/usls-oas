-- 050: Gate entry log. One row per gate event: visitor let in, checked out, denied by the guard,
-- or a rejected scan (code not found, already used, too early/late, wrong date, not approved…).
-- Details are copied in at the time of the event, so the log still reads correctly after the
-- appointment or office changes or is deleted.

CREATE TABLE IF NOT EXISTS entry_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- entry | checkout | denied | rejected
  event VARCHAR(20) NOT NULL CHECK (event IN ('entry', 'checkout', 'denied', 'rejected')),
  -- Outcome code from the gate, e.g. approved, checked_out, not_found, too_early, already_used.
  result VARCHAR(40) NOT NULL,
  message TEXT,
  -- How the code was entered: qr (camera), manual (typed), list (picked from today's visitors).
  method VARCHAR(10),
  reference VARCHAR(40),

  -- No foreign key on office_id: offices can be deleted, and the log keeps its copy of the name.
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  office_id UUID,
  office_name TEXT,
  visitor_name TEXT,
  visitor_category VARCHAR(40),
  visitor_count INTEGER,
  vehicle_plates TEXT,
  appointment_date DATE,
  time_slot VARCHAR(20),
  -- Minutes between the scan and the booked time: negative = early, positive = late.
  minutes_from_slot INTEGER,
  -- For checkouts: minutes between entry and checkout.
  minutes_on_site INTEGER,

  guard_id UUID,
  guard_name TEXT,
  guard_username VARCHAR(40),
  guard_role VARCHAR(20),
  ip VARCHAR(64),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_entry_logs_created_at ON entry_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_logs_event ON entry_logs(event);
CREATE INDEX IF NOT EXISTS idx_entry_logs_office_id ON entry_logs(office_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_appointment_id ON entry_logs(appointment_id);

ALTER TABLE entry_logs ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
