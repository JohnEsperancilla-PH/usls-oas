-- Add scanned_at to track exact gate entry time
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP WITH TIME ZONE;
