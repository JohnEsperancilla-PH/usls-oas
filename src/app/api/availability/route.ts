import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function parseOperatingHours(hours: string): { startH: number; endH: number } {
  const match = hours.match(/(\d{1,2}):?\d{0,2}\s*(AM|PM)\s*[-–]\s*(\d{1,2}):?\d{0,2}\s*(AM|PM)/i);
  if (!match) return { startH: 8, endH: 17 };
  let startH = parseInt(match[1]);
  let endH = parseInt(match[3]);
  if (match[2].toUpperCase() === "PM" && startH < 12) startH += 12;
  if (match[2].toUpperCase() === "AM" && startH === 12) startH = 0;
  if (match[4].toUpperCase() === "PM" && endH < 12) endH += 12;
  if (match[4].toUpperCase() === "AM" && endH === 12) endH = 0;
  return { startH, endH };
}

function generateSlots(startH: number, endH: number): string[] {
  const slots: string[] = [];
  for (let h = startH; h < endH; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === endH - 1 && m + 30 > 60) break;
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return slots;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get("officeId");
    const date = searchParams.get("date");
    const month = searchParams.get("month"); // YYYY-MM format for calendar view

    if (!officeId) {
      return NextResponse.json({ message: "officeId is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: office, error: officeError } = await supabase
      .from("offices")
      .select("*")
      .eq("id", officeId)
      .eq("active", true)
      .single();

    if (officeError || !office) {
      return NextResponse.json({ message: "Office not found" }, { status: 404 });
    }

    const { startH, endH } = parseOperatingHours(office.operating_hours);
    const allSlots = generateSlots(startH, endH);

    // If month is provided, return which dates have availability
    if (month && !date) {
      const [year, mon] = month.split("-").map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();
      const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(mon).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

      const { data: appointments } = await supabase
        .from("appointments")
        .select("date, time_slot, status")
        .eq("office_id", officeId)
        .gte("date", startDate)
        .lte("date", endDate)
        .in("status", ["pending", "approved"]);

      const { data: blocked } = await supabase
        .from("blocked_times")
        .select("date, time_slot")
        .eq("office_id", officeId)
        .gte("date", startDate)
        .lte("date", endDate);

      const appointmentCounts: Record<string, Record<string, number>> = {};
      (appointments || []).forEach((a) => {
        if (!appointmentCounts[a.date]) appointmentCounts[a.date] = {};
        appointmentCounts[a.date][a.time_slot] = (appointmentCounts[a.date][a.time_slot] || 0) + 1;
      });

      const blockedSet: Record<string, Set<string>> = {};
      (blocked || []).forEach((b) => {
        if (!blockedSet[b.date]) blockedSet[b.date] = new Set();
        blockedSet[b.date].add(b.time_slot);
      });

      const availability: Record<string, { total: number; available: number }> = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${String(mon).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const dayOfWeek = new Date(year, mon - 1, d).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        let availableCount = 0;
        for (const slot of allSlots) {
          const booked = (appointmentCounts[ds] && appointmentCounts[ds][slot]) || 0;
          const isBlocked = blockedSet[ds]?.has(slot) || false;
          if (!isBlocked && booked < office.capacity_per_slot) {
            availableCount++;
          }
        }
        availability[ds] = { total: allSlots.length, available: availableCount };
      }

      return NextResponse.json({
        office: { id: office.id, name: office.name, operating_hours: office.operating_hours, capacity_per_slot: office.capacity_per_slot },
        slots: allSlots,
        availability,
      });
    }

    // If specific date is provided, return detailed slot availability
    if (date) {
      const dayOfWeek = new Date(date + "T00:00:00").getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return NextResponse.json({
          office: { id: office.id, name: office.name, operating_hours: office.operating_hours, capacity_per_slot: office.capacity_per_slot },
          slots: allSlots.map((s) => ({ time: s, label: formatSlotLabel(s), available: false, remaining: 0 })),
          date,
        });
      }

      const { data: appointments } = await supabase
        .from("appointments")
        .select("time_slot, status")
        .eq("office_id", officeId)
        .eq("date", date)
        .in("status", ["pending", "approved"]);

      const { data: blocked } = await supabase
        .from("blocked_times")
        .select("time_slot, reason")
        .eq("office_id", officeId)
        .eq("date", date);

      const appointmentCounts: Record<string, number> = {};
      (appointments || []).forEach((a) => {
        appointmentCounts[a.time_slot] = (appointmentCounts[a.time_slot] || 0) + 1;
      });

      const blockedMap: Record<string, string | null> = {};
      (blocked || []).forEach((b) => {
        blockedMap[b.time_slot] = b.reason;
      });

      const now = new Date();
      const isToday = date === now.toISOString().split("T")[0];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const slots = allSlots.map((s) => {
        const [h, m] = s.split(":").map(Number);
        const slotMinutes = h * 60 + m;
        const past = isToday && slotMinutes <= currentMinutes;
        const booked = appointmentCounts[s] || 0;
        const isBlocked = s in blockedMap;
        const remaining = Math.max(0, office.capacity_per_slot - booked);
        const available = !past && !isBlocked && remaining > 0;

        return {
          time: s,
          label: formatSlotLabel(s),
          available,
          remaining,
          blocked: isBlocked,
          blockReason: blockedMap[s] || null,
          past,
        };
      });

      return NextResponse.json({
        office: { id: office.id, name: office.name, operating_hours: office.operating_hours, capacity_per_slot: office.capacity_per_slot },
        slots,
        date,
      });
    }

    return NextResponse.json({ message: "Provide date or month parameter" }, { status: 400 });
  } catch (error) {
    console.error("Availability error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

function formatSlotLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m.toString().padStart(2, "0")} ${period}`;
}
