import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface AuthCheckRequest {
  email: string;
}

export async function POST(request: Request) {
  try {
    const body: AuthCheckRequest = await request.json();

    if (!body.email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: admin, error } = await supabase
      .from("admins")
      .select("*, offices(name)")
      .eq("email", body.email)
      .single();

    if (error || !admin) {
      return NextResponse.json({ authorized: false, message: "Not an admin" }, { status: 403 });
    }

    return NextResponse.json({ authorized: true, admin });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
