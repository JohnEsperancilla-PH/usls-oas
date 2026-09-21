-- Add hide_time_slots column to offices table
-- This allows offices to hide time slot selection from end users for security purposes
-- When enabled, end users can only select a date, and the office will contact them to set a time

ALTER TABLE offices
ADD COLUMN hide_time_slots BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN offices.hide_time_slots IS 'When true, end users cannot select time slots during booking. Office will contact them to schedule a specific time.';
