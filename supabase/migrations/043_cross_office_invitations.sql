-- 043: Let chosen offices create invitations on behalf of other offices.

-- Super admins switch this on per office under Offices > Edit.
ALTER TABLE offices
  ADD COLUMN IF NOT EXISTS can_invite_for_other_offices BOOLEAN NOT NULL DEFAULT FALSE;

-- The office whose admin created the invitation, so it still sees invitations made for other offices.
-- Deliberately not a foreign key: a second link from appointments to offices would make PostgREST's
-- "offices(*)" embeds ambiguous across the app. A deleted office simply stops matching.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS invited_by_office_id UUID;

CREATE INDEX IF NOT EXISTS idx_appointments_invited_by_office_id ON appointments(invited_by_office_id);

-- The Center of Alumni Relations books visits for alumni and visitors on behalf of other offices.
UPDATE offices SET can_invite_for_other_offices = TRUE WHERE name = 'Center of Alumni Relations';

NOTIFY pgrst, 'reload schema';
