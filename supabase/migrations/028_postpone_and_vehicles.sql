-- 028: Postponed appointments + appointment vehicles + new audit actions (Supabase)

-- 1. Allow 'postponed' in appointments.status
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'approved', 'declined', 'entry_denied', 'postponed', 'completed', 'expired'));

-- 2. Vehicle count + invitation marker on appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS vehicle_count INTEGER NOT NULL DEFAULT 0
  CHECK (vehicle_count BETWEEN 0 AND 10);

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS is_invitation BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Child table for vehicles (mirrors the appointment_visitors pattern)
CREATE TABLE IF NOT EXISTS appointment_vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  vehicle_number INTEGER NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  make_model VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (appointment_id, vehicle_number)
);

CREATE INDEX IF NOT EXISTS idx_appointment_vehicles_appointment_id
  ON appointment_vehicles(appointment_id);

-- 3. Extend audit_logs.action with postpone + create_invitation
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'approve', 'decline', 'postpone', 'entry', 'checkout', 'entry_denied',
    'create_account', 'delete_account', 'create_office', 'update_office', 'delete_office',
    'block_time', 'unblock_time', 'reset_qr', 'archive_sync', 'login',
    'create_invitation'
  ));

-- 4. Extend email_logs.type CHECK with postponement + invitation
ALTER TABLE email_logs
  DROP CONSTRAINT IF EXISTS email_logs_type_check;

ALTER TABLE email_logs
  ADD CONSTRAINT email_logs_type_check
  CHECK (type IN ('confirmation', 'admin_alert', 'approval', 'decline', 'postponement', 'invitation'));

