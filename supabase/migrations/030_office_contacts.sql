-- 030: Office contacts + tagged contacts on invitations (Supabase)

-- 1. Office contacts table — people/specific contacts managed per office.
--    Admin recruitment: each contact belongs to exactly one office.
CREATE TABLE IF NOT EXISTS office_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  position VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_office_contacts_office_id ON office_contacts(office_id);

-- 2. Tagged contacts on an appointment/invitation (joined join table).
--    Snapshot of name/email/position at invite time so the calendar + emails
--    are stable even if the contact record is later edited/deleted.
CREATE TABLE IF NOT EXISTS appointment_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES office_contacts(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  position VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (appointment_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_appointment_contacts_appointment_id
  ON appointment_contacts(appointment_id);

-- 3. Extend audit_logs.action with contact CRUD actions
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'approve', 'decline', 'postpone', 'entry', 'checkout', 'entry_denied',
    'create_account', 'delete_account', 'create_office', 'update_office', 'delete_office',
    'block_time', 'unblock_time', 'reset_qr', 'archive_sync', 'login',
    'create_invitation', 'create_contact', 'update_contact', 'delete_contact'
  ));