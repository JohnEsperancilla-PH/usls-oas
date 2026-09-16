ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(30);

CREATE UNIQUE INDEX IF NOT EXISTS admins_employee_id_unique
  ON admins (employee_id)
  WHERE employee_id IS NOT NULL;