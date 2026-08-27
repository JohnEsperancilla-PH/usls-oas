import { NextResponse } from "next/server";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not available in production" }, { status: 404 });
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = createServiceClient();

    const offices = [
      { name: "Office of the Registrar", email: "registrar@usls.edu.ph", description: "Handles student records, enrollment, and academic documents.", operating_hours: "Monday to Friday, 8:00 AM - 5:00 PM", capacity_per_slot: 10 },
      { name: "Office of the Student Affairs", email: "dsa@usls.edu.ph", description: "Student welfare, organizations, and campus activities.", operating_hours: "Monday to Friday, 8:00 AM - 5:00 PM", capacity_per_slot: 15 },
      { name: "Office of the University Registrar", email: "our@usls.edu.ph", description: "Official university records and transcripts.", operating_hours: "Monday to Friday, 8:00 AM - 5:00 PM", capacity_per_slot: 8 },
      { name: "Guidance and Counseling Center", email: "guidance@usls.edu.ph", description: "Student counseling, career guidance, and mental health support.", operating_hours: "Monday to Friday, 8:00 AM - 5:00 PM", capacity_per_slot: 5 },
      { name: "Finance Office", email: "finance@usls.edu.ph", description: "Tuition payments, fees, and financial assistance.", operating_hours: "Monday to Friday, 8:00 AM - 5:00 PM", capacity_per_slot: 12 },
    ];

    for (const office of offices) {
      await supabase.from("offices").insert(office);
    }

    return NextResponse.json({ message: `Seeded ${offices.length} offices successfully` });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }
}
