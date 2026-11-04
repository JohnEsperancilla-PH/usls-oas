-- 048: History of system update popups, shown on the /updates page. A row is added whenever a
-- super admin publishes new popup text under Settings > System Update Popup.
-- audience is a comma list of: landing (public), admin, gate — the same values as the popup.

CREATE TABLE IF NOT EXISTS system_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'landing,admin,gate',
  published_by_email VARCHAR(255),
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_updates_published_at ON system_updates(published_at DESC);

ALTER TABLE system_updates ENABLE ROW LEVEL SECURITY;

-- Keep the popup that's already set up as the first entry.
INSERT INTO system_updates (headline, message, audience, published_at)
SELECT h.value, COALESCE(m.value, ''), COALESCE(NULLIF(a.value, ''), 'landing,admin,gate'), COALESCE(v.value::timestamptz, NOW())
FROM system_settings h
LEFT JOIN system_settings m ON m.key = 'alert_message'
LEFT JOIN system_settings a ON a.key = 'alert_audience'
LEFT JOIN system_settings v ON v.key = 'alert_version' AND v.value ~ '^\d{4}-\d{2}-\d{2}T'
WHERE h.key = 'alert_headline' AND COALESCE(h.value, '') <> ''
  AND NOT EXISTS (SELECT 1 FROM system_updates);

-- Release notes for the November 4, 2026 update.
INSERT INTO system_updates (headline, message, audience, published_at)
SELECT
  'New: Closed dates, a faster booking calendar, and before/after audit history',
  'Here''s what''s new in OASYS:

• Closed dates: Holidays and campus closures can now be set for all offices at once, including days closed every week (e.g. every Wednesday). Closed days are crossed out on every calendar and can''t be booked, invited, or postponed to.

• New Invitation: Picking a date and time now works like the public booking page. It has a calendar with availability, time-slot buttons that show open spots, and 30/60-minute options.

• Calendar: The calendar now fills the screen, past days are greyed out, and holidays are labeled.

• Dropdowns on phones: Dropdowns now open your phone''s own picker on iPhone and Android.

For super admins:
• Offices > People: View and add the accounts under each office, alongside its contacts.
• Audit Log > View: See exactly what changed in an update, before and after.',
  'admin',
  '2026-11-04T18:00:00+08:00'
WHERE NOT EXISTS (
  SELECT 1 FROM system_updates WHERE headline = 'New: Closed dates, a faster booking calendar, and before/after audit history'
);

NOTIFY pgrst, 'reload schema';
