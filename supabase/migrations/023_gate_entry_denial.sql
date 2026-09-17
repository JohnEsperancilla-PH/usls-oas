ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'approved', 'declined', 'entry_denied', 'completed', 'expired'));

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'approve', 'decline', 'entry', 'checkout', 'entry_denied',
    'create_account', 'delete_account', 'create_office', 'update_office',
    'delete_office', 'block_time', 'unblock_time', 'reset_qr',
    'archive_sync', 'login'
  ));
