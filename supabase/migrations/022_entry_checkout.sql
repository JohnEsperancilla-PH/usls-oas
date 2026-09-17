ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_appointments_checked_out_at
  ON appointments(checked_out_at);

-- Apply the equivalent column to the cPanel MySQL appointments table:
-- ALTER TABLE appointments ADD COLUMN checked_out_at DATETIME NULL AFTER scanned_at;

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'approve', 'decline', 'entry', 'checkout', 'create_account', 'delete_account',
    'create_office', 'update_office', 'delete_office', 'block_time', 'unblock_time',
    'reset_qr', 'archive_sync', 'login'
  ));
