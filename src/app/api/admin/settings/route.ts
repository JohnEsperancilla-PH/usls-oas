import { NextResponse } from "next/server";
import { getAuthAdmin, requireSuperAdmin } from "@/lib/rbac";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ message: error }, { status });

  const supabase = createServiceClient();
  const { data, error: dbError } = await supabase
    .from("system_settings")
    .select("key, value");

  if (dbError) return NextResponse.json({ message: dbError.message }, { status: 500 });

  const settings: Record<string, string> = {};
  data?.forEach((row) => { settings[row.key] = row.value; });

  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ message: error }, { status });

  const access = requireSuperAdmin(admin);
  if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

  const body = await request.json();
  const supabase = createServiceClient();

  const updates = Object.entries(body).map(([key, value]) =>
    supabase
      .from("system_settings")
      .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: "key" })
  );

  await Promise.all(updates);

  return NextResponse.json({ message: "Settings updated" });
}
