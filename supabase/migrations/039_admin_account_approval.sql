-- 039: Self-registered office admins need super admin approval before they can sign in.
-- Existing accounts and accounts created by super admins are approved.
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE admins
  DROP CONSTRAINT IF EXISTS admins_approval_status_check;

ALTER TABLE admins
  ADD CONSTRAINT admins_approval_status_check CHECK (approval_status IN ('pending', 'approved'));

CREATE INDEX IF NOT EXISTS idx_admins_approval_status ON admins(approval_status);

-- Audit actions for approving and rejecting accounts.
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'approve', 'decline', 'postpone', 'entry', 'checkout', 'entry_denied',
    'create_account', 'update_account', 'delete_account', 'reset_password',
    'approve_account', 'reject_account',
    'create_office', 'update_office', 'delete_office',
    'block_time', 'unblock_time', 'reset_qr', 'archive_sync', 'login',
    'create_invitation', 'create_contact', 'update_contact', 'delete_contact',
    'enable_maintenance', 'disable_maintenance', 'update_maintenance'
  ));

NOTIFY pgrst, 'reload schema';
