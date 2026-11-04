"use client";

import { useState, useEffect } from "react";
import type { Office } from "@/types/database";
import { DEFAULT_BOOKING_RULES, getLatestBookableDate, type BookingRules } from "@/lib/booking-rules";
import { getManilaToday } from "@/lib/time";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DayAvailability {
  total: number;
  available: number;
}

interface SlotInfo {
  time: string;
  label: string;
  available: boolean;
  remaining: number;
  blocked?: boolean;
  blockReason?: string | null;
  past?: boolean;
  tooSoon?: boolean;
}

interface InvitationSchedulePickerProps {
  office: Office | undefined;
  date: string;
  timeSlot: string;
  duration: string;
  onChange: (next: { date?: string; timeSlot?: string; duration?: string }) => void;
}

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

function formatSlot(timeSlot: string): string {
  const [h, m] = timeSlot.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Used when live availability can't be loaded, so admins can still pick a time.
function fallbackSlots(office: Office): SlotInfo[] {
  const { startH, endH } = parseOperatingHours(office.operating_hours);
  const slots: SlotInfo[] = [];
  for (let h = startH; h < endH; h++) {
    for (const m of ["00", "30"]) {
      const time = `${String(h).padStart(2, "0")}:${m}`;
      slots.push({ time, label: formatSlot(time), available: true, remaining: office.capacity_per_slot });
    }
  }
  return slots;
}

export function InvitationSchedulePicker({ office, date, timeSlot, duration, onChange }: InvitationSchedulePickerProps) {
  const officeId = office?.id || "";
  const todayStr = getManilaToday();
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [y, m] = (date || todayStr).split("-").map(Number);
    return { year: y, month: m };
  });
  const [monthAvailability, setMonthAvailability] = useState<Record<string, DayAvailability>>({});
  const [closedDates, setClosedDates] = useState<Record<string, string>>({});
  const [weeklyClosed, setWeeklyClosed] = useState<Record<string, string>>({});
  const [daySlots, setDaySlots] = useState<SlotInfo[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [liveSlots, setLiveSlots] = useState(true);
  const [bookingRules, setBookingRules] = useState<BookingRules>(DEFAULT_BOOKING_RULES);

  useEffect(() => {
    if (!officeId) return;
    fetch(`/api/booking-rules?officeId=${encodeURIComponent(officeId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((rules) => { if (rules) setBookingRules(rules); })
      .catch(() => { /* keep defaults */ });
  }, [officeId]);

  useEffect(() => {
    if (!officeId) return;
    const m = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, "0")}`;
    let cancelled = false;
    fetch(`/api/availability?officeId=${encodeURIComponent(officeId)}&month=${m}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => { if (!cancelled) { setMonthAvailability(d?.availability || {}); setClosedDates(d?.closed || {}); setWeeklyClosed(d?.weeklyClosed || {}); } })
      .catch(() => { if (!cancelled) { setMonthAvailability({}); setClosedDates({}); setWeeklyClosed({}); } });
    return () => { cancelled = true; };
  }, [officeId, calendarMonth]);

  useEffect(() => {
    if (!office || !date) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingDay(true);
    fetch(`/api/availability?officeId=${encodeURIComponent(office.id)}&date=${date}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d) => { if (!cancelled) { setDaySlots(d.slots || []); setLiveSlots(true); } })
      .catch(() => { if (!cancelled) { setDaySlots(fallbackSlots(office)); setLiveSlots(false); } })
      .finally(() => { if (!cancelled) setLoadingDay(false); });
    return () => { cancelled = true; };
  }, [office, date]);

  // Dates past the public booking window show as "full" in the month data, but admins can still invite then.
  const latestDate = getLatestBookableDate(bookingRules, todayStr);

  const daysInMonth = new Date(calendarMonth.year, calendarMonth.month, 0).getDate();
  const firstDayOfWeek = new Date(calendarMonth.year, calendarMonth.month - 1, 1).getDay();
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const atCurrentMonth = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, "0")}` <= todayStr.slice(0, 7);
  const monthLabel = new Date(calendarMonth.year, calendarMonth.month - 1).toLocaleString("default", { month: "long", year: "numeric" });

  const shiftMonth = (delta: number) => {
    const index = calendarMonth.year * 12 + (calendarMonth.month - 1) + delta;
    setCalendarMonth({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  };

  const getDotColor = (ds: string) => {
    if (latestDate && ds > latestDate) return "";
    const avail = monthAvailability[ds];
    if (!avail) return "";
    if (avail.available === 0) return "bg-red-300";
    if (avail.available <= 3) return "bg-amber-300";
    return "bg-green-300";
  };

  const selectedSlot = daySlots.find((s) => s.time === timeSlot);

  // Weekly closures read "every Wednesday"; only one-off closed dates are listed by date.
  const closedSummary = [
    ...Object.entries(weeklyClosed).map(([day, reason]) => `every ${WEEKDAYS[Number(day)]} (${reason})`),
    ...Object.entries(closedDates)
      .filter(([d, reason]) => d >= todayStr && weeklyClosed[new Date(d + "T00:00:00").getDay()] !== reason)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, reason]) => `${new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${reason})`),
  ];

  const getSlotStyle = (slot: SlotInfo) => {
    if (slot.past) return "bg-gray-50 text-gray-300 cursor-not-allowed border-gray-100";
    if (timeSlot === slot.time) return "bg-primary text-white border-primary shadow-sm ring-2 ring-primary/20";
    if (slot.blocked) return "bg-gray-50 text-gray-500 border-gray-200 hover:border-primary";
    if (!slot.available && !slot.tooSoon) return "bg-red-50 text-red-400 border-red-100 hover:border-primary";
    return "bg-white text-gray-700 border-gray-200 hover:border-primary hover:bg-primary/5";
  };

  const slotNote = (slot: SlotInfo) => {
    if (!liveSlots) return null;
    if (slot.blocked) return "Blocked";
    if (slot.past) return "Passed";
    if (!slot.available && !slot.tooSoon && slot.remaining === 0) return "Full";
    return `${slot.remaining} spot${slot.remaining !== 1 ? "s" : ""}`;
  };

  if (!office) {
    return (
      <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-400 text-center">
        Select an office to pick a date and time.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Date */}
        <div>
          <span className="label flex items-center gap-1">Date <span className="text-red-500 font-medium" aria-hidden="true">*</span></span>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <button type="button" onClick={() => shiftMonth(-1)} disabled={atCurrentMonth} aria-label="Previous month"
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-sm font-semibold text-gray-900">{monthLabel}</span>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-100">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="bg-gray-50 text-center text-[10px] font-medium text-gray-400 py-1.5 uppercase tracking-wider">{d}</div>
              ))}
              {calendarCells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} className="bg-white h-9" />;
                const ds = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dow = new Date(calendarMonth.year, calendarMonth.month - 1, day).getDay();
                const closedReason = dow !== 0 && dow !== 6 && ds >= todayStr ? closedDates[ds] : undefined;
                const disabled = dow === 0 || dow === 6 || ds < todayStr || Boolean(closedReason);
                const isSelected = date === ds;
                const dot = disabled ? "" : getDotColor(ds);
                const dayLabel = new Date(calendarMonth.year, calendarMonth.month - 1, day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
                return (
                  <button key={day} type="button" disabled={disabled}
                    onClick={() => onChange({ date: ds, timeSlot: "" })}
                    aria-pressed={isSelected}
                    aria-label={closedReason ? `${dayLabel}, closed: ${closedReason}` : dayLabel}
                    title={closedReason ? `Closed: ${closedReason}` : undefined}
                    className={`h-9 flex flex-col items-center justify-center transition-colors ${
                      isSelected ? "bg-primary text-white" : closedReason ? "bg-red-50/60 cursor-not-allowed" : disabled ? "bg-white cursor-not-allowed" : "bg-white hover:bg-gray-50"
                    }`}>
                    <span className={`text-xs ${isSelected ? "font-bold" : closedReason ? "text-red-300 line-through" : disabled ? "text-gray-300" : "font-medium text-gray-700"}`}>{day}</span>
                    <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-white/70" : dot || "bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-3 px-3 py-1.5 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-300" /><span className="text-[10px] text-gray-400">Available</span></div>
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-300" /><span className="text-[10px] text-gray-400">Limited</span></div>
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-300" /><span className="text-[10px] text-gray-400">Full</span></div>
            </div>
          </div>
          {closedSummary.length > 0 && (
            <p className="text-[11px] text-red-500 mt-1.5">Closed: {closedSummary.join(", ")}</p>
          )}
        </div>

        {/* Time */}
        <div>
          <span className="label flex items-center gap-1">
            Time <span className="text-red-500 font-medium" aria-hidden="true">*</span>
            <span className="text-[11px] text-gray-400 font-normal ml-auto">{office.capacity_per_slot} spot{office.capacity_per_slot !== 1 ? "s" : ""} per slot</span>
          </span>
          {!date ? (
            <div className="flex items-center justify-center p-4 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-400 text-center">
              Pick a date to see time slots.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-2.5">
              <div className="text-[11px] text-gray-500 mb-2 px-0.5">
                {new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
              {loadingDay ? (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
                </div>
              ) : daySlots.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">No time slots for this date.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5" role="group" aria-label="Time slots">
                  {daySlots.map((slot) => (
                    <button key={slot.time} type="button" disabled={slot.past} aria-pressed={timeSlot === slot.time}
                      onClick={() => onChange({ timeSlot: slot.time })}
                      title={slot.blocked && slot.blockReason ? `Blocked: ${slot.blockReason}` : undefined}
                      className={`px-1 py-1.5 rounded-lg border text-center transition-all duration-150 ${getSlotStyle(slot)}`}>
                      <div className="text-xs font-semibold whitespace-nowrap">{slot.label}</div>
                      {slotNote(slot) && (
                        <div className={`text-[10px] leading-tight ${timeSlot === slot.time ? "text-white/70" : "opacity-70"}`}>{slotNote(slot)}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {selectedSlot && (selectedSlot.blocked || (liveSlots && !selectedSlot.available && !selectedSlot.tooSoon && !selectedSlot.past)) && (
            <p className="text-[11px] text-amber-700 mt-1.5">
              {selectedSlot.blocked
                ? `This time is blocked${selectedSlot.blockReason ? ` (${selectedSlot.blockReason})` : ""}. The invitation will still be created.`
                : "This slot is full. The invitation will still be created over capacity."}
            </p>
          )}
          {!liveSlots && date && !loadingDay && (
            <p className="text-[11px] text-gray-400 mt-1.5">Live availability couldn&apos;t be loaded. Showing the office&apos;s operating hours.</p>
          )}
        </div>
      </div>

      {/* Duration */}
      <div>
        <span className="label">Duration</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Duration">
          {(["30", "60"] as const).map((d) => (
            <label key={d} className={`flex items-center justify-center gap-2 px-3 py-2 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
              duration === d ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
            }`}>
              <input type="radio" name="inv-duration" value={d} checked={duration === d} onChange={() => onChange({ duration: d })} className="sr-only" />
              <span className="text-lg font-bold text-gray-900">{d}</span>
              <span className="text-xs text-gray-500">min</span>
              <span className={`text-xs font-medium ${duration === d ? "text-primary" : "text-gray-400"}`}>· {d === "30" ? "Quick visit" : "Extended visit"}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
