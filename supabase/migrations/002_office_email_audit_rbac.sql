-- Add email column to offices
ALTER TABLE offices ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE offices ADD COLUMN IF NOT EXISTS description TEXT;

-- Add decline_reason to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Update offices with email addresses
UPDATE offices SET email = 'registrar@usls.edu.ph' WHERE name = 'Registrar';
UPDATE offices SET email = 'studentaffairs@usls.edu.ph' WHERE name = 'Student Affairs';
UPDATE offices SET email = 'finance@usls.edu.ph' WHERE name = 'Finance Office';
UPDATE offices SET email = 'library@usls.edu.ph' WHERE name = 'Library';
UPDATE offices SET email = 'admissions@usls.edu.ph' WHERE name = 'Admissions';

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UonUID NOT NULL REFERENCES admins(id),
  admin_email VARCHAR(255) NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('approve', 'decline', 'create_account', 'delete_account', 'create_office', 'update_office', 'delete_office')),
  appointment_id UUID REFERENCES appointments(id),
  office_id UUID REFERENCES offices(id),
  target_email VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
