"use client";

import { useRef, useState } from "react";

// Chart tokens: validated categorical slots 1-2, the blue sequential ramp, and recessive chrome.
export const VIZ = {
  series1: "#2a78d6",
  series2: "#eb6834",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  muted: "#898781",
  textSecondary: "#52514e",
  empty: "#f0efec",
};
const SEQUENTIAL = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const ORDINAL = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"];

export interface Datum {
  label: string;
  value: number;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("en-US");
}

export function formatPercent(r: number | null): string {
  return r === null ? "—" : `${Math.round(r * 100)}%`;
}

export function formatMinutes(m: number | null): string {
  if (m === null) return "—";
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const rest = Math.round(m % 60);
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export function formatHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0).replace(/\.0$/, "")} h`;
  return `${(h / 24).toFixed(1).replace(/\.0$/, "")} days`;
}

function niceMax(max: number): number {
  if (max <= 4) return Math.max(1, Math.ceil(max));
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

/* ─── Tooltip ─── */

type TipRow = { label: string; value: string; color?: string };
type Tip = { x: number; y: number; title: string; rows: TipRow[] };

function useTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  // Position in viewport coordinates; stored relative to the chart container.
  const showAtClient = (clientX: number, clientY: number, title: string, rows: TipRow[]) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const x = clientX - box.left;
    setTip({ x: Math.min(Math.max(x, 80), box.width - 80), y: clientY - box.top, title, rows });
  };

  // Pointer: follow the cursor. Focus: sit above the focused mark.
  const show = (e: React.PointerEvent | React.FocusEvent, title: string, rows: TipRow[]) => {
    if ("clientX" in e) return showAtClient(e.clientX, e.clientY, title, rows);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    showAtClient(r.left + r.width / 2, r.top, title, rows);
  };

  return { ref, tip, show, showAtClient, hide: () => setTip(null) };
}

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div role="tooltip" className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs whitespace-nowrap"
      style={{ left: tip.x, top: tip.y - 10 }}>
      <div className="text-gray-500 mb-1">{tip.title}</div>
      {tip.rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          {row.color && <span className="inline-block w-3 h-0.5 rounded" style={{ background: row.color }} aria-hidden="true" />}
          <span className="font-semibold text-gray-900 tabular-nums">{row.value}</span>
          <span className="text-gray-500">{row.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Card with table view ─── */

export function ChartCard({ title, subtitle, table, children, className = "" }: {
  title: string;
  subtitle?: string;
  table?: { columns: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {table && (
          <button type="button" onClick={() => setShowTable(!showTable)} aria-pressed={showTable}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 flex-shrink-0">
            {showTable ? "Chart" : "Table"}
          </button>
        )}
      </div>
      {showTable && table ? (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {table.columns.map((c, i) => (
                  <th key={c} className={`py-2 pr-3 text-xs font-medium text-gray-500 ${i === 0 ? "text-left" : "text-right"}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {table.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, i) => (
                    <td key={i} className={`py-1.5 pr-3 ${i === 0 ? "text-gray-700" : "text-right tabular-nums text-gray-900"}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : children}
    </section>
  );
}

export function EmptyChart({ text = "No data for this period" }: { text?: string }) {
  return <div className="py-10 text-center text-sm text-gray-400">{text}</div>;
}

/* ─── Stat tile ─── */

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
      {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

/* ─── Horizontal bars (magnitude by category, one hue) ─── */

export function HBars({ data, color = VIZ.series1, unit = "", ramp = false }: { data: Datum[]; color?: string; unit?: string; ramp?: boolean }) {
  const { ref, tip, show, hide } = useTooltip();
  const max = Math.max(...data.map((d) => d.value), 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyChart />;

  return (
    // The tooltip sits outside the spaced list: as the list's last child it would shift `space-y` margins and resize the card.
    <div ref={ref} className="relative">
      <div className="space-y-2.5">
      {data.map((d, i) => {
        const share = total ? Math.round((d.value / total) * 100) : 0;
        const fill = ramp ? ORDINAL[Math.min(i, ORDINAL.length - 1)] : color;
        const rows = [{ label: unit || "count", value: d.value.toLocaleString("en-US") }, { label: "of total", value: `${share}%` }];
        return (
          <div key={d.label} tabIndex={0} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group"
            onPointerMove={(e) => show(e, d.label, rows)} onPointerLeave={hide} onFocus={(e) => show(e, d.label, rows)} onBlur={hide}>
            <span className="text-xs text-gray-600 truncate" title={d.label}>{d.label}</span>
            <div className="h-6 flex items-center">
              <div className="h-3.5 rounded-r transition-opacity group-hover:opacity-80" style={{ width: `${max ? Math.max((d.value / max) * 100, d.value ? 1.5 : 0) : 0}%`, background: fill }} />
            </div>
            <span className="text-xs font-medium text-gray-900 tabular-nums w-10 text-right">{formatNumber(d.value)}</span>
          </div>
        );
      })}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ─── Funnel: ordered stages, ordinal ramp, conversion from the previous stage ─── */

export function Funnel({ data }: { data: Datum[] }) {
  const { ref, tip, show, hide } = useTooltip();
  const top = data[0]?.value || 0;
  if (!top) return <EmptyChart />;
  return (
    <div ref={ref} className="relative">
      <div className="space-y-3">
      {data.map((d, i) => {
        const prev = i > 0 ? data[i - 1].value : null;
        const step = prev ? Math.round((d.value / prev) * 100) : null;
        const rows = [
          { label: "appointments", value: d.value.toLocaleString("en-US") },
          ...(step !== null ? [{ label: `of ${data[i - 1].label.toLowerCase()}`, value: `${step}%` }] : []),
        ];
        return (
          <div key={d.label} tabIndex={0} className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group"
            onPointerMove={(e) => show(e, d.label, rows)} onPointerLeave={hide} onFocus={(e) => show(e, d.label, rows)} onBlur={hide}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-gray-600">{d.label}</span>
              <span className="text-gray-900 font-medium tabular-nums">
                {formatNumber(d.value)}
                {step !== null && <span className="text-gray-400 font-normal ml-1.5">{step}% of previous</span>}
              </span>
            </div>
            <div className="h-4 flex items-center">
              <div className="h-4 rounded-r transition-opacity group-hover:opacity-80" style={{ width: `${Math.max((d.value / top) * 100, d.value ? 1 : 0)}%`, background: ORDINAL[i % ORDINAL.length] }} />
            </div>
          </div>
        );
      })}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ─── Columns (single series over ordered categories) ─── */

export function Columns({ data, color = VIZ.series1, unit = "count", height = 160 }: { data: Datum[]; color?: string; unit?: string; height?: number }) {
  const { ref, tip, show, hide } = useTooltip();
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  if (data.every((d) => d.value === 0)) return <EmptyChart />;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div ref={ref} className="relative">
      <div className="flex">
        <div className="relative w-8 flex-shrink-0 text-[10px] text-gray-400 tabular-nums" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-1.5 -translate-y-1/2" style={{ top: `${(1 - t / max) * 100}%` }}>{formatNumber(t)}</span>
          ))}
        </div>
        <div className="relative flex-1 min-w-0">
          <div className="relative" style={{ height }}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 h-px" style={{ top: `${(1 - t / max) * 100}%`, background: t === 0 ? VIZ.axis : VIZ.grid }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-0.5">
              {data.map((d) => {
                const rows = [{ label: unit, value: d.value.toLocaleString("en-US") }];
                return (
                  <div key={d.label} tabIndex={0} aria-label={`${d.label}: ${d.value}`}
                    className="flex-1 h-full flex items-end justify-center group focus:outline-none focus-visible:bg-gray-100 rounded-sm"
                    onPointerMove={(e) => show(e, d.label, rows)} onPointerLeave={hide} onFocus={(e) => show(e, d.label, rows)} onBlur={hide}>
                    <div className="w-full max-w-6 rounded-t transition-opacity group-hover:opacity-80" style={{ height: `${(d.value / max) * 100}%`, background: color, minHeight: d.value ? 2 : 0 }} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-0.5 mt-1.5">
            {data.map((d, i) => (
              <span key={d.label} className="flex-1 text-center text-[10px] text-gray-400 truncate">{i % labelEvery === 0 ? d.label : ""}</span>
            ))}
          </div>
        </div>
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ─── Line chart over dates, one shared axis, crosshair tooltip ─── */

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

export function LineChart({ labels, series, height = 200, formatLabel = (s: string) => s }: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  formatLabel?: (label: string) => string;
}) {
  const { ref, tip, show, showAtClient, hide } = useTooltip();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const max = niceMax(Math.max(...series.flatMap((s) => s.values), 0));
  const n = labels.length;
  if (n === 0 || series.every((s) => s.values.every((v) => v === 0))) return <EmptyChart />;

  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => (1 - v / max) * 100;
  const ticks = [0, max / 2, max];

  const showAt = (index: number, e: React.PointerEvent | React.FocusEvent) => {
    setHoverIndex(index);
    show(e, formatLabel(labels[index]), series.map((s) => ({ label: s.label, value: s.values[index].toLocaleString("en-US"), color: s.color })));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const index = Math.round(((e.clientX - box.left) / box.width) * (n - 1));
    showAt(Math.min(Math.max(index, 0), n - 1), e);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = Math.min(Math.max((hoverIndex ?? -1) + (e.key === "ArrowRight" ? 1 : -1), 0), n - 1);
    setHoverIndex(next);
    // Keyboard readout pinned above the crosshair.
    const box = e.currentTarget.getBoundingClientRect();
    showAtClient(box.left + (x(next) / 100) * box.width, box.top, formatLabel(labels[next]),
      series.map((s) => ({ label: s.label, value: s.values[next].toLocaleString("en-US"), color: s.color })));
  };

  const tickLabels = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex">
        <div className="relative w-8 flex-shrink-0 text-[10px] text-gray-400 tabular-nums" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-1.5 -translate-y-1/2" style={{ top: `${y(t)}%` }}>{formatNumber(t)}</span>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded" style={{ height }} tabIndex={0}
            aria-label="Daily trend. Use left and right arrow keys to read values."
            onPointerMove={onPointerMove} onPointerLeave={() => { hide(); setHoverIndex(null); }} onKeyDown={onKeyDown} onBlur={() => { hide(); setHoverIndex(null); }}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 h-px" style={{ top: `${y(t)}%`, background: t === 0 ? VIZ.axis : VIZ.grid }} />
            ))}
            <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {series.map((s) => (
                <g key={s.key}>
                  {series.length === 1 && (
                    <path d={`M ${x(0)} 100 ${s.values.map((v, i) => `L ${x(i)} ${y(v)}`).join(" ")} L ${x(n - 1)} 100 Z`} fill={s.color} fillOpacity={0.1} />
                  )}
                  <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2}
                    strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </svg>
            {hoverIndex !== null && (
              <>
                <div className="absolute top-0 bottom-0 w-px pointer-events-none" style={{ left: `${x(hoverIndex)}%`, background: VIZ.axis }} />
                {series.map((s) => (
                  <div key={s.key} className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: `${x(hoverIndex)}%`, top: `${y(s.values[hoverIndex])}%`, background: s.color, boxShadow: "0 0 0 2px #fff" }} />
                ))}
              </>
            )}
          </div>
          <div className="relative h-5 mt-1.5 text-[10px] text-gray-400">
            {tickLabels.map((i) => (
              <span key={i} className={`absolute whitespace-nowrap ${i === 0 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${x(i)}%` }}>
                {formatLabel(labels[i])}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ─── Heatmap (weekday × time slot), sequential blue ─── */

export function Heatmap({ rows, columns, counts, columnLabel = (c: string) => c }: {
  rows: string[];
  columns: string[];
  counts: number[][];
  columnLabel?: (c: string) => string;
}) {
  const { ref, tip, show, hide } = useTooltip();
  const max = Math.max(...counts.flat(), 0);
  if (max === 0) return <EmptyChart text="No booked time slots in this period" />;
  const colorFor = (v: number) => (v === 0 ? VIZ.empty : SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.floor((v / max) * (SEQUENTIAL.length - 1e-9)))]);

  return (
    <div ref={ref} className="relative">
      <div className="overflow-x-auto">
        <div className="inline-grid gap-0.5 min-w-full" style={{ gridTemplateColumns: `2.5rem repeat(${columns.length}, minmax(1.75rem, 1fr))` }}>
          <span />
          {columns.map((c, i) => (
            <span key={c} className="text-[10px] text-gray-400 text-center pb-1 whitespace-nowrap">{i % 2 === 0 ? columnLabel(c) : ""}</span>
          ))}
          {rows.map((r, ri) => (
            <div key={r} className="contents">
              <span className="text-[11px] text-gray-500 flex items-center">{r}</span>
              {columns.map((c, ci) => {
                const v = counts[ri][ci];
                const rowsTip = [{ label: v === 1 ? "appointment" : "appointments", value: v.toLocaleString("en-US") }];
                return (
                  <div key={c} tabIndex={0} aria-label={`${r} ${columnLabel(c)}: ${v}`}
                    className="h-7 rounded-sm transition-[filter] hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    style={{ background: colorFor(v) }}
                    onPointerMove={(e) => show(e, `${r}, ${columnLabel(c)}`, rowsTip)} onPointerLeave={hide}
                    onFocus={(e) => show(e, `${r}, ${columnLabel(c)}`, rowsTip)} onBlur={hide} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400">
        <span>Fewer</span>
        <div className="flex gap-0.5" aria-hidden="true">
          {[VIZ.empty, ...SEQUENTIAL].map((c) => <span key={c} className="w-4 h-2.5 rounded-sm" style={{ background: c }} />)}
        </div>
        <span>More (max {max})</span>
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}
