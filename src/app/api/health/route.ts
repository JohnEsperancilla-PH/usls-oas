import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { timingSafeEqual } from "crypto";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-cron-secret");

  const expected = process.env.CRON_HEALTH_TOKEN;
  if (expected) {
    if (!token) {
      return NextResponse.json({ status: "unauthorized" }, { status: 401 });
    }
    
    const isValid = token.length === expected.length && timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expected)
    );
    
    if (!isValid) {
      return NextResponse.json({ status: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();

  try {
    const now = new Date().toISOString();

    const { error } = await supabase.from("app_health").insert({
      source: "cron",
      status: "ok",
      region: process.env.VERCEL_REGION || null,
      details: {
        time: now,
        vercel_region: process.env.VERCEL_REGION || null,
        deployment_id: process.env.VERCEL_DEPLOYMENT_ID || null,
      },
    });

    if (error) {
      console.error("Health check database error");
      return NextResponse.json({ status: "error" }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", time: now });
  } catch (error) {
    console.error("Health check error");
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
