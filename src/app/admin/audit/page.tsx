"use client";

import { useState, useEffect, useCallback } from "react";
import type { AuditLog } from "@/types/database";
import { StatusMessage } from "@/components/admin/StatusMessage";
import { Pagination, SearchInput } from "@/components/admin/Pagination";
import { AUDIT_ACTION_OPTIONS, formatAuditValue, getAuditActionLabel, getAuditChanges, getAuditFieldLabel, getAuditSummary, getAuditTarget } from "@/lib/audit";
import { Select } from "@/components/ui/Select";
import { ModalShell } from "@/components/admin/ModalShell";

// Details fields that are shown elsewhere in the modal, or are internal.
const HIDDEN_DETAIL_KEYS = new Set(["changes", "previous_role", "original_date", "original_time", "new_date", "new_time"]);

function AuditDetailsModal({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  const changes = log ? getAuditChanges(log) : null;
  const otherDetails = Object.entries(log?.details || {}).filter(([key, v]) => !HIDDEN_DETAIL_KEYS.has(key) && v !== null && v !== undefined && v !== "");
  const isUpdate = Boolean(log && (log.action.startsWith("update_") || log.action === "postpone"));

  return (
    <ModalShell open={Boolean(log)} title={log ? getAuditActionLabel(log.action) : ""} subtitle={log ? `${formatManila(log.created_at)} · ${log.admin_email}` : undefined}
      onClose={onClose} maxWidthClass="max-w-2xl"
      footer={<button type="button" onClick={onClose} className="btn-secondary w-full btn-sm">Close</button>}>
      {log && (
        <div className="space-y-5">
          <div>
            <div className="text-sm font-medium text-gray-900">{getAuditTarget(log)}</div>
            <div className="text-sm text-gray-500">{getAuditSummary(log)}</div>
          </div>

          {changes && Object.keys(changes).length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">What changed</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="hidden sm:grid grid-cols-[minmax(0,10rem)_1fr_1fr] bg-gray-50 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  <div className="px-3 py-2">Field</div><div className="px-3 py-2">Before</div><div className="px-3 py-2">After</div>
                </div>
                <dl className="divide-y divide-gray-100">
                  {Object.entries(changes).map(([field, { before, after }]) => (
                    <div key={field} className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_1fr_1fr] text-sm">
                      <dt className="px-3 pt-2 sm:py-2 font-medium text-gray-700">{getAuditFieldLabel(field)}</dt>
                      <dd className="px-3 py-1 sm:py-2">
                        <span className="sm:hidden text-[10px] uppercase text-gray-400 mr-1">Before</span>
                        <span className="inline-block rounded px-1.5 py-0.5 bg-red-50 text-red-700 line-through decoration-red-300 whitespace-pre-wrap break-words">{formatAuditValue(before)}</span>
                      </dd>
                      <dd className="px-3 pb-2 sm:py-2">
                        <span className="sm:hidden text-[10px] uppercase text-gray-400 mr-1">After</span>
                        <span className="inline-block rounded px-1.5 py-0.5 bg-green-50 text-green-800 whitespace-pre-wrap break-words">{formatAuditValue(after)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          ) : isUpdate ? (
            <p className="text-xs text-gray-500 p-3 rounded-lg bg-gray-50 border border-dashed border-gray-200">
              This entry was recorded before before-and-after tracking was added, so only the saved values are shown below.
            </p>
          ) : null}

          {otherDetails.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{changes ? "Other details" : "Details"}</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1.5 text-sm">
                {otherDetails.map(([key, v]) => (
                  <div key={key} className="contents">
                    <dt className="text-gray-500">{getAuditFieldLabel(key)}</dt>
                    <dd className="text-gray-800 break-words whitespace-pre-wrap mb-1 sm:mb-0">{formatAuditValue(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {log.target_email && (
            <p className="text-xs text-gray-400">Target: {log.target_email}</p>
          )}
        </div>
      )}
    </ModalShell>
  );
}

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
  const [viewing, setViewing] = useState<AuditLog | null>(null);

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
            <Select id="audit-action" value={action} onChange={(e) => withFirstPage(setAction)(e.target.value)} className="lg:w-56">
              <option value="">All actions</option>
              {AUDIT_ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"><span className="sr-only">Details</span></th>
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
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {(() => {
                        const changeCount = Object.keys(getAuditChanges(log) || {}).length;
                        return (
                          <button type="button" onClick={() => setViewing(log)}
                            aria-label={`View details of ${getAuditActionLabel(log.action)} by ${log.admin_email}`}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${changeCount > 0 ? "text-primary bg-primary/5 hover:bg-primary/10" : "text-gray-600 bg-gray-50 hover:bg-gray-100"}`}>
                            {changeCount > 0 ? `View changes (${changeCount})` : "View"}
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loadError && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="entries" />}

      <AuditDetailsModal log={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
