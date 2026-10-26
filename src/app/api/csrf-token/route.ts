import { NextResponse } from "next/server";
import { generateCsrfToken } from "@/lib/csrf";

export async function GET(request: Request) {
  try {
    const token = await generateCsrfToken(request);
    return NextResponse.json({ csrfToken: token });
  } catch {
    console.error("Failed to generate CSRF token");
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
