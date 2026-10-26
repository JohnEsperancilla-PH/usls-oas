-- 036: Allow audit logs for admin password resets.
-- Also keeps the constraint aligned with every action currently written by the app.
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'approve', 'decline', 'postpone', 'entry', 'checkout', 'entry_denied',
    'create_account', 'delete_account', 'reset_password',
    'create_office', 'update_office', 'delete_office',
    'block_time', 'unblock_time', 'reset_qr', 'archive_sync', 'login',
    'create_invitation', 'create_contact', 'update_contact', 'delete_contact',
    'enable_maintenance', 'disable_maintenance', 'update_maintenance'
  ));

NOTIFY pgrst, 'reload schema';
