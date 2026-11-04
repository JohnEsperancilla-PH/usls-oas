-- 046: 045 linked appointment_office_tags.office_id to offices, which gave PostgREST a second path from
-- appointments to offices and broke every "offices(*)" embed on appointments ("more than one relationship").
-- The link is dropped; the API validates tagged offices, and deleting an office clears its tags.
ALTER TABLE appointment_office_tags
  DROP CONSTRAINT IF EXISTS appointment_office_tags_office_id_fkey;

NOTIFY pgrst, 'reload schema';
