import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const DEFAULT_OFFICES = [
  { name: "Registrar", operating_hours: "8:00 AM - 5:00 PM", capacity_per_slot: 5, active: true },
  { name: "Student Affairs", operating_hours: "8:00 AM - 5:00 PM", capacity_per_slot: 3, active: true },
  { name: "Finance Office", operating_hours: "8:00 AM - 4:00 PM", capacity_per_slot: 4, active: true },
  { name: "Library", operating_hours: "7:00 AM - 8:00 PM", capacity_per_slot: 10, active: true },
  { name: "Admissions", operating_hours: "8:00 AM - 5:00 PM", capacity_per_slot: 2, active: true },
];

export async function POST() {
  try {
    const supabase = createServiceClient();

    // Check existing offices
    const { data: existing } = await supabase
      .from("offices")
      .select("name");

    const existingNames = new Set(existing?.map((o) => o.name) || []);
    const newOffices = DEFAULT_OFFICES.filter((o) => !existingNames.has(o.name));

    if (newOffices.length === 0) {
      return NextResponse.json({ message: "Offices already seeded", count: 0 });
    }

    const { data, error } = await supabase
      .from("offices")
      .insert(newOffices)
      .select();

    if (error) {
      console.error("Error seeding offices:", error);
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Seeded ${data.length} offices`,
      offices: data,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}