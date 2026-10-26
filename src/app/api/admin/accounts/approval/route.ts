import { NextResponse, after } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireSuperAdmin, logAudit } from "@/lib/rbac";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import { generateAccountApprovedEmail, sendMail } from "@/lib/email";

// Super admins approve or reject self-registered office admin accounts.
// Rejecting deletes the pending account so the email can register again.
export async function POST(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    const decision = body.decision;
    if (!id || (decision !== "approve" && decision !== "reject")) {
      return NextResponse.json({ message: "Account ID and a decision (approve or reject) are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: target, error: fetchError } = await supabase
      .from("admins")
      .select("*, offices(name)")
      .eq("id", id)
      .single();

    if (fetchError || !target) {
      return NextResponse.json({ message: "Account not found" }, { status: 404 });
    }
    if (target.approval_status !== "pending") {
      return NextResponse.json({ message: "This account is not waiting for approval" }, { status: 409 });
    }

    const officeName: string = target.offices?.name || "your office";

    if (decision === "approve") {
      const { data: updated, error: updateError } = await supabase
        .from("admins")
        .update({ approval_status: "approved" })
        .eq("id", id)
        .eq("approval_status", "pending")
        .select("id")
        .maybeSingle();

      if (updateError) {
        return NextResponse.json({ message: "Failed to approve the account" }, { status: 500 });
      }
      if (!updated) {
        return NextResponse.json({ message: "This account is not waiting for approval" }, { status: 409 });
      }

      await logAudit(admin.id, admin.email, "approve_account", {
        target_email: target.email,
        office_id: target.office_id || undefined,
        meta: { name: target.name, role: target.role, office_name: officeName },
      });

      const origin = new URL(request.url).origin;
      after(async () => {
        try {
          const message = await generateAccountApprovedEmail(target.name || target.email, officeName, origin);
          const result = await sendMail({
            to: target.email,
            subject: "Your USLS OASYS admin account was approved",
            html: message.html,
            attachments: message.attachments,
          });
          if (!result.success) console.error(`Failed to send account approved email to ${target.email}`);
        } catch (err) {
          console.error("Failed to send account approved email:", err);
        }
      });

      return NextResponse.json({ message: "Account approved" });
    }

    const { error: deleteAdminError } = await supabase
      .from("admins")
      .delete()
      .eq("id", id)
      .eq("approval_status", "pending");

    if (deleteAdminError) {
      return NextResponse.json({ message: "Failed to reject the account" }, { status: 500 });
    }

    // Self-registered admins share their id with the auth user.
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(id);
    if (deleteUserError) {
      console.error(`Rejected admin ${target.email} but could not delete the auth user:`, deleteUserError.message);
    }

    await logAudit(admin.id, admin.email, "reject_account", {
      target_email: target.email,
      office_id: target.office_id || undefined,
      meta: { name: target.name, role: target.role, office_name: officeName },
    });

    return NextResponse.json({ message: "Account rejected" });
  } catch (error) {
    return handleRouteError(error);
  }
}
