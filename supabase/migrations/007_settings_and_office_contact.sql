-- Add contact fields to offices
ALTER TABLE offices
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Create system_settings table (key-value store for global config)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO system_settings (key, value) VALUES
  ('system_name', 'USLS Online Appointment System'),
  ('support_email', 'appointment@usls.edu.ph'),
  ('support_phone', ''),
  ('max_advance_days', '30'),
  ('min_notice_hours', '24'),
  ('archive_approved', 'true'),
  ('archive_declined', 'true'),
  ('archive_completed', 'true'),
  ('archive_expired', 'true'),
  ('notify_confirmation', 'true'),
  ('notify_admin_alert', 'true'),
  ('notify_approval', 'true'),
  ('notify_decline', 'true'),
  ('notify_qr_resend', 'true')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE system_settings IS 'Global system configuration key-value store';
