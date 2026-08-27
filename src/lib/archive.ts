import { createServiceClient } from "@/lib/supabase/server";
import { getMySQLPool } from "@/lib/mysql";

const STATUS_KEYS: { status: string; settingKey: string }[] = [
  { status: "approved", settingKey: "archive_approved" },
  { status: "declined", settingKey: "archive_declined" },
  { status: "completed", settingKey: "archive_completed" },
  { status: "expired", settingKey: "archive_expired" },
];

async function getArchivableStatuses(supabase: ReturnType<typeof createServiceClient>): Promise<string[]> {
  const { data } = await supabase.from("system_settings").select("key, value").in("key", STATUS_KEYS.map((s) => s.settingKey));
  const settingsMap = new Map(data?.map((r) => [r.key, r.value]) || []);
  return STATUS_KEYS.filter((s) => settingsMap.get(s.settingKey) !== "false").map((s) => s.status);
}

export interface ArchiveResult {
  recordsSynced: number;
  recordsSkipped: number;
  imagesSynced: number;
  durationMs: number;
  status: "success" | "error";
  error?: string;
}

export async function runArchiveSync(): Promise<ArchiveResult> {
  const start = Date.now();
  const supabase = createServiceClient();
  const pool = getMySQLPool();

  const archivableStatuses = await getArchivableStatuses(supabase);
  if (archivableStatuses.length === 0) {
    return { recordsSynced: 0, recordsSkipped: 0, imagesSynced: 0, durationMs: 0, status: "success" };
  }

  const { data: appointments, error: fetchError } = await supabase
    .from("appointments")
    .select("*")
    .in("status", archivableStatuses)
    .order("created_at", { ascending: true })
    .limit(500);

  if (fetchError) {
    return { recordsSynced: 0, recordsSkipped: 0, imagesSynced: 0, durationMs: Date.now() - start, status: "error", error: fetchError.message };
  }

  if (!appointments || appointments.length === 0) {
    return { recordsSynced: 0, recordsSkipped: 0, imagesSynced: 0, durationMs: Date.now() - start, status: "success" };
  }

  const appointmentIds = appointments.map((a) => a.id);
  const officeIds = [...new Set(appointments.map((a) => a.office_id).filter(Boolean))];

  const { data: offices } = await supabase
    .from("offices")
    .select("id, name")
    .in("id", officeIds);

  const officeNameMap = new Map<string, string>();
  offices?.forEach((o) => officeNameMap.set(o.id, o.name));

  const { data: emailLogs } = await supabase
    .from("email_logs")
    .select("*")
    .in("appointment_id", appointmentIds);

  const emailLogMap = new Map<string, typeof emailLogs>();
  emailLogs?.forEach((log) => {
    if (!emailLogMap.has(log.appointment_id)) emailLogMap.set(log.appointment_id, []);
    emailLogMap.get(log.appointment_id)!.push(log);
  });

  const pool2 = getMySQLPool();
  const [existingRows] = await pool2.query(
    `SELECT id, id_image IS NOT NULL as has_image FROM archived_appointments WHERE id IN (${appointmentIds.map(() => "?").join(",")})`,
    appointmentIds
  );
  const existingMap = new Map<string, boolean>(
    (existingRows as { id: string; has_image: boolean }[]).map((r) => [r.id, !!r.has_image])
  );

  let imagesSynced = 0;
  let recordsSkipped = 0;
  const imagePathsToDelete: string[] = [];
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    for (const apt of appointments) {
      const hasExistingImage = existingMap.get(apt.id) === true;

      let imageBuffer: Buffer | null = null;
      let storagePath: string | null = null;

      if (apt.id_image_url && !hasExistingImage) {
        try {
          const marker = "/storage/v1/object/public/id-cards/";
          const idx = apt.id_image_url.indexOf(marker);
          storagePath = idx !== -1
            ? apt.id_image_url.substring(idx + marker.length)
            : apt.id_image_url;

          const { data: blob, error: dlError } = await supabase.storage
            .from("id-cards")
            .download(storagePath!);
          if (!dlError && blob) {
            const arrayBuffer = await blob.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
            imagesSynced++;
          } else {
            console.error(`Image download failed for ${apt.id}:`, dlError?.message);
          }
        } catch (imgErr) {
          console.error(`Image download error for ${apt.id}:`, imgErr);
        }
      }

      if (hasExistingImage) {
        await conn.execute(
          `INSERT INTO archived_appointments
            (id, full_name, phone, email, id_image, visitor_category, purpose_of_visit,
             office_id, office_name, date, time_slot, duration, status, qr_token,
             qr_used_at, scanned_at, decline_reason, created_at, updated_at, archived_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             full_name=VALUES(full_name), status=VALUES(status), archived_at=NOW()`,
          [
            apt.id, apt.full_name, apt.phone, apt.email,
            apt.visitor_category || "general_public", apt.purpose_of_visit || null,
            apt.office_id, officeNameMap.get(apt.office_id) || null, apt.date, apt.time_slot, apt.duration, apt.status,
            apt.qr_token, apt.qr_used_at || null, apt.scanned_at || null,
            apt.decline_reason || null, apt.created_at, apt.updated_at,
          ]
        );
        recordsSkipped++;
        if (apt.id_image_url) {
          const marker = "/storage/v1/object/public/id-cards/";
          const idx = apt.id_image_url.indexOf(marker);
          if (idx !== -1) {
            imagePathsToDelete.push(apt.id_image_url.substring(idx + marker.length));
          }
        }
      } else {
        await conn.execute(
          `INSERT INTO archived_appointments
            (id, full_name, phone, email, id_image, visitor_category, purpose_of_visit,
             office_id, office_name, date, time_slot, duration, status, qr_token,
             qr_used_at, scanned_at, decline_reason, created_at, updated_at, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             full_name=VALUES(full_name), status=VALUES(status),
             id_image=COALESCE(VALUES(id_image), id_image), archived_at=NOW()`,
          [
            apt.id, apt.full_name, apt.phone, apt.email, imageBuffer,
            apt.visitor_category || "general_public", apt.purpose_of_visit || null,
            apt.office_id, officeNameMap.get(apt.office_id) || null, apt.date, apt.time_slot, apt.duration, apt.status,
            apt.qr_token, apt.qr_used_at || null, apt.scanned_at || null,
            apt.decline_reason || null, apt.created_at, apt.updated_at,
          ]
        );
      }

      if (storagePath && imageBuffer) {
        imagePathsToDelete.push(storagePath);
      }

      const logs = emailLogMap.get(apt.id) || [];
      for (const log of logs) {
        await conn.execute(
          `INSERT INTO archived_email_logs (id, appointment_id, type, status, sent_at, error_message, created_at, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE status=VALUES(status), archived_at=NOW()`,
          [log.id, log.appointment_id, log.type, log.status, log.sent_at || null, log.error_message || null, log.created_at]
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    return {
      recordsSynced: 0,
      recordsSkipped: 0,
      imagesSynced: 0,
      durationMs: Date.now() - start,
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    conn.release();
  }

  const supabaseIds = appointments.map((a) => a.id);
  await supabase
    .from("appointments")
    .update({ archived: true })
    .in("id", supabaseIds);

  if (imagePathsToDelete.length > 0) {
    await supabase.storage.from("id-cards").remove(imagePathsToDelete);
  }

  const durationMs = Date.now() - start;
  const recordsSynced = appointments.length;

  await pool.execute(
    `INSERT INTO archive_sync_log (records_synced, images_synced, duration_ms, status) VALUES (?, ?, ?, 'success')`,
    [recordsSynced, imagesSynced, durationMs]
  ).catch(() => {});

  return {
    recordsSynced,
    recordsSkipped,
    imagesSynced,
    durationMs,
    status: "success",
  };
}
