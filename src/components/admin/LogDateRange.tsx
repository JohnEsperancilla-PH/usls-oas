"use client";

import { getManilaToday } from "@/lib/time";

export function shiftDate(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** From/To dates plus Today / Yesterday / Last 7 / Last 30 shortcuts, shared by the log tabs. */
export function LogDateRange({ from, to, onChange, idPrefix }: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  idPrefix: string;
}) {
  const today = getManilaToday();
  const presets = [
    { label: "Today", from: today, to: today },
    { label: "Yesterday", from: shiftDate(today, -1), to: shiftDate(today, -1) },
    { label: "Last 7 days", from: shiftDate(today, -6), to: today },
    { label: "Last 30 days", from: shiftDate(today, -29), to: today },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
        <div>
          <label htmlFor={`${idPrefix}-from`} className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input id={`${idPrefix}-from`} type="date" value={from} max={to}
            onChange={(e) => e.target.value && onChange(e.target.value, to < e.target.value ? e.target.value : to)} className="input" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-to`} className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input id={`${idPrefix}-to`} type="date" value={to} min={from}
            onChange={(e) => e.target.value && onChange(from, e.target.value)} className="input" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:pb-2">
        {presets.map((p) => {
          const active = from === p.from && to === p.to;
          return (
            <button key={p.label} type="button" onClick={() => onChange(p.from, p.to)} aria-pressed={active}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${active ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"}`}>
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
