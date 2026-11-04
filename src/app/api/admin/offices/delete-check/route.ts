import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { getAuthAdmin, requireSuperAdmin } from "@/lib/rbac";
import { getOfficeDeleteCheck } from "@/lib/office-delete";

// What permanently deleting an office would remove, and anything blocking it.
export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ message: "Office ID is required" }, { status: 400 });

    const result = await getOfficeDeleteCheck(id);
    if (!result) return NextResponse.json({ message: "Office not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
