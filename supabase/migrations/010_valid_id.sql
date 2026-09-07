-- Replace ID image upload with a selectable government-issued ID type.
-- The visitor now picks which valid ID they will present at the gate;
-- existing uploaded ID images are kept for historical appointments.

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS valid_id TEXT;

ALTER TABLE appointments ALTER COLUMN id_image_url DROP NOT NULL;