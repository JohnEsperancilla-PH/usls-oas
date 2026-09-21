-- Make time_slot nullable in appointments table
-- This allows offices to hide time slots from end users for security purposes
-- When hide_time_slots is enabled, appointments can be created without a specific time

ALTER TABLE appointments
ALTER COLUMN time_slot DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN appointments.time_slot IS 'Time slot for the appointment. Can be NULL if the office has hide_time_slots enabled, in which case the office will contact the visitor to schedule a specific time.';
