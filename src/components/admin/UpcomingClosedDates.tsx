"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ClosedDate } from "@/types/database";
import { adminFetch } from "@/lib/admin-fetch";

/** Dashboard strip listing the next few campus-wide closed dates, with a link to manage them. */
export function UpcomingClosedDates() {
  const [rows, setRows] = useState<ClosedDate[] | null>(null);

  useEffect(() => {
    adminFetch("/api/admin/closed-dates")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, []);

  const upcoming = (rows || []).slice(0, 4);

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 flex-shrink-0">
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <span className="text-sm font-semibold text-gray-900">Closed dates</span>
      </div>
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
        {rows === null ? (
          <div className="skeleton h-6 w-48 rounded-full" />
        ) : upcoming.length === 0 ? (
          <span className="text-xs text-gray-400">No upcoming holidays or closures.</span>
        ) : (
          <>
            {upcoming.map((row) => (
              <span key={row.id} className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700 border border-red-100 whitespace-nowrap">
                {new Date(row.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {row.reason}
              </span>
            ))}
            {rows.length > upcoming.length && <span className="text-xs text-gray-400">+{rows.length - upcoming.length} more</span>}
          </>
        )}
      </div>
      <Link href="/admin/closed-dates" className="btn-secondary btn-sm flex-shrink-0 text-center">Manage closed dates</Link>
    </div>
  );
}
