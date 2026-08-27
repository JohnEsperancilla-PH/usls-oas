import { getMySQLPool } from "@/lib/mysql";
import { getAuthAdmin } from "@/lib/rbac";

export async function GET(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return new Response(error, { status: status || 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  try {
    const pool = getMySQLPool();
    const [rows] = await pool.query(
      "SELECT id_image FROM archived_appointments WHERE id = ?",
      [id]
    );

    const result = (rows as [{ id_image: Buffer | null }])[0];
    if (!result?.id_image) {
      return new Response("No image", { status: 404 });
    }

    return new Response(new Uint8Array(result.id_image), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Failed to load image", { status: 500 });
  }
}
