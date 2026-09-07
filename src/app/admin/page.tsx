"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import type { Appointment, Office, BlockedTime } from "@/types/database";

interface ArchivedAppointment extends Appointment {
  office_name?: string;
  archived_at?: string;
}

export default function AdminDashboardPage() {
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "super_admin";
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [processing, setProcessing] = useState<{ id: string; action: "approve" | "decline" | "reset" } | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [archivedData, setArchivedData] = useState<{ data: ArchivedAppointment[]; total: number }>({ data: [], total: 0 });
  const [archivedSearch, setArchivedSearch] = useState("");
  const [archivedPage, setArchivedPage] = useState(1);
  const [selectedArchived, setSelectedArchived] = useState<ArchivedAppointment | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/appointments?status=${filter}`, {
        headers: {},
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
        headers: {},
      });
      if (!response.ok) return;
      const data = await response.json();
      setAllAppointments(data || []);
    } catch { /* */ }
  }, [admin]);

  const fetchOffices = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/offices", { headers: {} });
      if (!response.ok) return;
      const data = await response.json();
      setOffices(data || []);
    } catch { /* */ }
  }, [admin]);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchAppointments(); fetchAllAppointments(); fetchOffices(); }, [filter]);

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(archivedPage), limit: "50" });
      if (archivedSearch) params.set("search", archivedSearch);
      if (admin?.office_id && !isSuperAdmin) params.set("officeId", admin.office_id);
      const res = await fetch(`/api/admin/archived?${params}`, {
        headers: {},
      });
      if (!res.ok) throw new Error("Failed to fetch archived");
      const data = await res.json();
      setArchivedData(data);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [admin, archivedPage, archivedSearch, isSuperAdmin]);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { if (filter === "archived") fetchArchived(); }, [filter, fetchArchived]);

  const getOfficeName = (officeId: string) => offices.find((o) => o.id === officeId)?.name || "Unknown";

  const handleApprove = async (appointment: Appointment) => {
    setProcessing({ id: appointment.id, action: "approve" }); setMessage(null);
    try {
      const res = await fetch("/api/appointments/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointment.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage({ type: "success", text: "Appointment approved. QR code & confirmation email are being sent." });
      setSelectedAppointment(null);
      fetchAppointments(); fetchAllAppointments();
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setProcessing(null); }
  };

  const handleDecline = async (appointment: Appointment, reason?: string) => {
    setProcessing({ id: appointment.id, action: "decline" }); setMessage(null);
    try {
      const res = await fetch("/api/appointments/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointment.id, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage({ type: "success", text: "Appointment declined. Notification email is being sent." });
      setSelectedAppointment(null);
      fetchAppointments(); fetchAllAppointments();
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setProcessing(null); }
  };

  const handleResetQR = async (appointment: Appointment) => {
    setProcessing({ id: appointment.id, action: "reset" }); setMessage(null);
    try {
      const res = await fetch("/api/appointments/reset-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointment.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage({ type: "success", text: "QR code reset. New email is being sent." });
      setSelectedAppointment(null);
      fetchAppointments(); fetchAllAppointments();
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setProcessing(null); }
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
    return <CalendarView admin={admin} appointments={appointments} offices={offices} loading={loading} calendarDate={calendarDate} setCalendarDate={setCalendarDate} filter={filter} setFilter={setFilter} getOfficeName={getOfficeName} selectedAppointment={selectedAppointment} setSelectedAppointment={setSelectedAppointment} processing={processing} onApprove={handleApprove} onDecline={handleDecline} onResetQR={handleResetQR} getStatusBadge={getStatusBadge} />;
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
        {["pending", "approved", "declined", "archived", "all"].map((s) => (
          <button key={s} onClick={() => { setFilter(s); if (s === "archived") { setArchivedPage(1); } }}
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

      {filter === "archived" ? (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" value={archivedSearch} onChange={(e) => { setArchivedSearch(e.target.value); setArchivedPage(1); }} placeholder="Search archived records..." className="input pl-10" />
            </div>
            <div className="text-xs text-gray-400">{archivedData.total} archived records</div>
          </div>
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" /></div>
            ) : archivedData.data.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <p className="text-sm text-gray-500">No archived records found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visitor</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Office</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Archived</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {archivedData.data.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-medium text-gray-900">{a.full_name}</div>
                        <div className="text-xs text-gray-400">{a.email}</div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{a.office_name || getOfficeName(a.office_id)}</td>
                      <td className="px-5 py-3.5">
                        <div className="text-sm text-gray-900">{new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                        <div className="text-xs text-gray-400">{a.time_slot} · {a.duration}m</div>
                      </td>
                      <td className="px-5 py-3.5"><span className={getStatusBadge(a.status)}>{a.status}</span></td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 text-right">{a.archived_at ? new Date(a.archived_at as unknown as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => setSelectedArchived(a)} className="text-xs font-medium text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition-colors">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {archivedData.total > 50 && (
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-3">
              <button onClick={() => setArchivedPage((p) => Math.max(1, p - 1))} disabled={archivedPage === 1} className="btn-secondary btn-sm disabled:opacity-30">Previous</button>
              <span className="text-xs text-gray-500">Page {archivedPage} of {Math.ceil(archivedData.total / 50)}</span>
              <button onClick={() => setArchivedPage((p) => p + 1)} disabled={archivedPage * 50 >= archivedData.total} className="btn-secondary btn-sm disabled:opacity-30">Next</button>
            </div>
          )}
          {selectedArchived && (
            <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
              <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
                  <h3 className="font-semibold text-gray-900">Archived Record</h3>
                  <button onClick={() => setSelectedArchived(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Visitor", selectedArchived.full_name],
                      ["Category", (selectedArchived.visitor_category || "general_public").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())],
                      ["Email", selectedArchived.email],
                      ["Phone", selectedArchived.phone],
                      ["Office", selectedArchived.office_name || getOfficeName(selectedArchived.office_id)],
                      ["Date", new Date(selectedArchived.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })],
                      ["Time", `${selectedArchived.time_slot} (${selectedArchived.duration} min)`],
                    ].map(([l, v]) => (
                      <div key={l}><div className="text-xs text-gray-400">{l}</div><div className="text-sm font-medium text-gray-900 mt-0.5">{v}</div></div>
                    ))}
                  </div>
                  {selectedArchived.purpose_of_visit && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Purpose of Visit</div>
                      <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">{selectedArchived.purpose_of_visit}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-gray-400 mb-1.5">ID Photo</div>
                    <img src={`/api/admin/archived/image?id=${selectedArchived.id}`} alt="ID" className="w-full max-w-[200px] h-auto rounded-lg border border-gray-200" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Status:</span>
                    <span className={getStatusBadge(selectedArchived.status)}>{selectedArchived.status}</span>
                  </div>
                  {selectedArchived.decline_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="text-xs font-medium text-red-700 mb-0.5">Decline Reason</div>
                      <div className="text-sm text-red-600">{selectedArchived.decline_reason}</div>
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    Archived on {selectedArchived.archived_at ? new Date(selectedArchived.archived_at as unknown as string).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "-"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
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
                          <button onClick={() => handleApprove(a)} disabled={processing !== null} className="text-xs font-medium text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50 transition-colors disabled:opacity-50">
                            {processing?.id === a.id && processing.action === "approve" ? "..." : "Approve"}
                          </button>
                          <button onClick={() => handleDecline(a)} disabled={processing !== null} className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50">
                            {processing?.id === a.id && processing.action === "decline" ? "..." : "Decline"}
                          </button>
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
                    <button onClick={() => handleApprove(a)} disabled={processing !== null} className="flex-1 text-center text-xs font-medium text-green-600 py-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50">
                      {processing?.id === a.id && processing.action === "approve" ? "..." : "Approve"}
                    </button>
                    <button onClick={() => handleDecline(a)} disabled={processing !== null} className="flex-1 text-center text-xs font-medium text-red-500 py-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50">
                      {processing?.id === a.id && processing.action === "decline" ? "..." : "Decline"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
        </>
      )}

      {selectedAppointment && (
        <DetailModal appointment={selectedAppointment} offices={offices} onApprove={handleApprove} onDecline={handleDecline} onResetQR={handleResetQR} onClose={() => setSelectedAppointment(null)} processing={processing} getStatusBadge={getStatusBadge} />
      )}
    </div>
  );
}

/* ─── Calendar View (office admins) ─── */

function CalendarView({ admin, appointments, offices, loading, calendarDate, setCalendarDate, filter, setFilter, getOfficeName, selectedAppointment, setSelectedAppointment, processing, onApprove, onDecline, onResetQR, getStatusBadge }: {
  admin: { email: string; office_id: string | null; role: string; offices?: { name: string } | null };
  appointments: Appointment[]; offices: Office[]; loading: boolean; calendarDate: Date;
  setCalendarDate: (d: Date) => void; filter: string; setFilter: (f: string) => void;
  getOfficeName: (id: string) => string; selectedAppointment: Appointment | null;
  setSelectedAppointment: (a: Appointment | null) => void;
  processing: { id: string; action: "approve" | "decline" | "reset" } | null;
  onApprove: (a: Appointment) => void; onDecline: (a: Appointment, reason?: string) => void; onResetQR: (a: Appointment) => void;
  getStatusBadge: (s: string) => string;
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
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  const blockedByDate: Record<string, BlockedTime[]> = {};
  blockedTimes.forEach((b) => { if (!blockedByDate[b.date]) blockedByDate[b.date] = []; blockedByDate[b.date].push(b); });

  const fetchBlocked = useCallback(async () => {
    try {
      const m = `${year}-${String(month + 1).padStart(2, "0")}`;
      const params = new URLSearchParams({ month: m });
      if (admin.office_id) params.set("officeId", admin.office_id);
      const res = await fetch(`/api/admin/blocked-times?${params}`);
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
          <div className="flex bg-gray-100 rounded-lg p-0.5 mr-1">
            {(["calendar", "list"] as const).map((v) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === v ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {["pending", "approved", "declined", "all"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${filter === s ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "calendar" ? (
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
      ) : (
        <ListByDay
          byDate={byDate}
          blockedByDate={blockedByDate}
          loading={loading}
          filter={filter}
          officeId={officeId}
          year={year}
          month={month}
          onPrevMonth={() => setCalendarDate(new Date(year, month - 1))}
          onNextMonth={() => setCalendarDate(new Date(year, month + 1))}
          onView={(a) => setSelectedAppointment(a)}
          onBlockDate={(ds) => { setBlockModalDate(ds); setCalendarDate(new Date(ds + "T00:00:00")); }}
          color={color}
        />
      )}

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

      {selectedAppointment && (
        <DetailModal
          appointment={selectedAppointment}
          offices={offices}
          onApprove={onApprove}
          onDecline={onDecline}
          onResetQR={onResetQR}
          onClose={() => setSelectedAppointment(null)}
          processing={processing}
          getStatusBadge={getStatusBadge}
        />
      )}
    </div>
  );
}

/* ─── List by Day (office admin) ─── */

function ListByDay({ byDate, blockedByDate, loading, filter, officeId, year, month, onPrevMonth, onNextMonth, onView, onBlockDate, color }: {
  byDate: Record<string, Appointment[]>;
  blockedByDate: Record<string, BlockedTime[]>;
  loading: boolean;
  filter: string;
  officeId: string;
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onView: (a: Appointment) => void;
  onBlockDate: (ds: string) => void;
  color: (s: string) => string;
}) {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const sortedDates = Object.keys(byDate)
    .filter((d) => d.startsWith(monthPrefix))
    .sort();
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const formatDate = (ds: string) =>
    new Date(ds + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const formatTime = (ts: string) => {
    const [h, m] = ts.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${dh}:${m.toString().padStart(2, "0")} ${period}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  if (sortedDates.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </div>
        <p className="text-sm text-gray-500">No {filter !== "all" ? filter : ""} appointments in this month</p>
        <p className="text-xs text-gray-400 mt-1">Switch to the Calendar view or change months to see more.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <button onClick={onPrevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h3 className="text-base font-semibold text-gray-900">{new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" })}</h3>
          <button onClick={onNextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">{sortedDates.length} day{sortedDates.length !== 1 ? "s" : ""} with appointments</p>
      </div>

      {sortedDates.map((ds) => {
        const dayAppointments = (byDate[ds] || []).slice().sort((a, b) => a.time_slot.localeCompare(b.time_slot));
        const dayBlocks = blockedByDate[ds] || [];
        const isPast = ds < todayStr;

        return (
          <div key={ds} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <h4 className="text-sm font-semibold text-gray-900">{formatDate(ds)}</h4>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isPast ? "bg-gray-100 text-gray-400" : "bg-primary/10 text-primary"}`}>
                  {isPast ? "Past" : `${dayAppointments.length} appointment${dayAppointments.length !== 1 ? "s" : ""}`}
                </span>
              </div>
              {officeId && (
                <button onClick={() => onBlockDate(ds)}
                  className="text-xs font-medium text-gray-500 hover:text-primary px-2 py-1 rounded hover:bg-gray-100 transition-colors flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Block slots
                </button>
              )}
            </div>

            {dayAppointments.length === 0 && dayBlocks.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No appointments</div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visitor</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {dayAppointments.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatTime(a.time_slot)}</td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{a.full_name}</div>
                            <div className="text-xs text-gray-400">{a.email}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 capitalize">{a.visitor_category.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[180px] truncate">{a.purpose_of_visit || "—"}</td>
                          <td className="px-4 py-3">
                            {a.id_image_url && <img src={a.id_image_url} alt="ID" className="h-10 w-auto rounded border border-gray-200" />}
                          </td>
                          <td className="px-4 py-3"><span className={color(a.status)}>{a.status}</span></td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => onView(a)} className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition-colors">View</button>
                          </td>
                        </tr>
                      ))}
                      {dayBlocks.map((b) => (
                        <tr key={`block-${b.id}`} className="bg-gray-50/40">
                          <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap line-through">{formatTime(b.time_slot)}</td>
                          <td className="px-4 py-3" colSpan={5}>
                            <span className="text-xs text-gray-400 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                              Blocked time slot
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs text-gray-400">{formatTime(b.time_slot)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-gray-50">
                  {dayAppointments.map((a) => (
                    <div key={a.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{a.full_name}</div>
                          <div className="text-xs text-gray-400">{a.email} · {formatTime(a.time_slot)} · {a.duration}m</div>
                        </div>
                        <span className={color(a.status)}>{a.status}</span>
                      </div>
                      {a.id_image_url && <img src={a.id_image_url} alt="ID" className="mt-3 h-12 w-auto rounded border border-gray-200" />}
                      <button onClick={() => onView(a)} className="mt-3 w-full text-center text-xs font-medium text-gray-600 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">View Details</button>
                    </div>
                  ))}
                  {dayBlocks.map((b) => (
                    <div key={`block-${b.id}`} className="p-3 flex items-center gap-2 bg-gray-50/40 text-xs text-gray-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                      Blocked · {formatTime(b.time_slot)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
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

function DetailModal({ appointment, offices, onApprove, onDecline, onResetQR, onClose, processing, getStatusBadge }: {
  appointment: Appointment; offices: Office[];
  onApprove: (a: Appointment) => void; onDecline: (a: Appointment, reason?: string) => void; onResetQR: (a: Appointment) => void;
  onClose: () => void; processing: { id: string; action: "approve" | "decline" | "reset" } | null; getStatusBadge: (s: string) => string;
}) {
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const officeName = offices.find((o) => o.id === appointment.office_id)?.name || "Unknown";
  const isProcessing = processing?.id === appointment.id;
  const isBusy = processing !== null;

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
              ["Visitor", appointment.full_name],
              ["Category", (appointment.visitor_category || "general_public").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())],
              ["Email", appointment.email],
              ["Phone", appointment.phone],
              ["Office", officeName],
              ["Date", new Date(appointment.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })],
              ["Time", `${appointment.time_slot} (${appointment.duration} min)`],
            ].map(([l, v]) => (
              <div key={l}><div className="text-xs text-gray-400">{l}</div><div className="text-sm font-medium text-gray-900 mt-0.5">{v}</div></div>
            ))}
          </div>
          {appointment.purpose_of_visit && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Purpose of Visit</div>
              <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">{appointment.purpose_of_visit}</div>
            </div>
          )}
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
          {appointment.status === "completed" && (
            <div className="pt-3 border-t border-gray-100">
              <button onClick={() => onResetQR(appointment)} disabled={isBusy} className="btn-secondary w-full btn-sm disabled:opacity-50 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {isProcessing && processing.action === "reset" ? "Resetting..." : "Reset QR & Re-send Email"}
              </button>
            </div>
          )}
          {appointment.status === "pending" && (
            <div className="pt-3 border-t border-gray-100">
              {showDeclineReason ? (
                <div className="space-y-3">
                  <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Reason for decline (optional)" className="input" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => { onDecline(appointment, declineReason); setShowDeclineReason(false); setDeclineReason(""); }} disabled={isBusy} className="btn-danger flex-1 btn-sm disabled:opacity-50">
                      {isProcessing && processing.action === "decline" ? "Processing..." : "Confirm Decline"}
                    </button>
                    <button onClick={() => { setShowDeclineReason(false); setDeclineReason(""); }} className="btn-secondary flex-1 btn-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => onApprove(appointment)} disabled={isBusy} className="btn-primary flex-1 btn-sm disabled:opacity-50">
                    {isProcessing && processing.action === "approve" ? "Processing..." : "Approve"}
                  </button>
                  <button onClick={() => setShowDeclineReason(true)} disabled={isBusy} className="btn-danger flex-1 btn-sm disabled:opacity-50">
                    {isProcessing && processing.action === "decline" ? "Processing..." : "Decline"}
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
