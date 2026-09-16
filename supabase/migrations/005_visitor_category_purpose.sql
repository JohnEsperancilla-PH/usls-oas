ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS visitor_category TEXT NOT NULL DEFAULT 'general_public',
  ADD COLUMN IF NOT EXISTS purpose_of_visit TEXT;

COMMENT ON COLUMN appointments.visitor_category IS 'Category of visitor: external, parents, student, faculty, alumni, vendor';
COMMENT ON COLUMN appointments.purpose_of_visit IS 'Optional free-text reason for the visit';
