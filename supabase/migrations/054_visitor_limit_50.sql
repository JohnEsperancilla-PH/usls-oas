-- 054: One appointment can now bring up to 50 visitors (was 10), all on one QR code.
-- Replaces the 1-10 checks from 024 on appointments.visitor_count and appointment_visitors.visitor_number.
-- The checks are found by column, so this works whatever Postgres named them.

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conrelid::regclass AS tbl, con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.contype = 'c'
      AND (
        (con.conrelid = 'appointments'::regclass AND att.attname = 'visitor_count')
        OR (con.conrelid = 'appointment_visitors'::regclass AND att.attname = 'visitor_number')
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_visitor_count_check CHECK (visitor_count BETWEEN 1 AND 50);

ALTER TABLE appointment_visitors
  ADD CONSTRAINT appointment_visitors_visitor_number_check CHECK (visitor_number BETWEEN 1 AND 50);

NOTIFY pgrst, 'reload schema';
