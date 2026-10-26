"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/app/admin/layout";
import { StatusMessage } from "@/components/admin/StatusMessage";
import { addDays } from "@/lib/booking-rules";
import { formatTimeSlot, getManilaToday } from "@/lib/time";
import type { AnalyticsResult } from "@/lib/analytics";
import {
  ChartCard, Columns, Funnel, HBars, Heatmap, LineChart, StatTile, VIZ,
  formatHours, formatMinutes, formatNumber, formatPercent,
} from "@/components/admin/analytics/Charts";

type AnalyticsResponse = AnalyticsResult & {
  scope: { officeId: string | null; officeName: string | null };
  onCampusNow: { groups: number; people: number };
};

type Preset = { key: string; label: string; range: (today: string) => { from: string; to: string } };

const PRESETS: Preset[] = [
  { key: "7d", label: "Last 7 days", range: (t) => ({ from: addDays(t, -6), to: t }) },
  { key: "30d", label: "Last 30 days", range: (t) => ({ from: addDays(t, -29), to: t }) },
  { key: "90d", label: "Last 90 days", range: (t) => ({ from: addDays(t, -89), to: t }) },
  { key: "month", label: "This month", range: (t) => ({ from: `${t.slice(0, 7)}-01`, to: t }) },
  { key: "next30", label: "Next 30 days", range: (t) => ({ from: t, to: addDays(t, 29) }) },
];

function formatDay(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function rowsOf(data: { label: string; value: number }[]) {
  return data.map((d) => [d.label, d.value]);
}

export default function AnalyticsPage() {
  const { admin } = useAdmin();
  const isSuperAdmin = admin.role === "super_admin";
  const today = getManilaToday();

  const [preset, setPreset] = useState("30d");
  const [range, setRange] = useState(() => PRESETS[1].range(today));
  const [officeId, setOfficeId] = useState("");
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      if (officeId) params.set("officeId", officeId);
      const res = await fetch(`/api/admin/analytics?${params}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not load analytics.");
      setData(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [range, officeId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/admin/offices")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setOffices(Array.isArray(rows) ? rows.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })) : []))
      .catch(() => setOffices([]));
  }, [isSuperAdmin]);

  if (admin.role === "gate_user") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-500">You do not have permission to view analytics.</p>
      </div>
    );
  }

  const choosePreset = (p: Preset) => { setPreset(p.key); setRange(p.range(today)); };
  const setCustom = (patch: Partial<{ from: string; to: string }>) => { setPreset("custom"); setRange((r) => ({ ...r, ...patch })); };

  const scopeLabel = data?.scope.officeName || (isSuperAdmin ? "All offices" : admin.offices?.name || "Your office");
  const k = data?.kpis;
  const showOffices = isSuperAdmin && !officeId && (data?.offices.length || 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {scopeLabel} · {formatDay(range.from)} – {formatDay(range.to)}, by scheduled visit date. Times are Philippine Time.
        </p>
      </div>

      {/* Filters: one row, scoping everything below */}
      <div className="flex flex-col xl:flex-row xl:items-end gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0" role="group" aria-label="Date range">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => choosePreset(p)} aria-pressed={preset === p.key}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${preset === p.key ? "bg-primary text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="analytics-from" className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input id="analytics-from" type="date" className="input" style={{ paddingTop: "0.375rem", paddingBottom: "0.375rem" }} value={range.from} max={range.to}
              onChange={(e) => e.target.value && setCustom({ from: e.target.value })} />
          </div>
          <div>
            <label htmlFor="analytics-to" className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input id="analytics-to" type="date" className="input" style={{ paddingTop: "0.375rem", paddingBottom: "0.375rem" }} value={range.to} min={range.from}
              onChange={(e) => e.target.value && setCustom({ to: e.target.value })} />
          </div>
          {isSuperAdmin && (
            <div>
              <label htmlFor="analytics-office" className="block text-xs font-medium text-gray-600 mb-1">Office</label>
              <select id="analytics-office" className="input sm:w-64" style={{ paddingTop: "0.375rem", paddingBottom: "0.375rem" }} value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
                <option value="">All offices</option>
                {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && <StatusMessage message={{ type: "error", text: error }} onRetry={fetchData} />}

      {!data && loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : data && k ? (
        // Refetch keeps the previous render, dimmed, instead of flashing skeletons.
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`} aria-busy={loading}>
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <div className="text-xs text-gray-500">On campus right now</div>
              <div className="text-5xl font-semibold text-gray-900 mt-1">{formatNumber(data.onCampusNow.people)}</div>
              <div className="text-xs text-gray-400 mt-1">
                {data.onCampusNow.people === 1 ? "person" : "people"} in {data.onCampusNow.groups} checked-in {data.onCampusNow.groups === 1 ? "group" : "groups"} today, not yet checked out
              </div>
            </div>
            <div className="text-xs text-gray-400 max-w-sm">
              Live count for {formatDay(today)}, independent of the date range.
              {k.missingCheckouts > 0 && <> In this range, <strong className="text-gray-700">{k.missingCheckouts}</strong> earlier {k.missingCheckouts === 1 ? "visit was" : "visits were"} checked in but never checked out.</>}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Appointments" value={formatNumber(k.requests)} hint={`${formatNumber(k.publicBookings)} booked · ${formatNumber(k.invitations)} invitations`} />
            <StatTile label="Visitors expected" value={formatNumber(k.visitorsExpected)} hint={`${formatNumber(k.vehicles)} vehicles registered`} />
            <StatTile label="Approval rate" value={formatPercent(k.approvalRate)} hint={`${formatNumber(k.pending)} still pending`} />
            <StatTile label="Show-up rate" value={formatPercent(k.showUpRate)} hint="Approved visits that arrived" />
            <StatTile label="Gate check-ins" value={formatNumber(k.checkIns)} hint={`${formatNumber(k.checkOuts)} checked out`} />
            <StatTile label="Average time on campus" value={formatMinutes(k.avgMinutesOnCampus)} hint={`Median ${formatMinutes(k.medianMinutesOnCampus)}`} />
            <StatTile label="Median response time" value={formatHours(k.medianResponseHours)} hint="Request to approve/decline" />
            <StatTile label="Missing checkouts" value={formatNumber(k.missingCheckouts)} hint="Checked in, never checked out" />
          </div>

          <ChartCard title="Daily activity" subtitle="Scheduled appointments vs. gate check-ins per day"
            table={{ columns: ["Date", "Scheduled", "Check-ins"], rows: data.daily.map((d) => [formatDay(d.date), d.scheduled, d.checkIns]) }}>
            <LineChart labels={data.daily.map((d) => d.date)} formatLabel={formatDay} series={[
              { key: "scheduled", label: "Scheduled appointments", color: VIZ.series1, values: data.daily.map((d) => d.scheduled) },
              { key: "checkIns", label: "Gate check-ins", color: VIZ.series2, values: data.daily.map((d) => d.checkIns) },
            ]} />
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Visit funnel" subtitle="From request to checkout" table={{ columns: ["Stage", "Appointments"], rows: rowsOf(data.funnel) }}>
              <Funnel data={data.funnel} />
            </ChartCard>
            <ChartCard title="Status breakdown" subtitle="Current status of appointments in this range" table={{ columns: ["Status", "Appointments"], rows: rowsOf(data.statuses) }}>
              <HBars data={data.statuses} unit="appointments" />
            </ChartCard>
          </div>

          <ChartCard title="Busiest times" subtitle="Appointments by weekday and time slot"
            table={{
              columns: ["Weekday", ...data.heatmap.slots.map(formatTimeSlot)],
              rows: data.heatmap.weekdays.map((w, i) => [w, ...data.heatmap.counts[i]]),
            }}>
            <Heatmap rows={data.heatmap.weekdays} columns={data.heatmap.slots} counts={data.heatmap.counts} columnLabel={formatTimeSlot} />
          </ChartCard>

          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Gate activity</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ChartCard title="Check-ins by hour" subtitle="When visitors arrive at the gate" table={{ columns: ["Hour", "Check-ins"], rows: rowsOf(data.checkInsByHour) }}>
                <Columns data={data.checkInsByHour} unit="check-ins" />
              </ChartCard>
              <ChartCard title="Arrival punctuality" subtitle="Check-in time vs. scheduled time" table={{ columns: ["Arrival", "Visits"], rows: rowsOf(data.punctuality) }}>
                <HBars data={data.punctuality} unit="visits" />
              </ChartCard>
              <ChartCard title="Time on campus" subtitle="Check-in to checkout" table={{ columns: ["Duration", "Visits"], rows: rowsOf(data.timeOnCampus) }}>
                <HBars data={data.timeOnCampus} unit="visits" />
              </ChartCard>
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Booking behavior</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ChartCard title="Booking lead time" subtitle="Days between booking and visit (excludes invitations)" table={{ columns: ["Lead time", "Bookings"], rows: rowsOf(data.leadTime) }}>
                <Columns data={data.leadTime} unit="bookings" />
              </ChartCard>
              <ChartCard title="Admin response time" subtitle="Request to first approve, decline or postpone" table={{ columns: ["Response", "Requests"], rows: rowsOf(data.responseTime) }}>
                <Columns data={data.responseTime} unit="requests" />
              </ChartCard>
              <ChartCard title="Visits by weekday" table={{ columns: ["Weekday", "Appointments"], rows: rowsOf(data.weekdays) }}>
                <Columns data={data.weekdays} unit="appointments" />
              </ChartCard>
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Visitors</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ChartCard title="Visitor category" table={{ columns: ["Category", "Appointments"], rows: rowsOf(data.categories) }}>
                <HBars data={data.categories} unit="appointments" />
              </ChartCard>
              <ChartCard title="Group size" subtitle="People per appointment" table={{ columns: ["Group size", "Appointments"], rows: rowsOf(data.groupSizes) }}>
                <HBars data={data.groupSizes} unit="appointments" />
              </ChartCard>
              <ChartCard title="Meeting length" table={{ columns: ["Duration", "Appointments"], rows: rowsOf(data.durations) }}>
                <HBars data={data.durations} unit="appointments" />
              </ChartCard>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Most requested people to meet" subtitle="Top 10" table={{ columns: ["Person", "Appointments"], rows: rowsOf(data.topPeopleToMeet) }}>
              <HBars data={data.topPeopleToMeet} unit="appointments" />
            </ChartCard>
            <ChartCard title="Valid IDs presented" subtitle="Most common ID types" table={{ columns: ["ID type", "Appointments"], rows: rowsOf(data.topValidIds) }}>
              <HBars data={data.topValidIds} unit="appointments" />
            </ChartCard>
          </div>

          {showOffices && (
            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <h2 className="text-sm font-semibold text-gray-900">By office</h2>
                <p className="text-xs text-gray-500 mt-0.5">Sorted by appointments. Choose an office above to focus every chart on it.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Office", "Appointments", "Visitors", "Approval", "Show-up", "Check-ins", "Avg. on campus"].map((c, i) => (
                        <th key={c} className={`px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide ${i === 0 ? "text-left" : "text-right"}`}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.offices.map((o) => {
                      const share = data.offices[0].requests ? o.requests / data.offices[0].requests : 0;
                      return (
                        <tr key={o.officeId} className="hover:bg-gray-50">
                          <td className="px-5 py-2.5">
                            <button type="button" onClick={() => setOfficeId(o.officeId)} className="text-left text-gray-900 font-medium hover:text-primary hover:underline">
                              {o.officeName}
                            </button>
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 h-2 flex items-center" aria-hidden="true">
                                <div className="h-2 rounded-r" style={{ width: `${Math.max(share * 100, 2)}%`, background: VIZ.series1 }} />
                              </div>
                              <span className="tabular-nums text-gray-900 w-10">{formatNumber(o.requests)}</span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-gray-700">{formatNumber(o.visitors)}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-gray-700">{formatPercent(o.approvalRate)}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-gray-700">{formatPercent(o.showUpRate)}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-gray-700">{formatNumber(o.checkIns)}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-gray-700">{formatMinutes(o.avgMinutesOnCampus)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <p className="text-xs text-gray-400">
            Approval rate counts booked requests that were decided (excludes invitations and pending ones). Show-up rate covers approved visits whose date has passed.
            Response time uses the audit log, so it only covers decisions recorded there.
          </p>
        </div>
      ) : null}
    </div>
  );
}
