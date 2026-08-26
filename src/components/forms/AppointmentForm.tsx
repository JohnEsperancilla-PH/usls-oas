"use client";

import { useState, useEffect, useCallback } from "react";
import type { BookingData } from "@/app/page";
import type { Office } from "@/types/database";

interface AppointmentFormProps {
  data: BookingData;
  onBack: (data: Partial<BookingData>) => void;
  onSubmit: (data: Partial<BookingData>) => void;
  isSubmitting: boolean;
}

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

export function AppointmentForm({ data, onBack, onSubmit, isSubmitting }: AppointmentFormProps) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedOfficeId, setSelectedOfficeId] = useState(data.officeId);
  const [selectedDate, setSelectedDate] = useState(data.date);
  const [selectedTime, setSelectedTime] = useState(data.timeSlot);
  const [duration, setDuration] = useState<30 | 60>(data.duration);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (data.date) {
      const d = new Date(data.date + "T00:00:00");
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const [monthAvailability, setMonthAvailability] = useState<Record<string, DayAvailability>>({});
  const [daySlots, setDaySlots] = useState<SlotInfo[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchOffices = async () => {
    try {
      const res = await fetch("/api/offices");
      if (!res.ok) throw new Error("Server error");
      const d = await res.json();
      setOffices(d.filter((o: Office) => o.active));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchOffices(); }, []);

  const fetchMonthAvailability = useCallback(async (officeId: string, year: number, month: number) => {
    setLoadingMonth(true);
    try {
      const m = `${year}-${String(month).padStart(2, "0")}`;
      const res = await fetch(`/api/availability?officeId=${officeId}&month=${m}`);
      if (!res.ok) return;
      const d = await res.json();
      setMonthAvailability(d.availability || {});
    } catch { /* */ }
    finally { setLoadingMonth(false); }
  }, []);

  const fetchDaySlots = useCallback(async (officeId: string, date: string) => {
    setLoadingDay(true);
    try {
      const res = await fetch(`/api/availability?officeId=${officeId}&date=${date}`);
      if (!res.ok) return;
      const d = await res.json();
      setDaySlots(d.slots || []);
    } catch { /* */ }
    finally { setLoadingDay(false); }
  }, []);

  useEffect(() => {
    if (selectedOfficeId) {
      fetchMonthAvailability(selectedOfficeId, calendarMonth.year, calendarMonth.month);
    }
  }, [selectedOfficeId, calendarMonth, fetchMonthAvailability]);

  useEffect(() => {
    if (selectedOfficeId && selectedDate) {
      fetchDaySlots(selectedOfficeId, selectedDate);
    }
  }, [selectedOfficeId, selectedDate, fetchDaySlots]);

  const handleOfficeChange = (officeId: string) => {
    setSelectedOfficeId(officeId);
    setSelectedDate("");
    setSelectedTime("");
    setDaySlots([]);
    setMonthAvailability({});
    setErrors({});
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime("");
    setErrors((prev) => ({ ...prev, date: "" }));
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setErrors((prev) => ({ ...prev, timeSlot: "" }));
  };

  const selectedOffice = offices.find((o) => o.id === selectedOfficeId);

  const getMinDate = () => new Date().toISOString().split("T")[0];
  const getMaxDate = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!selectedOfficeId) e.officeId = "Please select an office";
    if (!selectedDate) e.date = "Please select a date";
    else {
      const d = new Date(selectedDate + "T00:00:00");
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const max = new Date(); max.setDate(max.getDate() + 30);
      if (d < today) e.date = "Cannot book in the past";
      else if (d > max) e.date = "Cannot book more than 30 days ahead";
      else if (d.getDay() === 0 || d.getDay() === 6) e.date = "Weekends are not available";
    }
    if (!selectedTime) e.timeSlot = "Please select a time";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({ officeId: selectedOfficeId, date: selectedDate, timeSlot: selectedTime, duration });
    }
  };

  const daysInMonth = new Date(calendarMonth.year, calendarMonth.month, 0).getDate();
  const firstDayOfWeek = new Date(calendarMonth.year, calendarMonth.month - 1, 1).getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const getAvailabilityColor = (ds: string) => {
    const avail = monthAvailability[ds];
    if (!avail) return "";
    if (avail.available === 0) return "bg-red-50 text-red-400 border-red-100";
    if (avail.available <= 3) return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-green-50 text-green-700 border-green-100";
  };

  const getSlotButtonStyle = (slot: SlotInfo) => {
    if (slot.past) return "bg-gray-50 text-gray-300 cursor-not-allowed border-gray-100";
    if (slot.blocked) return "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200 line-through";
    if (!slot.available) return "bg-red-50 text-red-300 cursor-not-allowed border-red-100";
    if (selectedTime === slot.time) return "bg-primary text-white border-primary shadow-sm ring-2 ring-primary/20";
    return "bg-white text-gray-700 border-gray-200 hover:border-primary hover:bg-primary/5 cursor-pointer";
  };

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month - 1).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Appointment Details</h2>
        <p className="text-sm text-gray-500 mt-1">Choose the office, date, and time for your visit.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Office */}
        <div>
          <label className="label flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
            Select Office
          </label>
          {loadError ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
              <span>{loadError}</span>
              <button type="button" onClick={() => { setLoadError(null); setLoading(true); fetchOffices(); }} className="text-primary font-medium hover:underline">Retry</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {loading ? (
                [1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)
              ) : offices.map((o) => (
                <button key={o.id} type="button" onClick={() => handleOfficeChange(o.id)}
                  className={`text-left p-3.5 rounded-xl border-2 transition-all duration-150 ${
                    selectedOfficeId === o.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${selectedOfficeId === o.id ? "text-primary" : "text-gray-900"}`}>{o.name}</span>
                    {selectedOfficeId === o.id && (
                      <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{o.operating_hours}</div>
                </button>
              ))}
            </div>
          )}
          {errors.officeId && <p className="error-text mt-1">{errors.officeId}</p>}
        </div>

        {/* Step 2: Calendar */}
        {selectedOfficeId && (
          <div className="animate-fade-in">
            <label className="label flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
              Pick a Date
            </label>
            <div className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <button type="button" onClick={() => {
                  const m = calendarMonth.month === 1 ? 12 : calendarMonth.month - 1;
                  const y = calendarMonth.month === 1 ? calendarMonth.year - 1 : calendarMonth.year;
                  setCalendarMonth({ year: y, month: m });
                }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  disabled={calendarMonth.year === today.getFullYear() && calendarMonth.month === today.getMonth() + 1}>
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-sm font-semibold text-gray-900">{monthLabel}</span>
                <button type="button" onClick={() => {
                  const m = calendarMonth.month === 12 ? 1 : calendarMonth.month + 1;
                  const y = calendarMonth.month === 12 ? calendarMonth.year + 1 : calendarMonth.year;
                  setCalendarMonth({ year: y, month: m });
                }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  disabled={calendarMonth.year === maxDate.getFullYear() && calendarMonth.month >= maxDate.getMonth() + 1}>
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              <div className="grid grid-cols-7 gap-px bg-gray-100">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="bg-gray-50 text-center text-[10px] font-medium text-gray-400 py-2 uppercase tracking-wider">{d}</div>
                ))}
                {calendarCells.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} className="bg-white min-h-[52px]" />;
                  const ds = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const cellDate = new Date(calendarMonth.year, calendarMonth.month - 1, day);
                  const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
                  const isPast = cellDate < today;
                  const isTooFar = cellDate > maxDate;
                  const disabled = isWeekend || isPast || isTooFar;
                  const isSelected = selectedDate === ds;
                  const availColor = !disabled ? getAvailabilityColor(ds) : "";

                  return (
                    <button key={day} type="button" onClick={() => !disabled && handleDateSelect(ds)}
                      disabled={disabled}
                      className={`bg-white min-h-[52px] p-1 flex flex-col items-center justify-center transition-all duration-100 ${
                        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-gray-50"
                      } ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}>
                      <span className={`text-xs font-medium ${
                        isSelected ? "text-primary font-bold" : isWeekend || isPast ? "text-gray-300" : "text-gray-700"
                      }`}>{day}</span>
                      {!disabled && availColor && (
                        <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${availColor.split(" ")[0]}`} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-200" /><span className="text-[10px] text-gray-400">Available</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-200" /><span className="text-[10px] text-gray-400">Limited</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-200" /><span className="text-[10px] text-gray-400">Full</span></div>
              </div>
            </div>
            {errors.date && <p className="error-text mt-1">{errors.date}</p>}
          </div>
        )}

        {/* Step 3: Time Slots */}
        {selectedDate && (
          <div className="animate-fade-in">
            <label className="label flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
              Pick a Time
              {selectedOffice && <span className="text-xs text-gray-400 font-normal ml-1">· {selectedOffice.capacity_per_slot} spot{selectedOffice.capacity_per_slot !== 1 ? "s" : ""} per slot</span>}
            </label>
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-2">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </div>
              {loadingDay ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
                </div>
              ) : daySlots.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">No time slots available</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {daySlots.map((slot) => (
                    <button key={slot.time} type="button" onClick={() => !slot.past && slot.available && handleTimeSelect(slot.time)}
                      disabled={slot.past || !slot.available}
                      className={`relative p-2.5 rounded-lg border text-center transition-all duration-150 ${getSlotButtonStyle(slot)}`}>
                      <div className="text-sm font-semibold">{slot.label}</div>
                      {slot.blocked ? (
                        <div className="text-[10px] text-gray-400 mt-0.5">Blocked</div>
                      ) : slot.past ? (
                        <div className="text-[10px] text-gray-300 mt-0.5">Passed</div>
                      ) : !slot.available ? (
                        <div className="text-[10px] text-red-300 mt-0.5">Full</div>
                      ) : (
                        <div className={`text-[10px] mt-0.5 ${selectedTime === slot.time ? "text-white/70" : "text-gray-400"}`}>
                          {slot.remaining} spot{slot.remaining !== 1 ? "s" : ""}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.timeSlot && <p className="error-text mt-1">{errors.timeSlot}</p>}
          </div>
        )}

        {/* Duration */}
        {selectedTime && (
          <div className="animate-fade-in">
            <label className="label flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">4</span>
              Visit Duration
            </label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {[30, 60].map((d) => (
                <label key={d} className={`flex flex-col items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                  duration === d ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 hover:border-gray-300"
                }`}>
                  <input type="radio" name="duration" value={d} checked={duration === d} onChange={() => setDuration(d as 30 | 60)} className="sr-only" />
                  <span className="text-2xl font-bold text-gray-900">{d}</span>
                  <span className="text-xs text-gray-500 mt-0.5">minutes</span>
                  <span className={`text-xs mt-1 font-medium ${duration === d ? "text-primary" : "text-gray-400"}`}>
                    {d === 30 ? "Quick visit" : "Extended visit"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {selectedOffice && selectedDate && selectedTime && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Booking Summary
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-500">Office</span><p className="font-medium">{selectedOffice.name}</p></div>
              <div><span className="text-gray-500">Date</span><p className="font-medium">{new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p></div>
              <div><span className="text-gray-500">Time</span><p className="font-medium">{daySlots.find((s) => s.time === selectedTime)?.label}</p></div>
              <div><span className="text-gray-500">Duration</span><p className="font-medium">{duration} min</p></div>
            </div>
          </div>
        )}

        {/* Nav */}
        <div className="flex justify-between pt-2">
          <button type="button" onClick={() => onBack({ officeId: selectedOfficeId, date: selectedDate, timeSlot: selectedTime, duration })} className="btn-ghost">
            <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <button type="submit" disabled={isSubmitting || !selectedTime} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Submitting...
              </span>
            ) : "Submit Appointment"}
          </button>
        </div>
      </form>
    </div>
  );
}
