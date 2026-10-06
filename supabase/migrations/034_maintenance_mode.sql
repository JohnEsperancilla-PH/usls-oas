-- Maintenance mode: alternative landing page that a super admin can trigger manually
INSERT INTO system_settings (key, value) VALUES
  ('maintenance_enabled', 'false'),
  ('maintenance_scheduled', 'false'),
  ('maintenance_start', ''),
  ('maintenance_end', ''),
  ('maintenance_headline', 'We are currently under maintenance'),
  ('maintenance_message', 'The Online Appointment System is temporarily unavailable while we perform scheduled maintenance. Please check back later. Existing appointments remain valid and are not affected by this downtime.'),
  ('maintenance_contact_email', '')
ON CONFLICT (key) DO NOTHING;
