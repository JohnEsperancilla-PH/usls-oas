"use client";

import { useState, useEffect, useCallback } from "react";
import type { AuditLog } from "@/types/database";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/audit", {});
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setLogs(data || []);
    } catch { console.error("Failed to fetch audit logs"); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchLogs(); }, []);

  const getActionBadge = (action: string) => {
    const badges: Record<string, string> = {
      approve: "bg-green-100 text-green-800",
      decline: "bg-red-100 text-red-800",
      create_account: "bg-blue-100 text-blue-800",
      delete_account: "bg-red-100 text-red-800",
      create_office: "bg-blue-100 text-blue-800",
      update_office: "bg-yellow-100 text-yellow-800",
      delete_office: "bg-red-100 text-red-800",
      login: "bg-indigo-100 text-indigo-800",
    };
    return badges[action] || "bg-gray-100 text-gray-600";
  };

  const formatAction = (action: string) => action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div></div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No audit logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.admin_email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionBadge(log.action)}`}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.target_email && <span>Target: {log.target_email}</span>}
                      {log.details && <span className="ml-2 text-gray-400">{JSON.stringify(log.details)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
