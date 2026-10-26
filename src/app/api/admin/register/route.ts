import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { validateOfficeAdminEmail } from "@/lib/admin-email";
import { logAudit } from "@/lib/rbac";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_NAME_LENGTH = 100;

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function findExistingAdmin(
  supabase: ReturnType<typeof createServiceClient>,
  email: string
): Promise<{ exists: boolean; error?: boolean }> {
  const { data, error } = await supabase.from("admins").select("id, email");

  if (error) return { exists: false, error: true };

  const normalizedEmail = email.toLowerCase();
  return {
    exists: (data || []).some(
      (admin) => admin.email?.toLowerCase() === normalizedEmail
    ),
  };
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`register-check:${ip}`, 30, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse();

  try {
    const { searchParams } = new URL(request.url);
    const emailResult = validateOfficeAdminEmail(searchParams.get("email") || "");

    if (!emailResult.ok) {
      return NextResponse.json(
        { valid: false, exists: false, message: emailResult.message },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const result = await findExistingAdmin(supabase, emailResult.email);

    if (result.error) {
      return NextResponse.json(
        { message: "Failed to check account availability" },
        { status: 500 }
      );
    }

    return NextResponse.json({ valid: true, exists: result.exists });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  const ip = getClientIp(request);

  const ipLimit = checkRateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
  if (!ipLimit.allowed) return rateLimitResponse();

  try {
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const officeId = typeof body.officeId === "string" ? body.officeId.trim() : "";
    const emailResult = validateOfficeAdminEmail(
      typeof body.email === "string" ? body.email : ""
    );

    if (!emailResult.ok) {
      return NextResponse.json({ message: emailResult.message }, { status: 400 });
    }

    const email = emailResult.email;

    const emailLimit = checkRateLimit(`register-email:${email}`, 3, 60 * 60 * 1000);
    if (!emailLimit.allowed) return rateLimitResponse();

    if (!name) {
      return NextResponse.json({ message: "Full name is required" }, { status: 400 });
    }
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { message: `Full name is too long (max ${MAX_NAME_LENGTH} characters)` },
        { status: 400 }
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: `Password is too long (max ${MAX_PASSWORD_LENGTH} characters)` },
        { status: 400 }
      );
    }
    if (!officeId || !UUID_PATTERN.test(officeId)) {
      return NextResponse.json({ message: "Please select an office" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const existingAdmin = await findExistingAdmin(supabase, email);

    if (existingAdmin.error) {
      return NextResponse.json(
        { message: "Failed to verify account availability" },
        { status: 500 }
      );
    }
    if (existingAdmin.exists) {
      return NextResponse.json(
        { message: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const { data: office, error: officeError } = await supabase
      .from("offices")
      .select("id, name, active")
      .eq("id", officeId)
      .maybeSingle();

    if (officeError) {
      return NextResponse.json({ message: "Failed to verify office" }, { status: 500 });
    }
    if (!office || !office.active) {
      return NextResponse.json(
        { message: "The selected office is not available" },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      const alreadyRegistered = /already|exists|registered/i.test(authError.message);
      return NextResponse.json(
        {
          message: alreadyRegistered
            ? "An account with this email already exists"
            : authError.message,
        },
        { status: alreadyRegistered ? 409 : 400 }
      );
    }

    const userId = authData.user.id;
    const adminEmail = authData.user.email || email;

    const { error: insertError } = await supabase.from("admins").insert({
      id: userId,
      name,
      email: adminEmail,
      employee_id: null,
      role: "office_admin",
      office_id: officeId,
    });

    if (insertError) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { message: "Failed to create admin account" },
        { status: 500 }
      );
    }

    await logAudit(null, adminEmail, "create_account", {
      target_email: adminEmail,
      office_id: officeId,
      meta: {
        name,
        role: "office_admin",
        source: "self_registration",
        office_name: office.name,
        ip,
      },
    });

    return NextResponse.json(
      { message: "Account created", userId },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
