-- 044: Per-office booking limits. NULL means the office follows Settings > Booking Rules.
ALTER TABLE offices
  ADD COLUMN IF NOT EXISTS max_advance_days INTEGER,
  ADD COLUMN IF NOT EXISTS min_notice_hours INTEGER;

ALTER TABLE offices DROP CONSTRAINT IF EXISTS offices_max_advance_days_check;
ALTER TABLE offices ADD CONSTRAINT offices_max_advance_days_check CHECK (max_advance_days IS NULL OR max_advance_days BETWEEN 1 AND 365);

ALTER TABLE offices DROP CONSTRAINT IF EXISTS offices_min_notice_hours_check;
ALTER TABLE offices ADD CONSTRAINT offices_min_notice_hours_check CHECK (min_notice_hours IS NULL OR min_notice_hours BETWEEN 0 AND 168);

NOTIFY pgrst, 'reload schema';
