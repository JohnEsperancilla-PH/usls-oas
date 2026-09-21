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
  const [officeQuery, setOfficeQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [changingOffice, setChangingOffice] = useState(false);
  const [personToMeet, setPersonToMeet] = useState(data.personToMeet || "");
  const [showPersonToMeetOther, setShowPersonToMeetOther] = useState(false);
  const [selectedDate, setSelectedDate] = useState(data.date);
  const [selectedTime, setSelectedTime] = useState(data.timeSlot);
  const [duration, setDuration] = useState<30 | 60>(data.duration);
  const [purposeOfVisit, setPurposeOfVisit] = useState(data.purposeOfVisit || "");
  const visitorCount = data.visitorCount || 1;

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
  }, [visitorCount]);

  const fetchDaySlots = useCallback(async (officeId: string, date: string) => {
    setLoadingDay(true);
    try {
      const res = await fetch(`/api/availability?officeId=${officeId}&date=${date}`);
      if (!res.ok) {
        setDaySlots([]);
        setErrors((previous) => ({ ...previous, timeSlot: "Unable to load time slots. Please try again." }));
        return;
      }
      const d = await res.json();
      setDaySlots(d.slots || []);
      setErrors((previous) => ({ ...previous, timeSlot: "" }));
    } catch {
      setDaySlots([]);
      setErrors((previous) => ({ ...previous, timeSlot: "Unable to load time slots. Please try again." }));
    }
    finally { setLoadingDay(false); }
  }, [visitorCount]);

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
    setExpandedCategories({});
    setChangingOffice(false);
    setOfficeQuery("");
    setPersonToMeet("");
    setShowPersonToMeetOther(false);
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

  const searching = officeQuery.trim().length > 0;

  const visibleOffices = offices.filter((o) => o.active).filter((o) => {
    const q = officeQuery.trim().toLowerCase();
    if (!q) return true;
    return o.name.toLowerCase().includes(q) || (o.category || "").toLowerCase().includes(q);
  });

  const groupedOffices = visibleOffices.reduce<Record<string, Office[]>>((acc, o) => {
    const cat = o.category || "Other Offices";
    (acc[cat] = acc[cat] || []).push(o);
    return acc;
  }, {});

  const SECTION_LABELS: Record<string, string> = {
    "Vice Chancellor for Finance": "Finance",
    "Vice Chancellor for Administration": "Administration",
    "Vice Chancellor for Academic Affairs": "Academic Affairs",
    "Vice Chancellor for Mission and Development": "Missions and Development",
    "Basic Education Unit (Kinder to Grade 12)": "Basic Education",
    "President": "President",
  };

  const CATEGORY_ORDER = [
    "Vice Chancellor for Finance",
    "Vice Chancellor for Administration",
    "Vice Chancellor for Academic Affairs",
    "Vice Chancellor for Mission and Development",
    "Basic Education Unit (Kinder to Grade 12)",
    "President",
  ];

  const orderedCategories = Object.keys(groupedOffices).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const getMinDate = () => new Date().toISOString().split("T")[0];
  const getMaxDate = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!selectedOfficeId) e.officeId = "Please select an office";
    if (!personToMeet.trim()) e.personToMeet = "Please enter the person you intend to meet";
    if (!selectedDate) e.date = "Please select a date";
    else {
      const d = new Date(selectedDate + "T00:00:00");
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const max = new Date(); max.setDate(max.getDate() + 30);
      if (d < today) e.date = "Cannot book in the past";
      else if (d > max) e.date = "Cannot book more than 30 days ahead";
      else if (d.getDay() === 0 || d.getDay() === 6) e.date = "Weekends are not available";
    }
    // Only require time slot if the office doesn't hide time slots
    if (!selectedOffice?.hide_time_slots && !selectedTime) e.timeSlot = "Please select a time";
    if (!purposeOfVisit.trim()) e.purposeOfVisit = "Please describe your purpose of visit";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({ officeId: selectedOfficeId, personToMeet, date: selectedDate, timeSlot: selectedTime, duration, purposeOfVisit });
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
            <div className="mt-2">
              {loading ? (
                <div className="skeleton h-11 rounded-lg" />
              ) : (
                <>
                  {!(selectedOffice && !changingOffice) && (
                    <div className="relative mb-3">
                    <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={officeQuery}
                      onChange={(e) => setOfficeQuery(e.target.value)}
                      placeholder="Search offices..."
                      className="input"
                      style={{ paddingLeft: "2.5rem" }}
                      autoComplete="off"
                    />
                    {officeQuery && (
                      <button type="button" onClick={() => setOfficeQuery("")} aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                  )}

                  {visibleOffices.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-400 border border-gray-100 rounded-lg">No offices match your search</div>
                  ) : selectedOffice && !searching && !changingOffice ? (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <button type="button"
                        onClick={() => {
                          setChangingOffice(true);
                          setSelectedOfficeId("");
                          setPersonToMeet("");
                          setSelectedDate("");
                          setSelectedTime("");
                          setDaySlots([]);
                          setMonthAvailability({});
                          setErrors({});
                          setExpandedCategories({ [selectedOffice.category || "Other Offices"]: true });
                        }}
                        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-primary/5 hover:bg-primary/10 transition-colors text-left">
                        <span className="text-sm font-semibold text-primary truncate">{selectedOffice.name}</span>
                        <span className="flex items-center gap-1 text-xs text-gray-500 font-medium flex-shrink-0">
                          Change
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                      {orderedCategories.map((cat) => {
                        const list = groupedOffices[cat];
                        const expanded = searching || !!expandedCategories[cat];
                        return (
                          <div key={cat}>
                            <button type="button" onClick={() => toggleCategory(cat)}
                              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#006633] text-white hover:bg-[#005428] transition-colors text-left">
                              <span className="text-xs font-semibold uppercase tracking-wide truncate">{SECTION_LABELS[cat] || cat}</span>
                              <span className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-[10px] text-white/70">{list.length}</span>
                                <svg className={`w-3.5 h-3.5 text-white/80 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </span>
                            </button>
                            {expanded && (
                              <div className="bg-white">
                                {list.map((o) => {
                                  const isSelected = !changingOffice && selectedOfficeId === o.id;
                                  return (
                                    <button key={o.id} type="button"
                                      onClick={() => handleOfficeChange(o.id)}
                                      className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors border-b border-gray-50 last:border-0 ${
                                        isSelected ? "bg-primary/5" : "hover:bg-gray-50"
                                      }`}>
                                      <span className={`text-sm truncate ${isSelected ? "font-semibold text-primary" : "text-gray-700"}`}>{o.name}</span>
                                      {isSelected && (
                                        <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedOffice && (
                    <p className="text-xs text-gray-400 mt-2">
                      {selectedOffice.operating_hours} · {selectedOffice.capacity_per_slot} spot{selectedOffice.capacity_per_slot !== 1 ? "s" : ""} per slot
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {errors.officeId && <p className="error-text mt-1">{errors.officeId}</p>}
        </div>

        {/* Person to Meet */}
        {selectedOffice && (
          <div className="animate-fade-in">
            <label htmlFor="personToMeet" className="label flex items-center gap-2">
              Person to Meet <span className="text-red-500">*</span>
            </label>
            {selectedOffice.contacts && selectedOffice.contacts.length > 0 ? (
              <>
                <select
                  id="personToMeet"
                  value={showPersonToMeetOther ? "__other__" : personToMeet}
                  onChange={(e) => {
                    if (e.target.value === "__other__") {
                      setShowPersonToMeetOther(true);
                      setPersonToMeet("");
                    } else {
                      setShowPersonToMeetOther(false);
                      setPersonToMeet(e.target.value);
                    }
                    if (errors.personToMeet) setErrors((p) => ({ ...p, personToMeet: "" }));
                  }}
                  className={`input mt-2 ${errors.personToMeet ? "input-error" : ""}`}
                >
                  <option value="">Select a person to meet…</option>
                  {selectedOffice.contacts.map((contact) => (
                    <option key={contact.id} value={contact.name}>
                      {contact.name}{contact.position ? ` — ${contact.position}` : ""}
                    </option>
                  ))}
                  <option value="__other__">Others… (type a name)</option>
                </select>
                {showPersonToMeetOther && (
                  <input
                    type="text"
                    id="personToMeetOther"
                    value={personToMeet}
                    onChange={(e) => { setPersonToMeet(e.target.value); if (errors.personToMeet) setErrors((p) => ({ ...p, personToMeet: "" })); }}
                    className={`input mt-2 ${errors.personToMeet ? "input-error" : ""}`}
                    placeholder={`Enter the person you intend to meet at ${selectedOffice.name}`}
                    maxLength={120}
                  />
                )}
              </>
            ) : (
              <input
                type="text"
                id="personToMeet"
                value={personToMeet}
                onChange={(e) => { setPersonToMeet(e.target.value); if (errors.personToMeet) setErrors((p) => ({ ...p, personToMeet: "" })); }}
                className={`input mt-2 ${errors.personToMeet ? "input-error" : ""}`}
                placeholder={`Enter the person you intend to meet at ${selectedOffice.name}`}
                maxLength={120}
              />
            )}
            {errors.personToMeet && <p className="error-text mt-1">{errors.personToMeet}</p>}
          </div>
        )}

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

        {/* Step 3: Time Slots - Only show if office doesn't hide time slots */}
        {selectedDate && selectedOffice && !selectedOffice.hide_time_slots && (
          <div className="animate-fade-in">
            <label className="label flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
              Preferred Time
              {selectedOffice && <span className="text-xs text-gray-400 font-normal ml-1">· {selectedOffice.capacity_per_slot} spot{selectedOffice.capacity_per_slot !== 1 ? "s" : ""} per slot</span>}
            </label>
            <p className="text-xs text-gray-500 mt-1.5">
              This is your <strong className="text-gray-600">preferred time</strong> only — there is <strong className="text-gray-600">no guarantee that the office or person you intend to meet will be available</strong> at this time. Your request is <strong className="text-gray-600">pending their confirmation</strong>, and this appointment slot is only provisional until they respond.
            </p>
            <p className="text-xs text-gray-500 mt-2 border-l-2 border-primary/30 pl-3">
              ⏳ Please <strong className="text-gray-700">wait for confirmation</strong> before going to the office. Do not treat your preferred time as assured. We'll email you once your request is <strong className="text-gray-700">confirmed, postponed, or declined</strong>.
            </p>
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
              ) : !daySlots.some((slot) => slot.available) ? (
                <div className="text-center py-8 px-4 text-sm text-gray-500 border border-amber-100 bg-amber-50 rounded-lg">
                  No available time slots for this date. All {visitorCount} visitors will be included under one appointment slot.
                </div>
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

        {/* Message when office hides time slots */}
        {selectedDate && selectedOffice?.hide_time_slots && (
          <div className="animate-fade-in bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">Time Slot Selection Disabled</h3>
                <p className="text-sm text-blue-800">
                  This office has disabled time slot selection. After submitting your appointment request, 
                  <strong> {selectedOffice.name}</strong> will contact you to schedule a specific time.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Duration - Show if time is selected OR if office hides time slots */}
        {(selectedTime || selectedOffice?.hide_time_slots) && selectedDate && (
          <div className="animate-fade-in">
            <label className="label flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {selectedOffice?.hide_time_slots ? "3" : "4"}
              </span>
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

        {/* Purpose of Visit - Show if time is selected OR if office hides time slots */}
        {(selectedTime || selectedOffice?.hide_time_slots) && selectedDate && (
          <div className="animate-fade-in">
            <label className="label flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {selectedOffice?.hide_time_slots ? "4" : "5"}
              </span>
              Purpose of Visit
              <span className="text-red-500">*</span>
            </label>
            <textarea value={purposeOfVisit} onChange={(e) => { setPurposeOfVisit(e.target.value); if (errors.purposeOfVisit) setErrors((p) => ({ ...p, purposeOfVisit: "" })); }}
              placeholder="Briefly describe the reason for your visit..."
              className={`input mt-2 ${errors.purposeOfVisit ? "input-error" : ""}`} rows={3} maxLength={500} />
            {errors.purposeOfVisit && <p className="error-text mt-1">{errors.purposeOfVisit}</p>}
            <div className="text-xs text-gray-400 mt-1 text-right">{purposeOfVisit.length}/500</div>
          </div>
        )}

        {/* Summary */}
        {selectedOffice && selectedDate && (selectedTime || selectedOffice.hide_time_slots) && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Booking Summary
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-500">Office</span><p className="font-medium">{selectedOffice.name}</p></div>
              <div><span className="text-gray-500">Person to Meet</span><p className="font-medium">{personToMeet}</p></div>
              <div><span className="text-gray-500">Date</span><p className="font-medium">{new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p></div>
              <div><span className="text-gray-500">Time</span><p className="font-medium">{selectedOffice.hide_time_slots ? "To be scheduled by office" : daySlots.find((s) => s.time === selectedTime)?.label}</p></div>
              <div><span className="text-gray-500">Duration</span><p className="font-medium">{duration} min</p></div>
            </div>
          </div>
        )}

        {/* Nav */}
        <div className="flex justify-between pt-2">
          <button type="button" onClick={() => onBack({ officeId: selectedOfficeId, personToMeet, date: selectedDate, timeSlot: selectedTime, duration, purposeOfVisit })} className="btn-ghost">
            <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <button type="submit" disabled={isSubmitting || (!selectedTime && !selectedOffice?.hide_time_slots)} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
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
