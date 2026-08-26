-- Create blocked_times table for admin-blocked time slots
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

-- Add audit action for blocking times
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN ('approve', 'decline', 'create_account', 'delete_account', 'create_office', 'update_office', 'delete_office', 'block_time', 'unblock_time'));
