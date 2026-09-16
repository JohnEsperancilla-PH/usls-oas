  ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS person_to_meet TEXT;

  COMMENT ON COLUMN appointments.person_to_meet IS 'Person the visitor is scheduled to meet at the office';

  -- cPanel MySQL (run this in phpMyAdmin or MySQL CLI on the cPanel server):
  -- ALTER TABLE appointments ADD COLUMN person_to_meet TEXT AFTER visitor_category;