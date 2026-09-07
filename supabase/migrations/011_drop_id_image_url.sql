-- Remove the ID image upload column. Visitors now select a government-issued
-- ID (valid_id) instead of uploading a photo.

ALTER TABLE appointments DROP COLUMN IF EXISTS id_image_url;