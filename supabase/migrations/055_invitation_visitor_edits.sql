-- 055: Offices can change the visitor names on an invitation after creating it (Invitations > Edit Names).
-- The names live in appointments.full_name and appointment_visitors, which already allow updates,
-- so the only schema change is the audit action recorded for each edit.

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
    'update_system_alert', 'update_email_templates', 'tag_sub_office',
    'close_date', 'reopen_date',
    'update_settings', 'expire_appointments', 'booking_submitted', 'download_ticket',
    'create_campus_entry', 'approve_campus_entry', 'decline_campus_entry', 'cancel_campus_entry',
    'resend_campus_entry', 'download_campus_entry',
    'update_invitation_visitors'
  ));

NOTIFY pgrst, 'reload schema';
