import { NextResponse } from "next/server";
import { generateCsrfToken } from "@/lib/csrf";

export async function GET() {
  try {
    const token = await generateCsrfToken();
    return NextResponse.json({ csrfToken: token });
  } catch (error) {
    console.error("Failed to generate CSRF token");
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
