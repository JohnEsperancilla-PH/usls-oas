import { NextResponse } from "next/server";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not available in production" }, { status: 404 });
  }

  try {
    const { getMySQLPool } = await import("@/lib/mysql");
    const pool = getMySQLPool();

    const poolPromise = pool as unknown as { promise: () => Promise<unknown> };
    const connection = await poolPromise.promise();

    const setConn = connection as { query: (sql: string) => Promise<unknown> };
    await setConn.query("ALTER TABLE archived_appointments ADD COLUMN IF NOT EXISTS id_image MEDIUMBLOB");
    await setConn.query("ALTER TABLE archived_appointments ADD COLUMN IF NOT EXISTS archived_at DATETIME DEFAULT CURRENT_TIMESTAMP");

    return NextResponse.json({ message: "Archive schema updated successfully" });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Setup failed" },
      { status: 500 }
    );
  }
}
