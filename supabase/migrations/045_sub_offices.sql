-- 045: Sub-offices. A sub-office is an office with a parent office; it keeps its own schedule,
-- contacts, and accounts. The parent office's admins can see and act on its appointments.

-- Super admins switch this on per office; its office admins can then create sub-offices.
ALTER TABLE offices
  ADD COLUMN IF NOT EXISTS allow_sub_offices BOOLEAN NOT NULL DEFAULT FALSE;

-- One level only: a sub-office can't have sub-offices of its own (enforced by the API).
-- RESTRICT so a main office can't be deleted while it still has sub-offices.
ALTER TABLE offices
  ADD COLUMN IF NOT EXISTS parent_office_id UUID REFERENCES offices(id) ON DELETE RESTRICT;

ALTER TABLE offices DROP CONSTRAINT IF EXISTS offices_parent_not_self;
ALTER TABLE offices ADD CONSTRAINT offices_parent_not_self CHECK (parent_office_id IS NULL OR parent_office_id <> id);

CREATE INDEX IF NOT EXISTS idx_offices_parent_office_id ON offices(parent_office_id);

-- Sub-offices tagged on an appointment of their main office, so they're notified and can act on it.
-- office_id is deliberately not a foreign key: a link to offices would make PostgREST's "offices(*)"
-- embeds on appointments ambiguous (see 046). Deleting an office clears its tags in the API.
CREATE TABLE IF NOT EXISTS appointment_office_tags (
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  office_id UUID NOT NULL,
  tagged_by_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (appointment_id, office_id)
);

CREATE INDEX IF NOT EXISTS idx_appointment_office_tags_office_id ON appointment_office_tags(office_id);

ALTER TABLE appointment_office_tags ENABLE ROW LEVEL SECURITY;

-- Audit actions for sub-office changes and tagging.
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'approve', 'decline', 'postpone', 'entry', 'checkout', 'entry_denied',
    'create_account', 'update_account', 'delete_account', 'reset_password',
    'approve_account', 'reject_account',
    'create_office', 'update_office', 'delete_office', 'permanently_delete_office',
    'block_time', 'unblock_time', 'reset_qr', 'archive_sync', 'login',
    'create_invitation', 'create_contact', 'update_contact', 'delete_contact',
    'enable_maintenance', 'disable_maintenance', 'update_maintenance',
    'update_system_alert', 'update_email_templates', 'tag_sub_office'
  ));

NOTIFY pgrst, 'reload schema';
