-- Allow deleting offices referenced by admins and audit_logs.
-- Admin accounts and audit history are preserved; their office_id is set to NULL.
ALTER TABLE admins
  DROP CONSTRAINT IF EXISTS admins_office_id_fkey;

ALTER TABLE admins
  ADD CONSTRAINT admins_office_id_fkey
  FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE SET NULL;

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_office_id_fkey;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_office_id_fkey
  FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE SET NULL;

-- When appointments cascade-delete (office deletion), their email logs go too.
ALTER TABLE email_logs
  DROP CONSTRAINT IF EXISTS email_logs_appointment_id_fkey;

ALTER TABLE email_logs
  ADD CONSTRAINT email_logs_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

-- Audit rows referencing a being-deleted appointment keep the row but clear the reference.
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_appointment_id_fkey;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;