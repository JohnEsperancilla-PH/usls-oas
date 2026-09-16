ALTER TABLE appointments
  ALTER COLUMN visitor_category SET DEFAULT 'external';

COMMENT ON COLUMN appointments.visitor_category IS 'Category of visitor: external, parents, student, faculty, alumni, vendor';