-- 047: Campus-wide closed dates (holidays, suspensions). Set by super admins; a closed date
-- can't be booked, invited, or postponed to at any office. Existing appointments are left as-is.

CREATE TABLE IF NOT EXISTS closed_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_by_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE closed_dates ENABLE ROW LEVEL SECURITY;

-- Audit actions for closing and reopening dates.
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'approve', 'decline', 'postpone', 'entry', 'checkout', 'entry_denied',
    'create_account', 'update_account', 'delete_account', 'reset_password',
    'approve_account', 'reject_account',
    'create_office', 'update_office', 'delete_office', 'permanently_delete_office',
    'block_time', 'unblock_time', 'reset_qr', 'archive_sync', 'login',
    'create_invitation', 'create_contact', 'update_contact', 'delete_contact',
    'enable_maintenance', 'disable_maintenance', 'update_maintenance',
    'update_system_alert', 'update_email_templates', 'tag_sub_office',
    'close_date', 'reopen_date'
  ));

NOTIFY pgrst, 'reload schema';
