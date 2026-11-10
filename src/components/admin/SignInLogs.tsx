"use client";

import { useState, useEffect, useCallback } from "react";
import type { SignInLog } from "@/types/database";
import { StatusMessage } from "@/components/admin/StatusMessage";
import { Pagination, SearchInput } from "@/components/admin/Pagination";
import { LogDateRange } from "@/components/admin/LogDateRange";
import { adminFetch } from "@/lib/admin-fetch";
import { getManilaToday } from "@/lib/time";

const PAGE_SIZE = 25;

const REASONS: Record<string, string> = {
  wrong_password: "Wrong password",
  unknown_account: "No such account",
  not_staff: "Not a staff account",
  pending_approval: "Waiting for approval",
  wrong_portal: "Wrong sign-in page",
  rate_limited: "Too many attempts",
};
const ROLES: Record<string, string> = { super_admin: "Super admin", office_admin: "Office admin", gate_admin: "Guard admin", gate_user: "Guard" };

interface Flagged { identifier: string; portal: string; count: number; last: string }

const when = (iso: string, withDate: boolean) => new Date(iso).toLocaleString("en-US", {
  timeZone: "Asia/Manila", ...(withDate ? { month: "short", day: "numeric" } : {}), hour: "numeric", minute: "2-digit", second: "2-digit",
});

/** Short device description from a browser string, e.g. "Chrome on Android". */
function describeDevice(ua: string | null): string {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

/** Sign-in attempts on the admin and gate login pages, with repeated failures flagged. */
export function SignInLogs() {
  const today = getManilaToday();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [portal, setPortal] = useState<"" | "admin" | "gate">("");
  const [outcome, setOutcome] = useState<"" | "success" | "failed">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<SignInLog[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ success: 0, failed: 0 });
  const [flagged, setFlagged] = useState<Flagged[]>([]);
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
      if (portal) params.set("portal", portal);
      if (outcome) params.set("outcome", outcome);
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await adminFetch(`/api/admin/sign-in-logs?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load sign-in activity.");
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setTotal(data.total || 0);
      if (data.summary) setSummary(data.summary);
      setFlagged(Array.isArray(data.flagged) ? data.flagged : []);
      setLoadError(null);
    } catch (err) { setLoadError(err instanceof Error ? err.message : "Could not load sign-in activity."); }
    finally { setLoading(false); }
  }, [from, to, page, portal, outcome, debouncedSearch]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const firstPage = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };
  const multiDay = from !== to;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-2xl font-bold text-green-700">{summary.success}</div><div className="text-xs text-gray-500">Successful sign-ins</div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-2xl font-bold text-red-700">{summary.failed}</div><div className="text-xs text-gray-500">Failed attempts</div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 sm:col-span-1"><div className={`text-2xl font-bold ${flagged.length ? "text-amber-700" : "text-gray-900"}`}>{flagged.length}</div><div className="text-xs text-gray-500">Accounts with 3+ failures</div></div>
      </div>

      {flagged.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm font-semibold text-amber-900">Repeated failed sign-ins in this period</p>
          <p className="text-xs text-amber-800 mt-0.5">Could be a forgotten password, or someone guessing. Click a name to see its attempts.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {flagged.map((f) => (
              <li key={`${f.portal}:${f.identifier}`}>
                <button type="button" onClick={() => { setSearch(f.identifier === "(blank)" ? "" : f.identifier); setOutcome("failed"); setPage(1); }}
                  className="px-2.5 py-1 rounded-full text-xs bg-white border border-amber-300 text-amber-900 hover:bg-amber-100">
                  <span className="font-medium">{f.identifier}</span> · {f.count} failed · {f.portal === "gate" ? "gate" : "admin"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col xl:flex-row xl:items-end gap-3">
        <div className="flex-1"><SearchInput value={search} onChange={firstPage(setSearch)} placeholder="Search email, username, name, or IP..." label="Search sign-ins" /></div>
        <LogDateRange idPrefix="signin" from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([["", "All"], ["success", "Successful"], ["failed", "Failed"]] as const).map(([key, label]) => (
          <button key={key || "all"} type="button" onClick={() => firstPage(setOutcome)(key)} aria-pressed={outcome === key}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${outcome === key ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>{label}</button>
        ))}
        <span className="w-px h-6 bg-gray-200 mx-1" aria-hidden="true" />
        {([["", "Both pages"], ["admin", "Admin login"], ["gate", "Gate login"]] as const).map(([key, label]) => (
          <button key={key || "both"} type="button" onClick={() => firstPage(setPortal)(key)} aria-pressed={portal === key}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${portal === key ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>{label}</button>
        ))}
      </div>

      {loadError && !loading ? (
        <StatusMessage message={{ type: "error", text: loadError }} onRetry={fetchLogs} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-11 rounded-lg" />)}</div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No sign-in attempts match.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-gray-50">
                  <tr>{["Time", "Result", "Account", "Page", "Device", "IP"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{when(log.created_at, multiDay)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{log.success ? "Signed in" : "Failed"}</span>
                        {!log.success && log.reason && <div className="text-[11px] text-gray-500 mt-0.5">{REASONS[log.reason] || log.reason}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{log.name || log.identifier || "—"}</div>
                        <div className="text-[11px] text-gray-500">{[log.name ? log.identifier : null, log.role ? ROLES[log.role] || log.role : null].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.portal === "gate" ? "Gate login" : "Admin login"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600" title={log.user_agent || undefined}>{describeDevice(log.user_agent)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{log.ip || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loadError && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="attempts" />}
    </div>
  );
}
