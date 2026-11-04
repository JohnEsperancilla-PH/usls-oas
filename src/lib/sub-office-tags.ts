import { createServiceClient } from "@/lib/supabase/server";
import { generateSubOfficeTagEmail, sendMail } from "@/lib/email";

interface TaggedAppointment {
  id: string;
  office_id: string;
  full_name: string;
  date: string;
  time_slot: string | null;
  status: string;
}

// Keeps only ids that are sub-offices of the appointment's office.
export async function filterSubOfficeIds(officeId: string, ids: unknown): Promise<string[] | null> {
  if (!Array.isArray(ids)) return [];
  const wanted = [...new Set(ids.map(String).filter(Boolean))];
  if (wanted.length === 0) return [];

  const supabase = createServiceClient();
  const { data } = await supabase.from("offices").select("id").eq("parent_office_id", officeId).in("id", wanted);
  return (data || []).length === wanted.length ? wanted : null;
}

// Emails each newly tagged sub-office's inbox and its approved admin accounts.
export async function notifyTaggedSubOffices(appointment: TaggedAppointment, officeIds: string[], baseUrl: string) {
  if (officeIds.length === 0) return;
  const supabase = createServiceClient();

  const [{ data: mainOffice }, { data: subOffices }, { data: admins }] = await Promise.all([
    supabase.from("offices").select("name").eq("id", appointment.office_id).maybeSingle(),
    supabase.from("offices").select("id, name, email").in("id", officeIds),
    supabase.from("admins").select("email, office_id, approval_status").in("office_id", officeIds),
  ]);

  for (const subOffice of subOffices || []) {
    const recipients = new Set<string>();
    if (subOffice.email) recipients.add(subOffice.email);
    for (const admin of admins || []) {
      if (admin.office_id === subOffice.id && admin.approval_status !== "pending" && admin.email) recipients.add(admin.email);
    }
    if (recipients.size === 0) continue;

    try {
      const message = await generateSubOfficeTagEmail(subOffice.name, mainOffice?.name || "The main office", appointment.full_name,
        appointment.date, appointment.time_slot, appointment.status, baseUrl);
      for (const to of recipients) {
        const result = await sendMail({
          to,
          subject: `Tagged on an Appointment - ${appointment.full_name} - ${subOffice.name} - USLS OASYS`,
          html: message.html,
          attachments: message.attachments,
        });
        if (!result.success) console.error(`Failed to send sub-office tag email to ${to}`);
      }
    } catch (err) {
      console.error("Failed to send sub-office tag email:", err);
    }
  }
}
