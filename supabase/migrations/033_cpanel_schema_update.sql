-- cPanel Schema Update: Add missing columns and make time_slot nullable
-- Run this in phpMyAdmin or MySQL CLI on the cPanel server

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS visitor_count INT NOT NULL DEFAULT 1;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS vehicle_count INT NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS person_to_meet TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checked_out_at DATETIME NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_invitation BOOLEAN NOT NULL DEFAULT FALSE;

-- Make time_slot nullable (mirror code may pass null for hide_time_slots offices)
ALTER TABLE appointments MODIFY COLUMN time_slot VARCHAR(20) NULL DEFAULT NULL;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_cpanel_visitor_count ON appointments(visitor_count);
CREATE INDEX IF NOT EXISTS idx_cpanel_vehicle_count ON appointments(vehicle_count);
CREATE INDEX IF NOT EXISTS idx_cpanel_checked_out_at ON appointments(checked_out_at);
CREATE INDEX IF NOT EXISTS idx_cpanel_is_invitation ON appointments(is_invitation);