-- Add the executive offices that were missing from the initial seed (014)
-- so already-provisioned databases stay in sync with the full office list.
-- Idempotent: skips names that already exist.
INSERT INTO offices (name, email, operating_hours, capacity_per_slot, contact_email, contact_phone, category, active)
SELECT v.name, 'dummy@gmail.com', '8:00 AM - 5:00 PM', 1, 'dummy@gmail.com', v.phone, v.category, true
FROM (VALUES
  ('Office of the VCA', '(034) 434-1255', 'Vice Chancellor for Administration'),
  ('Office of the VCMD', '(034) 434-1256', 'Vice Chancellor for Mission and Development'),
  ('Office of the VCAA', '(034) 434-1257', 'Vice Chancellor for Academic Affairs'),
  ('Office of the University President', '(034) 434-1258', 'President')
) AS v(name, phone, category)
WHERE NOT EXISTS (SELECT 1 FROM offices o WHERE o.name = v.name);