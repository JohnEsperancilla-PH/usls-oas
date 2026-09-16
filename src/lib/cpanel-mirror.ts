import { getMySQLPool } from "@/lib/mysql";

export interface CpanelAppointment {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  valid_id: string | null;
  visitor_category: string;
  purpose_of_visit: string | null;
  person_to_meet: string | null;
  office_id: string;
  office_name: string | null;
  date: string;
  time_slot: string;
  duration: number;
  status: string;
  qr_token: string | null;
  qr_used_at: string | null;
  scanned_at: string | null;
  decline_reason: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export function buildCpanelAppointment(fields: Partial<CpanelAppointment> & Pick<CpanelAppointment, "id" | "full_name" | "office_id" | "date" | "time_slot" | "duration" | "status" | "created_at" | "updated_at">): CpanelAppointment {
  return {
    phone: "",
    email: "",
    valid_id: null,
    visitor_category: "general_public",
    purpose_of_visit: null,
    person_to_meet: null,
    office_name: null,
    qr_token: null,
    qr_used_at: null,
    scanned_at: null,
    decline_reason: null,
    archived: false,
    ...fields,
  };
}

export function fromAppointmentRow(
  row: {
    id: string;
    full_name: string;
    phone: string;
    email: string;
    valid_id?: string | null;
    visitor_category?: string | null;
    purpose_of_visit?: string | null;
    person_to_meet?: string | null;
    office_id: string;
    date: string;
    time_slot: string;
    duration: number;
    status: string;
    qr_token?: string | null;
    qr_used_at?: string | null;
    scanned_at?: string | null;
    decline_reason?: string | null;
    archived?: boolean;
    created_at: string;
    updated_at?: string | null;
    offices?: { name?: string | null } | null;
  },
  overrides?: Partial<CpanelAppointment>
): CpanelAppointment {
  return buildCpanelAppointment({
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    valid_id: row.valid_id ?? null,
    visitor_category: row.visitor_category || "general_public",
    purpose_of_visit: row.purpose_of_visit ?? null,
    person_to_meet: row.person_to_meet ?? null,
    office_id: row.office_id,
    office_name: row.offices?.name ?? null,
    date: row.date,
    time_slot: row.time_slot,
    duration: row.duration,
    status: row.status,
    qr_token: row.qr_token ?? null,
    qr_used_at: row.qr_used_at ?? null,
    scanned_at: row.scanned_at ?? null,
    decline_reason: row.decline_reason ?? null,
    archived: row.archived ?? false,
    created_at: row.created_at,
    updated_at: row.updated_at ?? new Date().toISOString(),
    ...overrides,
  });
}

export async function mirrorAppointmentToCpanel(apt: CpanelAppointment): Promise<void> {
  try {
    const pool = getMySQLPool();
    await pool.execute(
      `INSERT INTO appointments
        (id, full_name, phone, email, valid_id, visitor_category, purpose_of_visit,
         person_to_meet, office_id, office_name, date, time_slot, duration, status,
         qr_token, qr_used_at, scanned_at, decline_reason, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         full_name=VALUES(full_name), phone=VALUES(phone), email=VALUES(email),
         valid_id=VALUES(valid_id), visitor_category=VALUES(visitor_category),
         purpose_of_visit=VALUES(purpose_of_visit), person_to_meet=VALUES(person_to_meet),
         office_id=VALUES(office_id), office_name=VALUES(office_name), date=VALUES(date),
         time_slot=VALUES(time_slot), duration=VALUES(duration), status=VALUES(status),
         qr_token=VALUES(qr_token), qr_used_at=VALUES(qr_used_at),
         scanned_at=VALUES(scanned_at), decline_reason=VALUES(decline_reason),
         archived=VALUES(archived), created_at=VALUES(created_at), updated_at=VALUES(updated_at)`,
      [
        apt.id, apt.full_name, apt.phone, apt.email, apt.valid_id,
        apt.visitor_category, apt.purpose_of_visit, apt.person_to_meet, apt.office_id,
        apt.office_name, apt.date, apt.time_slot, apt.duration, apt.status, apt.qr_token,
        apt.qr_used_at, apt.scanned_at, apt.decline_reason, apt.archived,
        apt.created_at, apt.updated_at,
      ]
    );
  } catch (error) {
    console.error(`Mirror write to cPanel failed for appointment ${apt.id}:`, error);
  }
}