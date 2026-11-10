"use client";

import { useState, useEffect, useCallback } from "react";
import type { EmailLog } from "@/types/database";
import { StatusMessage } from "@/components/admin/StatusMessage";
import { Pagination, SearchInput } from "@/components/admin/Pagination";
import { LogDateRange } from "@/components/admin/LogDateRange";
import { Select } from "@/components/ui/Select";
import { adminFetch } from "@/lib/admin-fetch";
import { formatTimeSlot, getManilaToday } from "@/lib/time";

const PAGE_SIZE = 25;

const TYPES: Record<string, string> = {
  confirmation: "Booking confirmation",
  admin_alert: "New booking alert (office)",
  approval: "Approval",
  decline: "Decline",
  postponement: "Postponement",
  invitation: "Invitation",
  qr_resend: "Reference re-send",
};

const STATUS_STYLES: Record<string, [string, string]> = {
  sent: ["Sent", "bg-green-100 text-green-800"],
  failed: ["Failed", "bg-red-100 text-red-800"],
  pending: ["Not sent", "bg-gray-100 text-gray-600"],
};

type Row = EmailLog & {
  appointments: { full_name: string; email: string | null; date: string; time_slot: string | null; offices: { name: string; email: string | null; contact_email: string | null } | null } | null;
};

/** Delivery record of every system email: who it went to, which email, and whether it was sent. */
export function EmailLogs() {
  const today = getManilaToday();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<"" | "sent" | "failed" | "pending">("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ sent: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await adminFetch(`/api/admin/email-logs?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load email logs.");
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setTotal(data.total || 0);
      if (data.summary) setSummary(data.summary);
      setLoadError(null);
    } catch (err) { setLoadError(err instanceof Error ? err.message : "Could not load email logs."); }
    finally { setLoading(false); }
  }, [from, to, page, status, type, debouncedSearch]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const firstPage = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };
  const multiDay = from !== to;
  const recipient = (log: Row) => log.type === "admin_alert"
    ? log.appointments?.offices?.contact_email || log.appointments?.offices?.email || "Office"
    : log.appointments?.email || "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {([["sent", "Sent", "text-green-700"], ["failed", "Failed", "text-red-700"], ["pending", "Not sent", "text-gray-600"]] as const).map(([key, label, tone]) => (
          <button key={key} type="button" onClick={() => firstPage(setStatus)(status === key ? "" : key)} aria-pressed={status === key}
            className={`text-left bg-white rounded-xl border p-4 transition-all ${status === key ? "border-primary ring-1 ring-primary" : "border-gray-200 hover:border-gray-300"}`}>
            <div className={`text-2xl font-bold ${tone}`}>{summary[key]}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </button>
        ))}
      </div>
      {summary.pending > 0 && (
        <p className="text-xs text-gray-500">&quot;Not sent&quot; usually means that email is switched off in Settings &gt; Email Notifications, or the visitor gave no email address.</p>
      )}

      <div className="flex flex-col xl:flex-row xl:items-end gap-3">
        <div className="flex-1"><SearchInput value={search} onChange={firstPage(setSearch)} placeholder="Search visitor name or email..." label="Search email logs" /></div>
        <div className="xl:w-60">
          <Select value={type} onChange={(e) => firstPage(setType)(e.target.value)} aria-label="Filter by email type">
            <option value="">All email types</option>
            {Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
        <LogDateRange idPrefix="email" from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
      </div>

      {loadError && !loading ? (
        <StatusMessage message={{ type: "error", text: loadError }} onRetry={fetchLogs} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-11 rounded-lg" />)}</div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No emails match.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-gray-50">
                  <tr>{["Time", "Email", "Status", "To", "Appointment"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => {
                    const [label, badge] = STATUS_STYLES[log.status] || [log.status, "bg-gray-100 text-gray-600"];
                    const appt = log.appointments;
                    return (
                      <tr key={log.id} className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila", ...(multiDay ? { month: "short", day: "numeric" } : {}), hour: "numeric", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{TYPES[log.type] || log.type}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>{label}</span>
                          {log.status === "failed" && log.error_message && <div className="text-[11px] text-red-600 mt-1 max-w-[16rem]">{log.error_message}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 break-all">{recipient(log)}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">{appt?.full_name || "—"}</div>
                          {appt && (
                            <div className="text-[11px] text-gray-500">
                              {appt.offices?.name || "—"} · {new Date(appt.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}{appt.time_slot ? `, ${formatTimeSlot(appt.time_slot)}` : ""}
                            </div>
                          )}
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

      {!loadError && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="emails" />}
    </div>
  );
}
