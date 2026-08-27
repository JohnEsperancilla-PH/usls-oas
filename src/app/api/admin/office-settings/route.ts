import { NextResponse } from "next/server";
import { getAuthAdmin, requireSuperAdmin } from "@/lib/rbac";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ message: error }, { status });

  const supabase = createServiceClient();
  let query = supabase
    .from("offices")
    .select("id, name, email, contact_email, contact_phone, active");

  if (admin.role !== "super_admin" && admin.office_id) {
    query = query.eq("id", admin.office_id);
  }

  const { data, error: dbError } = await query.order("name");
  if (dbError) return NextResponse.json({ message: dbError.message }, { status: 500 });

  return NextResponse.json(data || []);
}

export async function PUT(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ message: error }, { status });

  const access = requireSuperAdmin(admin);
  if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

  const { officeId, contact_email, contact_phone } = await request.json();
  if (!officeId) return NextResponse.json({ message: "Missing office ID" }, { status: 400 });

  const supabase = createServiceClient();
  const { error: updateError } = await supabase
    .from("offices")
    .update({ contact_email: contact_email || null, contact_phone: contact_phone || null })
    .eq("id", officeId);

  if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 });

  return NextResponse.json({ message: "Office contact info updated" });
}
