import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { getAuthAdmin, requireSuperAdmin, logAudit } from "@/lib/rbac";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import {
  getMaintenanceState,
  saveMaintenanceSettings,
} from "@/lib/maintenance-server";
import {
  fromManilaInputValue,
  MAINTENANCE_DEFAULT_HEADLINE,
  MAINTENANCE_DEFAULT_MESSAGE,
} from "@/lib/maintenance";

const HEADLINE_MAX = 200;
const MESSAGE_MAX = 2000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toIso(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  return fromManilaInputValue(value.length === 10 ? `${value}T00:00` : value);
}

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    return NextResponse.json(await getMaintenanceState());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const access = requireSuperAdmin(admin);
    if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

    const body = await request.json();
    const before = await getMaintenanceState();

    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ message: "enabled must be a boolean" }, { status: 400 });
    }
    if (typeof body.scheduled !== "boolean") {
      return NextResponse.json({ message: "scheduled must be a boolean" }, { status: 400 });
    }

    const startAt = toIso(body.start);
    const endAt = toIso(body.end);
    if (startAt === undefined || endAt === undefined) {
      return NextResponse.json({ message: "Invalid maintenance window" }, { status: 400 });
    }

    if (body.scheduled && !startAt && !endAt) {
      return NextResponse.json(
        { message: "Set a start or end date when enabling a scheduled window" },
        { status: 400 }
      );
    }

    if (startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      return NextResponse.json(
        { message: "The maintenance window must end after it starts" },
        { status: 400 }
      );
    }

    const headline = typeof body.headline === "string" ? body.headline.trim() : MAINTENANCE_DEFAULT_HEADLINE;
    const message = typeof body.message === "string" ? body.message.trim() : MAINTENANCE_DEFAULT_MESSAGE;
    const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim() : "";

    if (!headline) {
      return NextResponse.json({ message: "Headline is required" }, { status: 400 });
    }
    if (headline.length > HEADLINE_MAX) {
      return NextResponse.json({ message: `Headline must be ${HEADLINE_MAX} characters or fewer` }, { status: 400 });
    }
    if (message.length > MESSAGE_MAX) {
      return NextResponse.json({ message: `Message must be ${MESSAGE_MAX} characters or fewer` }, { status: 400 });
    }
    if (contactEmail && !EMAIL_REGEX.test(contactEmail)) {
      return NextResponse.json({ message: "Contact email is not a valid address" }, { status: 400 });
    }

    await saveMaintenanceSettings({
      maintenance_enabled: String(body.enabled),
      maintenance_scheduled: String(body.scheduled),
      maintenance_start: startAt ?? "",
      maintenance_end: endAt ?? "",
      maintenance_headline: headline,
      maintenance_message: message || MAINTENANCE_DEFAULT_MESSAGE,
      maintenance_contact_email: contactEmail,
    });

    const after = await getMaintenanceState();

    const action = !before.active && after.active
      ? "enable_maintenance"
      : before.active && !after.active
        ? "disable_maintenance"
        : "update_maintenance";

    await logAudit(admin.id, admin.email, action, {
      meta: {
        active: after.active,
        reason: after.reason,
        scheduled: after.scheduled,
        startAt: after.startAt,
        endAt: after.endAt,
        headline: after.headline,
      },
    });

    return NextResponse.json({ message: "Maintenance settings updated", state: after });
  } catch (error) {
    return handleRouteError(error);
  }
}
