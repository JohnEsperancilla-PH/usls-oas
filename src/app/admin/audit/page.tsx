"use client";

import { useState, useEffect, useCallback } from "react";
import type { AuditLog } from "@/types/database";
import { StatusMessage } from "@/components/admin/StatusMessage";
import { Pagination, SearchInput } from "@/components/admin/Pagination";
import { AUDIT_ACTION_OPTIONS, getAuditActionLabel, getAuditSummary, getAuditTarget } from "@/lib/audit";

const PAGE_SIZE = 25;

function formatManila(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await fetch(`/api/admin/audit?${params}`);
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setLoadError(false);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [page, debouncedSearch, action, from, to]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Any filter change goes back to the first page.
  const withFirstPage = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setPage(1); };
  const hasFilters = Boolean(search || action || from || to);
  const clearFilters = () => { setSearch(""); setAction(""); setFrom(""); setTo(""); setPage(1); };

  const getActionBadge = (action: string) => {
    const badges: Record<string, string> = {
      approve: "bg-green-100 text-green-800",
      decline: "bg-red-100 text-red-800",
      postpone: "bg-orange-100 text-orange-800",
      create_invitation: "bg-teal-100 text-teal-800",
      create_contact: "bg-cyan-100 text-cyan-800",
      update_contact: "bg-cyan-100 text-cyan-800",
      delete_contact: "bg-cyan-100 text-cyan-800",
      create_account: "bg-blue-100 text-blue-800",
      update_account: "bg-blue-100 text-blue-800",
      delete_account: "bg-red-100 text-red-800",
      reset_password: "bg-amber-100 text-amber-800",
      create_office: "bg-blue-100 text-blue-800",
      update_office: "bg-yellow-100 text-yellow-800",
      delete_office: "bg-red-100 text-red-800",
      login: "bg-indigo-100 text-indigo-800",
      entry: "bg-green-100 text-green-800",
    };
    return badges[action] || "bg-gray-100 text-gray-600";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-0.5">Who did what, and when, across the system. Times are Philippine Time.</p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <SearchInput value={search} onChange={withFirstPage(setSearch)} placeholder="Search by admin or target email..." label="Search audit log" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:flex lg:items-end">
          <div>
            <label htmlFor="audit-action" className="block text-xs font-medium text-gray-600 mb-1">Action</label>
            <select id="audit-action" value={action} onChange={(e) => withFirstPage(setAction)(e.target.value)} className="input lg:w-56">
              <option value="">All actions</option>
              {AUDIT_ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="audit-from" className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input id="audit-from" type="date" value={from} max={to || undefined} onChange={(e) => withFirstPage(setFrom)(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="audit-to" className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input id="audit-to" type="date" value={to} min={from || undefined} onChange={(e) => withFirstPage(setTo)(e.target.value)} className="input" />
          </div>
        </div>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="btn-ghost btn-sm self-start lg:self-end lg:mb-1.5">Clear filters</button>
        )}
      </div>

      {loadError && !loading && (
        <StatusMessage message={{ type: "error", text: "Could not load the audit log. Check your connection and try again." }} onRetry={fetchLogs} />
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" hidden={loadError && !loading}>
        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div></div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {hasFilters ? "No audit entries match these filters." : "No audit logs found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target and summary</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatManila(log.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{log.admin_email}</div>
                      {log.details?.role !== undefined && <div className="text-xs text-gray-400">{String(log.details.role)}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionBadge(log.action)}`}>
                        {getAuditActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="font-medium text-gray-800">{getAuditTarget(log)}</div>
                      <div>{getAuditSummary(log)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loadError && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="entries" />}
    </div>
  );
}
