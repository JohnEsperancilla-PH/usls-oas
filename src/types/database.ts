export type AppointmentStatus = "pending" | "approved" | "declined" | "postponed" | "entry_denied" | "completed" | "expired";
export type AdminRole = "super_admin" | "office_admin" | "gate_user";
export type VisitorCategory = "external" | "parents" | "alumni" | "vendor";
export type AuditAction = "approve" | "decline" | "postpone" | "entry" | "checkout" | "entry_denied" | "create_account" | "delete_account" | "create_office" | "update_office" | "delete_office" | "block_time" | "unblock_time" | "reset_qr" | "archive_sync" | "login" | "create_invitation" | "create_contact" | "update_contact" | "delete_contact";

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
  time_slot: string;
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
  created_at: string;
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
