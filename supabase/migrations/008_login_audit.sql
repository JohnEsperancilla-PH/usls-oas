-- Add login (and sync/reset actions already used in code) to audit_logs action constraint
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN ('approve', 'decline', 'create_account', 'delete_account', 'create_office', 'update_office', 'delete_office', 'block_time', 'unblock_time', 'reset_qr', 'archive_sync', 'login'));
