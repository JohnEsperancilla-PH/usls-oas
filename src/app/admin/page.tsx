"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import type { Appointment, Office, BlockedTime } from "@/types/database";

export default function AdminDashboardPage() {
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "super_admin";
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/appointments?status=${filter}`, {
        headers: { "x-admin-email": admin?.email || "" },
      });
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setAppointments(data || []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [filter, admin]);

  const fetchAllAppointments = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/appointments?status=all", {
        headers: { "x-admin-email": admin?.email || "" },
      });
      if (!response.ok) return;
      const data = await response.json();
      setAllAppointments(data || []);
    } catch { /* */ }
  }, [admin]);

  const fetchOffices = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/offices", { headers: { "x-admin-email": admin?.email || "" } });
      if (!response.ok) return;
      const data = await response.json();
      setOffices(data || []);
    } catch { /* */ }
  }, [admin]);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchAppointments(); fetchAllAppointments(); fetchOffices(); }, [filter]);

  const getOfficeName = (officeId: string) => offices.find((o) => o.id === officeId)?.name || "Unknown";

  const handleApprove = async (appointment: Appointment) => {
    setActionLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/appointments/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-email": admin?.email || "" },
        body: JSON.stringify({ appointmentId: appointment.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const emailMsg = data.emailSent ? "" : " (email failed to send — check SMTP logs)";
      setMessage({ type: data.emailSent ? "success" : "error", text: `Appointment approved${emailMsg}` });
      setSelectedAppointment(null);
      fetchAppointments(); fetchAllAppointments();
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setActionLoading(false); }
  };

  const handleDecline = async (appointment: Appointment, reason?: string) => {
    setActionLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/appointments/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-email": admin?.email || "" },
        body: JSON.stringify({ appointmentId: appointment.id, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage({ type: "success", text: "Appointment declined" });
      setSelectedAppointment(null);
      fetchAppointments(); fetchAllAppointments();
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setActionLoading(false); }
  };

  const stats = {
    pending: allAppointments.filter((a) => a.status === "pending").length,
    approved: allAppointments.filter((a) => a.status === "approved").length,
    declined: allAppointments.filter((a) => a.status === "declined").length,
    total: allAppointments.length,
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = { pending: "status-pending", approved: "status-approved", declined: "status-declined", completed: "status-completed", expired: "status-expired" };
    return map[status] || "status-expired";
  };

  if (!isSuperAdmin) {
    return <CalendarView admin={admin} appointments={appointments} offices={offices} loading={loading} calendarDate={calendarDate} setCalendarDate={setCalendarDate} filter={filter} setFilter={setFilter} getOfficeName={getOfficeName} setSelectedAppointment={setSelectedAppointment} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and review appointment requests</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Pending", value: stats.pending, color: "text-amber-600", bg: "bg-amber-50", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
          { label: "Approved", value: stats.approved, color: "text-green-600", bg: "bg-green-50", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
          { label: "Declined", value: stats.declined, color: "text-red-600", bg: "bg-red-50", icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" },
          { label: "Total", value: stats.total, color: "text-gray-600", bg: "bg-gray-50", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <svg className={`w-5 h-5 ${s.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {["pending", "approved", "declined", "all"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === s ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === "pending" && stats.pending > 0 && <span className="ml-1.5 bg-white/20 px-1.5 rounded-full text-xs">{stats.pending}</span>}
          </button>
        ))}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in ${message.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {message.type === "success" ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          {message.text}
        </div>
      )}

      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" /></div>
        ) : appointments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <p className="text-sm text-gray-500">No {filter !== "all" ? filter : ""} appointments</p>
          </div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visitor</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Office</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {appointments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="text-sm font-medium text-gray-900">{a.full_name}</div>
                    <div className="text-xs text-gray-400">{a.email}</div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{getOfficeName(a.office_id)}</td>
                  <td className="px-5 py-3.5">
                    <div className="text-sm text-gray-900">{new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                    <div className="text-xs text-gray-400">{a.time_slot} · {a.duration}m</div>
                  </td>
                  <td className="px-5 py-3.5"><span className={getStatusBadge(a.status)}>{a.status}</span></td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setSelectedAppointment(a)} className="text-xs font-medium text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition-colors">View</button>
                      {a.status === "pending" && (
                        <>
                          <button onClick={() => handleApprove(a)} disabled={actionLoading} className="text-xs font-medium text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50 transition-colors disabled:opacity-50">Approve</button>
                          <button onClick={() => handleDecline(a)} disabled={actionLoading} className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50">Decline</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></div>
        ) : appointments.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">No {filter !== "all" ? filter : ""} appointments</div>
        ) : (
          appointments.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900">{a.full_name}</div>
                  <div className="text-xs text-gray-400">{a.email}</div>
                </div>
                <span className={getStatusBadge(a.status)}>{a.status}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{getOfficeName(a.office_id)}</span>
                <span>{new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <span>{a.time_slot}</span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => setSelectedAppointment(a)} className="flex-1 text-center text-xs font-medium text-gray-600 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">View Details</button>
                {a.status === "pending" && (
                  <>
                    <button onClick={() => handleApprove(a)} disabled={actionLoading} className="flex-1 text-center text-xs font-medium text-green-600 py-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50">Approve</button>
                    <button onClick={() => handleDecline(a)} disabled={actionLoading} className="flex-1 text-center text-xs font-medium text-red-500 py-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50">Decline</button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedAppointment && (
        <DetailModal appointment={selectedAppointment} offices={offices} onApprove={handleApprove} onDecline={handleDecline} onClose={() => setSelectedAppointment(null)} actionLoading={actionLoading} getStatusBadge={getStatusBadge} />
      )}
    </div>
  );
}

/* ─── Calendar View (office admins) ─── */

function CalendarView({ admin, appointments, offices, loading, calendarDate, setCalendarDate, filter, setFilter, getOfficeName, setSelectedAppointment }: {
  admin: { email: string; office_id: string | null; role: string; offices?: { name: string } | null };
  appointments: Appointment[]; offices: Office[]; loading: boolean; calendarDate: Date;
  setCalendarDate: (d: Date) => void; filter: string; setFilter: (f: string) => void;
  getOfficeName: (id: string) => string; setSelectedAppointment: (a: Appointment | null) => void;
}) {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const byDate: Record<string, Appointment[]> = {};
  appointments.forEach((a) => { if (!byDate[a.date]) byDate[a.date] = []; byDate[a.date].push(a); });

  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [blockModalDate, setBlockModalDate] = useState<string | null>(null);
  const [blockingSlot, setBlockingSlot] = useState<string | null>(null);

  const blockedByDate: Record<string, BlockedTime[]> = {};
  blockedTimes.forEach((b) => { if (!blockedByDate[b.date]) blockedByDate[b.date] = []; blockedByDate[b.date].push(b); });

  const fetchBlocked = useCallback(async () => {
    try {
      const m = `${year}-${String(month + 1).padStart(2, "0")}`;
      const params = new URLSearchParams({ month: m });
      if (admin.office_id) params.set("officeId", admin.office_id);
      const res = await fetch(`/api/admin/blocked-times?${params}`, { headers: { "x-admin-email": admin.email } });
      if (!res.ok) return;
      const data = await res.json();
      setBlockedTimes(data || []);
    } catch { /* */ }
  }, [year, month, admin]);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchBlocked(); }, [fetchBlocked]);

  const handleBlockTime = async (date: string, timeSlot: string) => {
    setBlockingSlot(timeSlot);
    try {
      const officeId = admin.office_id || offices[0]?.id;
      if (!officeId) return;
      const res = await fetch("/api/admin/blocked-times", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-email": admin.email },
        body: JSON.stringify({ office_id: officeId, date, time_slot: timeSlot, reason: "Blocked by admin" }),
      });
      if (res.ok) fetchBlocked();
    } catch { /* */ }
    finally { setBlockingSlot(null); }
  };

  const handleUnblockTime = async (id: string) => {
    try {
      await fetch("/api/admin/blocked-times", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-email": admin.email },
        body: JSON.stringify({ id }),
      });
      fetchBlocked();
    } catch { /* */ }
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const color = (s: string) => ({ pending: "bg-amber-50 text-amber-700 border-amber-200", approved: "bg-green-50 text-green-700 border-green-200", declined: "bg-red-50 text-red-700 border-red-200" }[s] || "bg-gray-50 text-gray-500 border-gray-200");

  const officeId = admin.office_id || offices[0]?.id || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">{admin.offices?.name || "Office"} schedule</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {["pending", "approved", "declined", "all"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${filter === s ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setCalendarDate(new Date(year, month - 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h3 className="text-base font-semibold text-gray-900">{calendarDate.toLocaleString("default", { month: "long", year: "numeric" })}</h3>
          <button onClick={() => setCalendarDate(new Date(year, month + 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={`h-${i}`} className="bg-gray-50 text-center text-xs font-medium text-gray-500 py-2">{d}</div>
          ))}
          {loading ? (
            <div className="col-span-7 bg-white p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></div>
          ) : cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} className="bg-white min-h-[60px] sm:min-h-[80px]" />;
            const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const da = byDate[ds] || [];
            const db = blockedByDate[ds] || [];
            const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
            const isPast = new Date(ds + "T00:00:00") < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            return (
              <div key={day} className={`bg-white p-1.5 min-h-[60px] sm:min-h-[80px] relative group ${isToday ? "bg-primary/5" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${isToday ? "text-primary font-bold" : "text-gray-600"}`}>{day}</span>
                  {!isPast && officeId && (
                    <button onClick={() => setBlockModalDate(ds)}
                      className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded bg-gray-100 hover:bg-primary/10 text-gray-400 hover:text-primary flex items-center justify-center transition-all">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {da.slice(0, 2).map((a) => (
                    <button key={a.id} onClick={() => setSelectedAppointment(a)}
                      className={`block w-full text-left text-[10px] sm:text-xs px-1.5 py-0.5 rounded border truncate transition-colors hover:opacity-80 ${color(a.status)}`}>
                      {a.time_slot.split(" ")[0]} {a.full_name.split(" ")[0]}
                    </button>
                  ))}
                  {db.length > 0 && (
                    <div className="text-[10px] text-gray-400 px-1 flex items-center gap-0.5">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                      {db.length} blocked
                    </div>
                  )}
                  {da.length > 2 && <div className="text-[10px] text-gray-400 px-1">+{da.length - 2} more</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-200" /> Pending</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-200" /> Approved</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-200" /> Declined</span>
          <span className="flex items-center gap-1"><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg> Blocked</span>
        </div>
      </div>

      {blockModalDate && officeId && (
        <BlockTimeModal
          date={blockModalDate}
          officeId={officeId}
          officeName={getOfficeName(officeId)}
          blockedSlots={(blockedByDate[blockModalDate] || []).filter((b) => b.office_id === officeId)}
          onBlock={handleBlockTime}
          onUnblock={handleUnblockTime}
          onClose={() => setBlockModalDate(null)}
          blockingSlot={blockingSlot}
        />
      )}
    </div>
  );
}

/* ─── Block Time Modal ─── */

function BlockTimeModal({ date, officeId, officeName, blockedSlots, onBlock, onUnblock, onClose, blockingSlot }: {
  date: string; officeId: string; officeName: string;
  blockedSlots: BlockedTime[]; onBlock: (date: string, slot: string) => void;
  onUnblock: (id: string) => void; onClose: () => void; blockingSlot: string | null;
}) {
  const [allSlots, setAllSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const res = await fetch(`/api/availability?officeId=${officeId}&date=${date}`);
        if (!res.ok) return;
        const d = await res.json();
        setAllSlots((d.slots || []).map((s: { time: string }) => s.time));
      } catch { /* */ }
      finally { setLoading(false); }
    };
    fetchSlots();
  }, [officeId, date]);

  const blockedSet = new Set(blockedSlots.map((b) => b.time_slot));
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto animate-fade-in">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="font-semibold text-gray-900">Block Time Slots</h3>
            <p className="text-xs text-gray-400 mt-0.5">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5">
          <p className="text-xs text-gray-500 mb-3">{officeName} · Click a slot to block or unblock it</p>
          {loading ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {allSlots.map((slot) => {
                const isBlocked = blockedSet.has(slot);
                const h = parseInt(slot.split(":")[0]);
                const m = parseInt(slot.split(":")[1]);
                const period = h >= 12 ? "PM" : "AM";
                const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
                const label = `${dh}:${m.toString().padStart(2, "0")} ${period}`;

                if (isBlocked) {
                  const block = blockedSlots.find((b) => b.time_slot === slot);
                  return (
                    <button key={slot} onClick={() => block && onUnblock(block.id)}
                      className="p-2 rounded-lg border-2 border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors text-center">
                      <div className="line-through">{label}</div>
                      <div className="text-[10px] text-red-400 mt-0.5">Click to unblock</div>
                    </button>
                  );
                }

                return (
                  <button key={slot} onClick={() => onBlock(date, slot)} disabled={blockingSlot === slot}
                    className="p-2 rounded-lg border-2 border-gray-200 bg-white text-gray-700 text-xs font-medium hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-colors text-center disabled:opacity-50">
                    {blockingSlot === slot ? <span className="animate-pulse">Blocking...</span> : label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Detail Modal ─── */

function DetailModal({ appointment, offices, onApprove, onDecline, onClose, actionLoading, getStatusBadge }: {
  appointment: Appointment; offices: Office[];
  onApprove: (a: Appointment) => void; onDecline: (a: Appointment, reason?: string) => void;
  onClose: () => void; actionLoading: boolean; getStatusBadge: (s: string) => string;
}) {
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const officeName = offices.find((o) => o.id === appointment.office_id)?.name || "Unknown";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-semibold text-gray-900">Appointment Details</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Visitor", appointment.full_name], ["Email", appointment.email], ["Phone", appointment.phone], ["Office", officeName],
              ["Date", new Date(appointment.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })],
              ["Time", `${appointment.time_slot} (${appointment.duration} min)`],
            ].map(([l, v]) => (
              <div key={l}><div className="text-xs text-gray-400">{l}</div><div className="text-sm font-medium text-gray-900 mt-0.5">{v}</div></div>
            ))}
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1.5">ID Photo</div>
            <img src={appointment.id_image_url} alt="ID" className="w-full max-w-[200px] h-auto rounded-lg border border-gray-200" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Status:</span>
            <span className={getStatusBadge(appointment.status)}>{appointment.status}</span>
          </div>
          {appointment.scanned_at && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <div className="text-xs font-medium text-green-700">Gate Entry Recorded</div>
                <div className="text-sm text-green-600">{new Date(appointment.scanned_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
              </div>
            </div>
          )}
          {appointment.decline_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-xs font-medium text-red-700 mb-0.5">Decline Reason</div>
              <div className="text-sm text-red-600">{appointment.decline_reason}</div>
            </div>
          )}
          {appointment.status === "pending" && (
            <div className="pt-3 border-t border-gray-100">
              {showDeclineReason ? (
                <div className="space-y-3">
                  <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Reason for decline (optional)" className="input" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => { onDecline(appointment, declineReason); setShowDeclineReason(false); setDeclineReason(""); }} disabled={actionLoading} className="btn-danger flex-1 btn-sm disabled:opacity-50">
                      {actionLoading ? "Processing..." : "Confirm Decline"}
                    </button>
                    <button onClick={() => { setShowDeclineReason(false); setDeclineReason(""); }} className="btn-secondary flex-1 btn-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => onApprove(appointment)} disabled={actionLoading} className="btn-primary flex-1 btn-sm disabled:opacity-50">
                    {actionLoading ? "Processing..." : "Approve"}
                  </button>
                  <button onClick={() => setShowDeclineReason(true)} disabled={actionLoading} className="btn-danger flex-1 btn-sm disabled:opacity-50">
                    {actionLoading ? "Processing..." : "Decline"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
