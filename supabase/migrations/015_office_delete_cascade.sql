-- Allow deleting offices even when they have appointments.
-- Appointments belonging to the deleted office are removed as well (ON DELETE CASCADE).
-- NOTE: mirror archives already synced to the cPanel 'appointments' table are NOT affected (no FK there).
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_office_id_fkey;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_office_id_fkey
  FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE;