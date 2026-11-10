export type AppointmentStatus = "pending" | "approved" | "declined" | "postponed" | "entry_denied" | "completed" | "expired";
export type AdminRole = "super_admin" | "office_admin" | "gate_user" | "gate_admin";
export type VisitorCategory = "external" | "parents" | "alumni" | "vendor";
export type AuditAction = "approve" | "decline" | "postpone" | "entry" | "checkout" | "entry_denied" | "create_account" | "update_account" | "delete_account" | "reset_password" | "approve_account" | "reject_account" | "create_office" | "update_office" | "delete_office" | "permanently_delete_office" | "block_time" | "unblock_time" | "reset_qr" | "archive_sync" | "login" | "create_invitation" | "create_contact" | "update_contact" | "delete_contact" | "enable_maintenance" | "disable_maintenance" | "update_maintenance" | "update_system_alert" | "update_email_templates" | "tag_sub_office" | "close_date" | "reopen_date" | "update_settings" | "expire_appointments" | "booking_submitted" | "download_ticket";

export interface Office {
  id: string;
  name: string;
  category: string | null;
  email: string | null;
  description: string | null;
  operating_hours: string;
  capacity_per_slot: number;
  active: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  hide_time_slots: boolean;
  can_invite_for_other_offices?: boolean;
  // Lets this office's admins create sub-offices under it.
  allow_sub_offices?: boolean;
  // Set on sub-offices: the main office they belong to.
  parent_office_id?: string | null;
  // Office booking limits; null follows Settings > Booking Rules.
  max_advance_days?: number | null;
  min_notice_hours?: number | null;
  contacts?: OfficeContact[];
  created_at: string;
}

export interface OfficeContact {
  id: string;
  office_id: string;
  name: string;
  email: string;
  position: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentContact {
  id: string;
  appointment_id: string;
  contact_id: string | null;
  name: string;
  email: string;
  position: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  // Government-issued ID the visitor will present at the gate.
  valid_id: string | null;
  visitor_category: VisitorCategory;
  purpose_of_visit: string | null;
  person_to_meet: string | null;
  office_id: string;
  date: string;
  time_slot: string | null;
  duration: 30 | 60;
  status: AppointmentStatus;
  // Stores the visitor's reference number (single-use gate entry code).
  qr_token: string | null;
  qr_used_at: string | null;
  scanned_at: string | null;
  checked_out_at: string | null;
  decline_reason: string | null;
  archived: boolean;
  visitor_count: number;
  vehicle_count: number;
  is_invitation: boolean;
  // Office whose admin created the invitation, when made on behalf of another office.
  invited_by_office_id?: string | null;
  created_at: string;
  updated_at: string;
  office?: Office;
  visitors?: AppointmentVisitor[];
  vehicles?: AppointmentVehicle[];
}

export interface AppointmentVisitor {
  id: string;
  appointment_id: string;
  visitor_number: number;
  full_name: string;
  valid_id: string;
  is_booker: boolean;
  created_at: string;
}

export interface AppointmentVehicle {
  id: string;
  appointment_id: string;
  vehicle_number: number;
  plate_number: string;
  make_model: string | null;
  created_at: string;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  employee_id: string | null;
  role: AdminRole;
  office_id: string | null;
  // Self-registered office admins stay "pending" until a super admin approves them.
  approval_status?: AdminApprovalStatus;
  created_at: string;
}

export type AdminApprovalStatus = "pending" | "approved";

export interface SignInLog {
  id: string;
  created_at: string;
  portal: "admin" | "gate";
  success: boolean;
  identifier: string | null;
  admin_id: string | null;
  name: string | null;
  role: string | null;
  reason: string | null;
  ip: string | null;
  user_agent: string | null;
}

export interface EmailLog {
  id: string;
  appointment_id: string;
  type: "confirmation" | "admin_alert" | "approval" | "decline" | "postponement" | "invitation";
  status: "pending" | "sent" | "failed";
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_id: string | null;
  admin_email: string;
  action: AuditAction;
  appointment_id: string | null;
  office_id: string | null;
  target_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export type EntryLogEvent = "entry" | "checkout" | "denied" | "rejected";

export interface EntryLog {
  id: string;
  created_at: string;
  event: EntryLogEvent;
  result: string;
  message: string | null;
  method: "qr" | "manual" | "list" | null;
  reference: string | null;
  appointment_id: string | null;
  office_id: string | null;
  office_name: string | null;
  visitor_name: string | null;
  visitor_category: string | null;
  visitor_count: number | null;
  vehicle_plates: string | null;
  appointment_date: string | null;
  time_slot: string | null;
  minutes_from_slot: number | null;
  minutes_on_site: number | null;
  guard_id: string | null;
  guard_name: string | null;
  guard_username: string | null;
  guard_role: string | null;
  ip: string | null;
  user_agent: string | null;
}

export interface SystemUpdate {
  id: string;
  headline: string;
  message: string;
  audience: string;
  published_by_email: string | null;
  published_at: string;
}

export interface ClosedDate {
  id: string;
  date: string;
  reason: string;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
}

export interface BlockedTime {
  id: string;
  office_id: string;
  date: string;
  time_slot: string;
  reason: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
}

export interface AvailabilitySlot {
  time: string;
  label: string;
  available: boolean;
  remaining: number;
}

export interface Database {
  public: {
    Tables: {
      offices: {
        Row: Office;
        Insert: Omit<Office, "id" | "created_at">;
        Update: Partial<Omit<Office, "id" | "created_at">>;
      };
      appointments: {
        Row: Appointment;
        Insert: Omit<Appointment, "id" | "created_at" | "updated_at" | "checked_out_at">;
        Update: Partial<Omit<Appointment, "id" | "created_at" | "updated_at">>;
      };
      appointment_visitors: {
        Row: AppointmentVisitor;
        Insert: Omit<AppointmentVisitor, "id" | "created_at">;
        Update: Partial<Omit<AppointmentVisitor, "id" | "created_at" | "appointment_id">>;
      };
      appointment_vehicles: {
        Row: AppointmentVehicle;
        Insert: Omit<AppointmentVehicle, "id" | "created_at">;
        Update: Partial<Omit<AppointmentVehicle, "id" | "created_at" | "appointment_id">>;
      };
      admins: {
        Row: Admin;
        Insert: Omit<Admin, "id" | "created_at">;
        Update: Partial<Omit<Admin, "id" | "created_at">>;
      };
      sign_in_logs: {
        Row: SignInLog;
        Insert: Partial<Omit<SignInLog, "id" | "created_at">> & Pick<SignInLog, "portal" | "success">;
        Update: Partial<Omit<SignInLog, "id">>;
      };
      email_logs: {
        Row: EmailLog;
        Insert: Omit<EmailLog, "id" | "created_at">;
        Update: Partial<Omit<EmailLog, "id" | "created_at">>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, "id" | "created_at">;
        Update: Partial<Omit<AuditLog, "id" | "created_at">>;
      };
blocked_times: {
        Row: BlockedTime;
        Insert: Omit<BlockedTime, "id" | "created_at">;
        Update: Partial<Omit<BlockedTime, "id" | "created_at">>;
      };
      entry_logs: {
        Row: EntryLog;
        Insert: Partial<Omit<EntryLog, "id" | "created_at">> & Pick<EntryLog, "event" | "result">;
        Update: Partial<Omit<EntryLog, "id">>;
      };
      system_updates: {
        Row: SystemUpdate;
        Insert: Omit<SystemUpdate, "id" | "published_at"> & { published_at?: string };
        Update: Partial<Omit<SystemUpdate, "id">>;
      };
      closed_dates: {
        Row: ClosedDate;
        Insert: Omit<ClosedDate, "id" | "created_at">;
        Update: Partial<Omit<ClosedDate, "id" | "created_at">>;
      };
      office_contacts: {
        Row: OfficeContact;
        Insert: Omit<OfficeContact, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<OfficeContact, "id" | "created_at" | "updated_at">>;
      };
      appointment_contacts: {
        Row: AppointmentContact;
        Insert: Omit<AppointmentContact, "id" | "created_at">;
        Update: Partial<Omit<AppointmentContact, "id" | "created_at" | "appointment_id">>;
      };
    };
  };
}
