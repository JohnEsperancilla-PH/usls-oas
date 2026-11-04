-- 049: Guard Admin role — a head guard / security supervisor. Signs in at /admin with an email,
-- sees every office's appointments for the day (read-only), can use the gate page, and can
-- create gate user (guard) accounts only.

ALTER TABLE admins
  DROP CONSTRAINT IF EXISTS admins_role_check;

ALTER TABLE admins
  ADD CONSTRAINT admins_role_check
  CHECK (role IN ('super_admin', 'office_admin', 'gate_user', 'gate_admin'));

NOTIFY pgrst, 'reload schema';
