import { NextResponse } from "next/server";
import { getAuthAdmin, requireSuperAdmin, logAudit } from "@/lib/rbac";
import { runArchiveSync } from "@/lib/archive";

export async function POST(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ message: error }, { status });

  const access = requireSuperAdmin(admin);
  if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

  const result = await runArchiveSync();

  if (result.status === "success") {
    await logAudit(admin.id, admin.email, "archive_sync", {
      meta: {
        records_synced: result.recordsSynced,
        images_synced: result.imagesSynced,
        duration_ms: result.durationMs,
      },
    });
  }

  return NextResponse.json({
    message: result.status === "success"
      ? `Archived ${result.recordsSynced} new records, ${result.recordsSkipped} already complete, ${result.imagesSynced} images in ${(result.durationMs / 1000).toFixed(1)}s`
      : `Archive failed: ${result.error}`,
    ...result,
  });
}
