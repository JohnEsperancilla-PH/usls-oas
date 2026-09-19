"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import { NewInvitationModal } from "@/components/admin/NewInvitationModal";

interface InvitationVehicle {
  plateNumber: string;
  makeModel: string | null;
}

interface Invitation {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  officeId: string;
  officeName: string;
  date: string;
  timeSlot: string;
  duration: number;
  status: string;
  referenceNumber: string | null;
  validId: string | null;
  visitorCategory: string;
  personToMeet: string | null;
  purposeOfVisit: string | null;
  createdAt: string;
  emailStatus: "sent" | "failed" | "none" | string;
  vehicles: InvitationVehicle[];
  contacts: { id: string | null; name: string; email: string; position: string | null }[];
}

function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatSlot(timeSlot: string): string {
  const [h, m] = timeSlot.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-50 text-green-700 border-green-200",
  postponed: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  entry_denied: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-gray-50 text-gray-500 border-gray-200",
  declined: "bg-red-50 text-red-700 border-red-200",
};

export default function InvitationsPage() {
  const { admin } = useAdmin();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const invRes = await fetch("/api/admin/invitations");
      const invData = invRes.ok ? await invRes.json() : [];
      setInvitations(invData || []);
    } catch { /* keep empty */ }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  if (admin.role === "gate_user") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-500">You do not have permission to view invitations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invitations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{invitations.length} manual invitation{invitations.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary btn-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Invitation
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-xl border border-gray-200 p-5"><div className="skeleton h-5 w-48 mb-3" /><div className="skeleton h-3 w-64 mb-2" /><div className="skeleton h-3 w-32" /></div>)}
        </div>
      ) : invitations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <p className="text-sm text-gray-500 mb-3">No invitations yet</p>
          <button onClick={() => setModalOpen(true)} className="text-sm font-medium text-primary hover:text-primary-light">Create the first invitation</button>
        </div>
      ) : (
        <div className="space-y-4">
          {invitations.map((invitation) => (
            <div key={invitation.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{invitation.fullName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${STATUS_STYLES[invitation.status] || "bg-gray-50 text-gray-500 border-gray-200"}`}>
                      {invitation.status.replace(/_/g, " ")}
                    </span>
                    {invitation.emailStatus === "sent" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Emailed</span>
                    )}
                    {invitation.emailStatus === "failed" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">Email failed</span>
                    )}
                    {invitation.emailStatus === "none" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-500 border-gray-200">No email</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1.5 space-y-0.5">
                    <div>{invitation.officeName} · {formatDate(invitation.date)} · {formatSlot(invitation.timeSlot)} ({invitation.duration} min)</div>
                    {invitation.email && <div>{invitation.email}{invitation.phone ? ` · ${invitation.phone}` : ""}</div>}
                    {invitation.personToMeet && <div>Meeting: {invitation.personToMeet}</div>}
                    {invitation.vehicles.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-gray-400">Vehicles:</span>
                        {invitation.vehicles.map((vehicle, index) => (
                          <span key={index} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-mono text-[11px]">
                            {vehicle.plateNumber}{vehicle.makeModel ? ` · ${vehicle.makeModel}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    {invitation.contacts.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-gray-400">Tagged contacts:</span>
                        {invitation.contacts.map((contact, index) => (
                          <span key={index} className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-100 text-[11px]">
                            {contact.name}{contact.position ? ` (${contact.position})` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 lg:flex-col lg:items-end">
                  {invitation.referenceNumber && (
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">Reference</div>
                      <div className="font-mono text-sm font-bold text-primary tracking-wider">{invitation.referenceNumber}</div>
                    </div>
                  )}
                  <a href={`/api/admin/invitations/${invitation.id}/ticket`} className="btn-secondary btn-sm flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Ticket PDF
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewInvitationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchData}
      />    </div>
  );
}
