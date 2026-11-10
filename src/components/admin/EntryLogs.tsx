"use client";

import { useState, useEffect, useCallback } from "react";
import type { EntryLog, EntryLogEvent } from "@/types/database";
import { StatusMessage } from "@/components/admin/StatusMessage";
import { Pagination, SearchInput } from "@/components/admin/Pagination";
import { ModalShell } from "@/components/admin/ModalShell";
import { LogDateRange } from "@/components/admin/LogDateRange";
import { adminFetch } from "@/lib/admin-fetch";
import { formatTimeSlot, getManilaToday } from "@/lib/time";

const PAGE_SIZE = 25;
// Today's log refreshes on its own so a supervisor can leave it open.
const LIVE_REFRESH_MS = 30_000;

const EVENT_STYLES: Record<EntryLogEvent, { label: string; badge: string }> = {
  entry: { label: "Checked in", badge: "bg-green-100 text-green-800" },
  checkout: { label: "Checked out", badge: "bg-blue-100 text-blue-800" },
  denied: { label: "Denied", badge: "bg-red-100 text-red-800" },
  rejected: { label: "Rejected scan", badge: "bg-amber-100 text-amber-800" },
};

const RESULT_LABELS: Record<string, string> = {
  approved: "Entry allowed",
  checked_out: "Checked out",
  entry_denied: "Denied by guard",
  not_found: "Code not found",
  already_used: "Already used",
  duplicate_scan: "Scanned twice",
  pending: "Not approved yet",
  cancelled: "Appointment declined",
  expired: "Expired",
  wrong_date: "Wrong date",
  too_early: "Too early",
  too_late: "Too late",
  invalid_id: "ID didn't match",
};

const METHOD_LABELS: Record<string, string> = { qr: "QR scan", manual: "Typed code", list: "Picked from list" };

const FILTERS: { key: "" | EntryLogEvent; label: string }[] = [
  { key: "", label: "All" },
  { key: "entry", label: "Checked in" },
  { key: "checkout", label: "Checked out" },
  { key: "denied", label: "Denied" },
  { key: "rejected", label: "Rejected scans" },
];

function formatDuration(minutes: number) {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

/** "12 min early", "on time", "1h 5m late" relative to the booked time. */
function describeTiming(log: EntryLog): string | null {
  if (log.event === "checkout" && log.minutes_on_site !== null) return `Stayed ${formatDuration(log.minutes_on_site)}`;
  if (log.minutes_from_slot === null) return null;
  if (Math.abs(log.minutes_from_slot) <= 2) return "On time";
  return `${formatDuration(log.minutes_from_slot)} ${log.minutes_from_slot < 0 ? "early" : "late"}`;
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" });
const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** Gate entry log: check-ins, checkouts, denials, and rejected scans, with filters and a details view. */
export function EntryLogs() {
  const today = getManilaToday();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [event, setEvent] = useState<"" | EntryLogEvent>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<EntryLog[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Record<EntryLogEvent, number>>({ entry: 0, checkout: 0, denied: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<EntryLog | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, page: String(page), pageSize: String(PAGE_SIZE) });
      if (event) params.set("event", event);
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await adminFetch(`/api/entry-logs?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load the entry log.");
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      if (data.summary) setSummary(data.summary);
      setLoadError(null);
      setLastLoaded(new Date());
    } catch (err) { setLoadError(err instanceof Error ? err.message : "Could not load the entry log."); }
    finally { if (!quiet) setLoading(false); }
  }, [from, to, page, event, debouncedSearch]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const isLive = to >= today;
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => fetchLogs(true), LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isLive, fetchLogs]);

  const withFirstPage = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setPage(1); };
  const setRange = (start: string, end: string) => { setFrom(start); setTo(end); setPage(1); };
  const allCount = summary.entry + summary.checkout + summary.denied + summary.rejected;
  const multiDay = from !== to;
  const inside = Math.max(0, summary.entry - summary.checkout);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Checked in", value: summary.entry, tone: "text-green-700" },
          { label: "Checked out", value: summary.checkout, tone: "text-blue-700" },
          { label: multiDay ? "In minus out" : "Still on campus", value: inside, tone: "text-gray-900" },
          { label: "Denied", value: summary.denied, tone: "text-red-700" },
          { label: "Rejected scans", value: summary.rejected, tone: "text-amber-700" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold ${card.tone}`}>{loading && !lastLoaded ? "–" : card.value}</div>
            <div className="text-xs text-gray-500">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row xl:items-end gap-3">
        <div className="flex-1"><SearchInput value={search} onChange={withFirstPage(setSearch)} placeholder="Search visitor, guard, office, code, or plate..." label="Search entry log" /></div>
        <LogDateRange idPrefix="entry" from={from} to={to} onChange={setRange} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isLive && lastLoaded && (
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
            Live · updated {lastLoaded.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
        <button type="button" onClick={() => fetchLogs()} className="text-xs font-medium text-primary hover:underline">Refresh</button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by event">
        {FILTERS.map((f) => {
          const count = f.key ? summary[f.key] : allCount;
          return (
            <button key={f.key || "all"} type="button" onClick={() => withFirstPage(setEvent)(f.key)} aria-pressed={event === f.key}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${event === f.key ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
              {f.label} <span className={`ml-1 text-xs ${event === f.key ? "text-white/80" : "text-gray-400"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {loadError && !loading ? (
        <StatusMessage message={{ type: "error", text: loadError }} onRetry={() => fetchLogs()} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-11 rounded-lg" />)}</div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              {debouncedSearch || event ? "No entries match these filters." : "No gate activity in this period."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="bg-gray-50">
                  <tr>
                    {["Time", "Event", "Visitor", "Office", "Timing", "Guard", ""].map((h, i) => (
                      <th key={i} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${i === 6 ? "text-right" : "text-left"}`}>{h || <span className="sr-only">Details</span>}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => {
                    const style = EVENT_STYLES[log.event];
                    const timing = describeTiming(log);
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {timeOf(log.created_at)}
                          {multiDay && <div className="text-[11px] text-gray-400">{dateOf(log.created_at)}</div>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.badge}`}>{style.label}</span>
                          {log.event === "rejected" && <div className="text-[11px] text-gray-500 mt-0.5">{RESULT_LABELS[log.result] || log.result}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">
                            {log.visitor_name || <span className="text-gray-400 font-normal">Unknown code</span>}
                            {log.visitor_count && log.visitor_count > 1 && <span className="text-gray-400 font-normal"> +{log.visitor_count - 1}</span>}
                          </div>
                          {log.vehicle_plates && <div className="text-[11px] text-gray-500 font-mono">{log.vehicle_plates}</div>}
                          {!log.visitor_name && log.reference && <div className="text-[11px] text-gray-500 font-mono">{log.reference}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {log.office_name || "—"}
                          {log.time_slot && <div className="text-[11px] text-gray-400">Booked {formatTimeSlot(log.time_slot)}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{timing || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {log.guard_name || "—"}
                          {log.method && <div className="text-[11px] text-gray-400">{METHOD_LABELS[log.method]}</div>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => setViewing(log)} aria-label={`View details of ${style.label} at ${timeOf(log.created_at)}`}
                            className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">View</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loadError && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="entries" />}

      <ModalShell open={Boolean(viewing)} title={viewing ? EVENT_STYLES[viewing.event].label : ""}
        subtitle={viewing ? new Date(viewing.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) : undefined}
        onClose={() => setViewing(null)} maxWidthClass="max-w-lg"
        footer={<button type="button" onClick={() => setViewing(null)} className="btn-secondary w-full btn-sm">Close</button>}>
        {viewing && (
          <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-2 text-sm">
            {([
              ["Outcome", RESULT_LABELS[viewing.result] || viewing.result],
              ["Message", viewing.message],
              ["Visitor", viewing.visitor_name],
              ["Category", viewing.visitor_category?.replace(/_/g, " ")],
              ["Group size", viewing.visitor_count ? String(viewing.visitor_count) : null],
              ["Vehicles", viewing.vehicle_plates],
              ["Office", viewing.office_name],
              ["Booked for", viewing.appointment_date ? `${new Date(viewing.appointment_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${viewing.time_slot ? `, ${formatTimeSlot(viewing.time_slot)}` : ""}` : null],
              ["Timing", describeTiming(viewing)],
              ["Reference", viewing.reference],
              ["How entered", viewing.method ? METHOD_LABELS[viewing.method] : null],
              ["Guard", viewing.guard_name ? `${viewing.guard_name}${viewing.guard_username ? ` (${viewing.guard_username})` : ""}` : null],
              ["Device IP", viewing.ip],
              ["Browser", viewing.user_agent],
            ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-gray-500">{label}</dt>
                <dd className={`text-gray-900 break-words ${label === "Reference" ? "font-mono" : ""} ${label === "Browser" ? "text-xs text-gray-600" : ""}`}>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </ModalShell>
    </div>
  );
}
