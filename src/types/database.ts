export type AppointmentStatus = "pending" | "approved" | "declined" | "completed" | "expired";
export type AdminRole = "super_admin" | "office_admin";
export type AuditAction = "approve" | "decline" | "create_account" | "delete_account" | "create_office" | "update_office" | "delete_office" | "block_time" | "unblock_time";

export interface Office {
  id: string;
  name: string;
  email: string | null;
  description: string | null;
  operating_hours: string;
  capacity_per_slot: number;
  active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  id_image_url: string;
  office_id: string;
  date: string;
  time_slot: string;
  duration: 30 | 60;
  status: AppointmentStatus;
  qr_token: string | null;
  qr_used_at: string | null;
  decline_reason: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  office?: Office;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  office_id: string | null;
  created_at: string;
}

export interface EmailLog {
  id: string;
  appointment_id: string;
  type: "confirmation" | "admin_alert" | "approval" | "decline";
  status: "pending" | "sent" | "failed";
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
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
        Insert: Omit<Appointment, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Appointment, "id" | "created_at" | "updated_at">>;
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
    };
  };
}
