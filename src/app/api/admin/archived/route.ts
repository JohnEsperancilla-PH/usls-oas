import { NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/rbac";
import { getMySQLPool } from "@/lib/mysql";

export async function GET(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ message: error }, { status });

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const officeId = url.searchParams.get("officeId") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50") || 50));
  const offset = (page - 1) * limit;

  try {
    const pool = getMySQLPool();
    let where = "WHERE 1=1";
    const params: (string | number)[] = [];

    if (admin.role !== "super_admin" && admin.office_id) {
      where += " AND office_id = ?";
      params.push(admin.office_id);
    } else if (officeId) {
      where += " AND office_id = ?";
      params.push(officeId);
    }

    if (search) {
      where += " AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM archived_appointments ${where}`, params);
    const total = (countRows as [{ total: number }])[0].total;

    const [rows] = await pool.query(
      `SELECT id, full_name, phone, email, visitor_category, purpose_of_visit, office_id, office_name, date, time_slot, duration, status, scanned_at, decline_reason, created_at, updated_at, archived_at
       FROM archived_appointments ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({ data: rows, total, page, limit });
  } catch (err) {
    console.error("Archived fetch error:", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Failed to fetch archived appointments", data: [], total: 0, debug: { host: process.env.MYSQL_HOST, db: process.env.MYSQL_DATABASE } },
      { status: 500 }
    );
  }
}
