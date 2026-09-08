import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from("offices")
      .select("*")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error(error);
      return NextResponse.json(
        { message: "Failed to fetch offices" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}