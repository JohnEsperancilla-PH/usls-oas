-- Allow deleting admins that are referenced by audit_logs.
-- Audit history is preserved: admin_id is set to NULL (the row already
-- stores the admin's email denormalized in admin_email).
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_admin_id_fkey;

ALTER TABLE audit_logs
  ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL;