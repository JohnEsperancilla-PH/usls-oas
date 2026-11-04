"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import type { ClosedDate } from "@/types/database";
import { StatusMessage, useStatusMessage } from "@/components/admin/StatusMessage";
import { adminFetch } from "@/lib/admin-fetch";
import { getManilaToday } from "@/lib/time";

const emptyForm = { date: "", endDate: "", reason: "" };
const WEEKDAYS = [[1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"]] as const;

function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", opts);
}

// Consecutive dates with the same reason (e.g. Holy Week) are shown as one entry.
function groupRuns(rows: ClosedDate[]): ClosedDate[][] {
  const groups: ClosedDate[][] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && prev.reason === row.reason) {
      const next = new Date(prev.date + "T00:00:00Z");
      next.setUTCDate(next.getUTCDate() + 1);
      if (next.toISOString().slice(0, 10) === row.date) { last.push(row); continue; }
    }
    groups.push([row]);
  }
  return groups;
}

export default function ClosedDatesPage() {
  const { admin } = useAdmin();
  const [rows, setRows] = useState<ClosedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [multiDay, setMultiDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useStatusMessage();
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const todayStr = getManilaToday();

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/closed-dates${showPast ? "?includePast=1" : ""}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Could not load closed dates.");
      setRows(Array.isArray(data) ? data : []);
      setLoadError(null);
    } catch (err) { setLoadError(err instanceof Error ? err.message : "Could not load closed dates."); }
    finally { setLoading(false); }
  }, [showPast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Weekdays closed every week: saved = what's stored, weekly = the unsaved edits.
  const [savedWeekly, setSavedWeekly] = useState<Record<string, string> | null>(null);
  const [weekly, setWeekly] = useState<Record<string, string>>({});
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch("/api/admin/closed-dates/weekly")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => { const w = data?.weekdays || {}; setSavedWeekly(w); setWeekly(w); })
      .catch(() => { setSavedWeekly({}); setWeeklyError("Could not load weekly closed days."); });
  }, []);

  const weeklyDirty = savedWeekly !== null && JSON.stringify(Object.entries(weekly).sort()) !== JSON.stringify(Object.entries(savedWeekly).sort());

  const toggleWeekday = (day: number, on: boolean) => {
    setWeekly((prev) => {
      const next = { ...prev };
      if (on) next[day] = savedWeekly?.[day] ?? "";
      else delete next[day];
      return next;
    });
  };

  const saveWeekly = async () => {
    setSavingWeekly(true); setWeeklyError(null); setMessage(null);
    try {
      const res = await adminFetch("/api/admin/closed-dates/weekly", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekdays: weekly }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save weekly closed days.");
      setSavedWeekly(data.weekdays || {}); setWeekly(data.weekdays || {});
      const names = Object.keys(data.weekdays || {}).map((d) => WEEKDAYS.find(([n]) => n === Number(d))?.[1]).filter(Boolean);
      const parts = [names.length ? `Closed every ${names.join(", ")} at all offices.` : "No weekdays are closed every week."];
      if (data.affectedAppointments) parts.push(`${data.affectedAppointments} upcoming appointment${data.affectedAppointments !== 1 ? "s are" : " is"} on a newly closed weekday. Review and postpone or decline them.`);
      setMessage({ type: "success", text: parts.join(" ") });
    } catch (err) { setWeeklyError(err instanceof Error ? err.message : "Could not save weekly closed days."); }
    finally { setSavingWeekly(false); }
  };

  if (admin.role !== "super_admin") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-500">Only super admins can manage closed dates.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); setMessage(null);
    if (!form.date) { setFormError("Pick a date."); return; }
    if (multiDay && form.endDate && form.endDate < form.date) { setFormError("The end date must be on or after the start date."); return; }
    if (!form.reason.trim()) { setFormError("Enter a reason, e.g. the holiday's name."); return; }
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/closed-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: form.date, endDate: multiDay && form.endDate ? form.endDate : form.date, reason: form.reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not close the date.");
      const days = data.closed?.length || 0;
      const parts = [`${form.reason.trim()}: ${days} day${days !== 1 ? "s" : ""} closed for all offices.`];
      if (data.skipped) parts.push(`${data.skipped} already closed.`);
      if (data.affectedAppointments) parts.push(`${data.affectedAppointments} existing appointment${data.affectedAppointments !== 1 ? "s are" : " is"} still scheduled then. Review and postpone or decline them.`);
      setMessage({ type: "success", text: parts.join(" ") });
      setForm(emptyForm);
      fetchRows();
    } catch (err) { setFormError(err instanceof Error ? err.message : "Could not close the date."); }
    finally { setSaving(false); }
  };

  const handleReopen = async (group: ClosedDate[]) => {
    setReopening(true); setMessage(null);
    try {
      for (const row of group) {
        const res = await adminFetch("/api/admin/closed-dates", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.id }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "Could not reopen the date."); }
      }
      setMessage({ type: "success", text: `${group[0].reason} reopened. Visitors can book ${group.length > 1 ? "these dates" : "this date"} again.` });
      setConfirmingKey(null);
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Could not reopen the date." }); }
    finally { setReopening(false); fetchRows(); }
  };

  const groups = groupRuns(rows);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Closed Dates</h1>
        <p className="text-sm text-gray-500 mt-0.5">Holidays and campus-wide closures. Closed dates can&apos;t be booked, invited, or postponed to at any office.</p>
      </div>

      {message && <StatusMessage message={message} onDismiss={() => setMessage(null)} />}

      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" aria-labelledby="weekly-heading">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 id="weekly-heading" className="text-sm font-semibold text-gray-900">Closed every week</h2>
            <p className="text-xs text-gray-500 mt-0.5">Turn on a weekday to close it every week at all offices. Weekends are always closed.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {weeklyDirty && (
              <button type="button" onClick={() => { setWeekly(savedWeekly || {}); setWeeklyError(null); }} disabled={savingWeekly} className="btn-ghost btn-sm">Discard</button>
            )}
            <button type="button" onClick={saveWeekly} disabled={!weeklyDirty || savingWeekly} className="btn-primary btn-sm disabled:opacity-50">
              {savingWeekly ? "Saving..." : "Save weekly days"}
            </button>
          </div>
        </div>
        {weeklyError && <StatusMessage message={{ type: "error", text: weeklyError }} />}
        {savedWeekly === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">{WEEKDAYS.map(([d]) => <div key={d} className="skeleton h-20 rounded-lg" />)}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {WEEKDAYS.map(([day, name]) => {
              const on = day in weekly;
              return (
                <div key={day} className={`rounded-lg border p-3 transition-colors ${on ? "border-red-200 bg-red-50/50" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium ${on ? "text-red-700" : "text-gray-700"}`}>{name}</span>
                    <button type="button" role="switch" aria-checked={on} aria-label={`Close every ${name}`} onClick={() => toggleWeekday(day, !on)}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${on ? "bg-red-500" : "bg-gray-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
                    </button>
                  </div>
                  <p className={`text-[11px] mt-1 ${on ? "text-red-600" : "text-gray-400"}`}>{on ? "Closed every week" : "Open"}</p>
                  {on && (
                    <input className="input !py-1.5 mt-2 !text-sm" maxLength={120} value={weekly[day] ?? ""} placeholder="Reason (optional)"
                      aria-label={`Reason ${name} is closed`}
                      onChange={(e) => setWeekly((prev) => ({ ...prev, [day]: e.target.value }))} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-6 items-start">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Close a date</h2>
          {formError && <StatusMessage message={{ type: "error", text: formError }} />}

          <div className="flex bg-gray-100 rounded-lg p-0.5" role="group" aria-label="Closure length">
            {([[false, "Single day"], [true, "Date range"]] as const).map(([value, label]) => (
              <button key={label} type="button" onClick={() => setMultiDay(value)} aria-pressed={multiDay === value}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${multiDay === value ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className={multiDay ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <label htmlFor="closed-date" className="label">{multiDay ? "From" : "Date"}</label>
              <input id="closed-date" type="date" className="input" min={todayStr} value={form.date} required
                onChange={(e) => setForm({ ...form, date: e.target.value, endDate: form.endDate && form.endDate < e.target.value ? e.target.value : form.endDate })} />
            </div>
            {multiDay && (
              <div>
                <label htmlFor="closed-end-date" className="label">To</label>
                <input id="closed-end-date" type="date" className="input" min={form.date || todayStr} value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="closed-reason" className="label">Reason</label>
            <input id="closed-reason" className="input" maxLength={120} value={form.reason} placeholder="e.g. Bonifacio Day"
              onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <p className="text-[11px] text-gray-400 mt-1">Shown to visitors and office admins on the calendar.</p>
          </div>

          <button type="submit" disabled={saving} className="btn-primary btn-sm w-full disabled:opacity-50">
            {saving ? "Closing..." : multiDay ? "Close these dates" : "Close this date"}
          </button>
          <p className="text-[11px] text-gray-400">Appointments already booked on a closed date aren&apos;t changed. You&apos;ll be told how many there are so offices can follow up.</p>
        </form>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">{showPast ? "All closed dates" : "Upcoming closed dates"}</h2>
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 accent-[#006633]" />
              Show past
            </label>
          </div>
          {loading ? (
            <div className="p-5 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
          ) : loadError ? (
            <div className="p-5"><StatusMessage message={{ type: "error", text: loadError }} onRetry={fetchRows} /></div>
          ) : groups.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-500">No {showPast ? "" : "upcoming "}closed dates.</p>
              <p className="text-xs text-gray-400 mt-1">Add holidays here so no office can be booked on them.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {groups.map((group) => {
                const first = group[0];
                const last = group[group.length - 1];
                const key = first.id;
                const isPast = last.date < todayStr;
                return (
                  <li key={key} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 ${isPast ? "opacity-60" : ""}`}>
                    <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-100 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-semibold uppercase text-red-500 leading-none">{formatDate(first.date, { month: "short" })}</span>
                      <span className="text-lg font-bold text-red-700 leading-tight">{formatDate(first.date, { day: "numeric" })}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{first.reason}</div>
                      <div className="text-xs text-gray-500">
                        {group.length > 1 ? `${formatDate(first.date)} – ${formatDate(last.date)} · ${group.length} days` : formatDate(first.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                    {!isPast && (confirmingKey === key ? (
                      <div className="flex items-center gap-2 flex-shrink-0" role="group" aria-label={`Confirm reopening ${first.reason}`}>
                        <span className="text-xs text-gray-600">Reopen?</span>
                        <button type="button" onClick={() => handleReopen(group)} disabled={reopening} className="text-xs font-medium text-white px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-light transition-colors disabled:opacity-50">
                          {reopening ? "Reopening..." : "Yes, reopen"}
                        </button>
                        <button type="button" onClick={() => setConfirmingKey(null)} disabled={reopening} className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmingKey(key)} aria-label={`Reopen ${first.reason}`}
                        className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors flex-shrink-0">
                        Reopen
                      </button>
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
