import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

// All offices run a fixed 8:00 AM - 5:00 PM day, enforced at slot-generation
// time so it applies to every office automatically, including offices created
// in the future.
const OFFICE_START_HOUR = 8;
const OFFICE_END_HOUR = 17;

// Default daily lunch break (12:00 PM - 1:30 PM). These slots are never
// bookable and never blockable.
const LUNCH_START_MINUTES = 12 * 60; // 12:00
const LUNCH_END_MINUTES = 13 * 60 + 30; // 13:30

function generateSlots(startH: number, endH: number): string[] {
  const slots: string[] = [];
  for (let h = startH; h < endH; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === endH - 1 && m + 30 > 60) break;
      const minutes = h * 60 + m;
      if (minutes >= LUNCH_START_MINUTES && minutes < LUNCH_END_MINUTES) continue;
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return slots;
}

function getNextSlot(timeSlot: string, allSlots: string[]): string | null {
  const [h, m] = timeSlot.split(":").map(Number);
  const nextM = m + 30;
  const nextH = nextM >= 60 ? h + 1 : h;
  const nextMM = nextM >= 60 ? nextM - 60 : nextM;
  const next = `${nextH.toString().padStart(2, "0")}:${nextMM.toString().padStart(2, "0")}`;
  return allSlots.includes(next) ? next : null;
}

function buildSlotCounts(appointments: { time_slot: string; duration: number }[], allSlots: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of appointments) {
    counts[a.time_slot] = (counts[a.time_slot] || 0) + 1;
    if (a.duration === 60) {
      const next = getNextSlot(a.time_slot, allSlots);
      if (next) counts[next] = (counts[next] || 0) + 1;
    }
  }
  return counts;
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

    const allSlots = generateSlots(OFFICE_START_HOUR, OFFICE_END_HOUR);

    // If month is provided, return which dates have availability
    if (month && !date) {
      const [year, mon] = month.split("-").map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();
      const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(mon).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

      const { data: appointments } = await supabase
        .from("appointments")
        .select("date, time_slot, duration, status")
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

      const appointmentsByDate: Record<string, { time_slot: string; duration: number }[]> = {};
      (appointments || []).forEach((a) => {
        if (!appointmentsByDate[a.date]) appointmentsByDate[a.date] = [];
        appointmentsByDate[a.date].push({ time_slot: a.time_slot, duration: a.duration });
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

        const dayAppointments = appointmentsByDate[ds] || [];
        const appointmentCounts = buildSlotCounts(dayAppointments, allSlots);

        let availableCount = 0;
        for (const slot of allSlots) {
          const booked = appointmentCounts[slot] || 0;
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
        .select("time_slot, duration, status")
        .eq("office_id", officeId)
        .eq("date", date)
        .in("status", ["pending", "approved"]);

      const { data: blocked } = await supabase
        .from("blocked_times")
        .select("time_slot, reason")
        .eq("office_id", officeId)
        .eq("date", date);

      const appointmentCounts = buildSlotCounts(
        (appointments || []).map((a) => ({ time_slot: a.time_slot, duration: a.duration })),
        allSlots
      );

      const blockedMap: Record<string, string | null> = {};
      (blocked || []).forEach((b) => {
        blockedMap[b.time_slot] = b.reason;
      });

      const nowMs = Date.now();

      const slots = allSlots.map((s) => {
        // date/time_slot are Asia/Manila wall-clock; build the UTC instant
        // explicitly so Vercel (UTC server) and local machines agree.
        const slotInstant = new Date(`${date}T${s}:00+08:00`).getTime();
        const past = slotInstant <= nowMs;
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
    return handleRouteError(error);
  }
}

function formatSlotLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m.toString().padStart(2, "0")} ${period}`;
}
