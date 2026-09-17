ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS visitor_count INTEGER NOT NULL DEFAULT 1
  CHECK (visitor_count BETWEEN 1 AND 10);

CREATE TABLE IF NOT EXISTS appointment_visitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  visitor_number INTEGER NOT NULL CHECK (visitor_number BETWEEN 1 AND 10),
  full_name VARCHAR(255) NOT NULL,
  valid_id VARCHAR(100) NOT NULL,
  is_booker BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (appointment_id, visitor_number)
);

CREATE INDEX IF NOT EXISTS idx_appointment_visitors_appointment_id
  ON appointment_visitors(appointment_id);

INSERT INTO appointment_visitors (appointment_id, visitor_number, full_name, valid_id, is_booker)
SELECT id, 1, full_name, COALESCE(valid_id, ''), true
FROM appointments
WHERE NOT EXISTS (
  SELECT 1 FROM appointment_visitors WHERE appointment_visitors.appointment_id = appointments.id
);