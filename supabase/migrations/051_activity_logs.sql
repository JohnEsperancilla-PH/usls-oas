-- 051: More activity logging.
--  * sign_in_logs: every sign-in attempt on the admin and gate login pages, successful or not.
--  * New audit actions: settings changes, automatic expiry of no-show appointments, public booking
--    submissions, and invitation ticket downloads.

CREATE TABLE IF NOT EXISTS sign_in_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- admin (/admin/login) | gate (/entry)
  portal VARCHAR(10) NOT NULL CHECK (portal IN ('admin', 'gate')),
  success BOOLEAN NOT NULL,
  -- What was typed: an email on the admin page, a username on the gate page.
  identifier VARCHAR(255),
  -- Set when the attempt matched an account.
  admin_id UUID,
  name TEXT,
  role VARCHAR(20),
  -- Why it failed: wrong_password, unknown_account, not_staff, pending_approval, wrong_portal, rate_limited.
  reason VARCHAR(40),
  ip VARCHAR(64),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sign_in_logs_created_at ON sign_in_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sign_in_logs_identifier ON sign_in_logs(identifier);

ALTER TABLE sign_in_logs ENABLE ROW LEVEL SECURITY;

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
    'close_date', 'reopen_date',
    'update_settings', 'expire_appointments', 'booking_submitted', 'download_ticket'
  ));

NOTIFY pgrst, 'reload schema';
