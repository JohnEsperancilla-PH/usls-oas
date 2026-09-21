import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit } from "@/lib/rbac";
import { sanitizeName, sanitizeEmail } from "@/lib/sanitize";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import type { Database } from "@/types/database";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

function contactBody(body: Partial<Database["public"]["Tables"]["office_contacts"]["Insert"]>) {
  const name = sanitizeName(typeof body.name === "string" ? body.name : undefined, 255);
  const email = sanitizeEmail(typeof body.email === "string" ? body.email : undefined);
  const position = sanitizeName(typeof body.position === "string" ? body.position : undefined, 255);
  
  if (!name) return "Contact name is required";
  if (!email) return "Invalid contact email";
  if (position && position.length > 255) return "Position is too long (max 255 characters)";
  return null;
}

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    if (admin.role === "gate_user") return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get("officeId");

    if (admin.role === "office_admin") {
      if (!admin.office_id) return NextResponse.json({ message: "Office not assigned" }, { status: 403 });
      if (officeId && officeId !== admin.office_id) {
        return NextResponse.json({ message: "You can only view contacts for your office" }, { status: 403 });
      }
    } else if (!officeId) {
      return NextResponse.json({ message: "Office is required" }, { status: 400 });
    }

    const scopeOfficeId = admin.role === "office_admin" ? admin.office_id : officeId;

    const supabase = createServiceClient();
    const { data, error: fetchError } = await supabase
      .from("office_contacts")
      .select("*")
      .eq("office_id", scopeOfficeId)
      .eq("active", true)
      .order("name", { ascending: true });

    if (fetchError) {
      return NextResponse.json({ message: "Failed to fetch office contacts" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    if (admin.role === "gate_user") return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });

    const body = await request.json();
    const officeId = admin.role === "office_admin" ? admin.office_id : typeof body.officeId === "string" ? body.officeId : "";

    if (!officeId) {
      return NextResponse.json({ message: "Office is required" }, { status: 400 });
    }
    
    if (!isValidUUID(officeId)) {
      return NextResponse.json({ message: "Invalid office ID format" }, { status: 400 });
    }
    
    if (admin.role === "office_admin" && admin.office_id !== officeId) {
      return NextResponse.json({ message: "You can only add contacts to your office" }, { status: 403 });
    }

    const validationError = contactBody(body);
    if (validationError) return NextResponse.json({ message: validationError }, { status: 400 });

    const supabase = createServiceClient();

    const { data: office } = await supabase.from("offices").select("id").eq("id", officeId).single();
    if (!office) return NextResponse.json({ message: "Office not found" }, { status: 404 });

    const { data, error: insertError } = await supabase
      .from("office_contacts")
      .insert({
        office_id: officeId,
        name: body.name.trim(),
        email: body.email.trim(),
        position: body.position ? body.position.trim() : null,
        active: true,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ message: "Failed to create contact" }, { status: 500 });
    }

    await logAudit(admin.id, admin.email, "create_contact", {
      office_id: officeId,
      target_email: data.email,
      meta: { contact_name: data.name, position: data.position },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}