"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import type { Office } from "@/types/database";
import { OfficeContactsModal } from "@/components/admin/OfficeContactsModal";
import { ModalShell } from "@/components/admin/ModalShell";

export default function OfficesPage() {
  const { admin } = useAdmin();
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", description: "", operating_hours: "8:00 AM - 5:00 PM", capacity_per_slot: 1, contact_email: "", contact_phone: "", category: "", hide_time_slots: false });
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [contactsOffice, setContactsOffice] = useState<Office | null>(null);

  const fetchOffices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/offices", {});
      const data = await res.json();
      setOffices(data || []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [admin]);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchOffices(); }, []);

  const openCreate = () => { setEditingOffice(null); setForm({ name: "", email: "", description: "", operating_hours: "8:00 AM - 5:00 PM", capacity_per_slot: 1, contact_email: "", contact_phone: "", category: "", hide_time_slots: false }); setModalOpen(true); };
  const openEdit = (o: Office) => { setEditingOffice(o); setForm({ name: o.name, email: o.email || "", description: o.description || "", operating_hours: o.operating_hours, capacity_per_slot: o.capacity_per_slot, contact_email: o.contact_email || "", contact_phone: o.contact_phone || "", category: o.category || "", hide_time_slots: o.hide_time_slots || false }); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMessage(null);
    try {
      const url = "/api/admin/offices";
      const method = editingOffice ? "PUT" : "POST";
      const body = editingOffice ? { id: editingOffice.id, ...form } : form;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      setMessage({ type: "success", text: editingOffice ? "Office updated" : "Office created" });
      setModalOpen(false); fetchOffices();
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setSaving(false); }
  };

  const handleToggle = async (o: Office) => {
    setMessage(null);
    try {
      await fetch("/api/admin/offices", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: o.id, active: !o.active }) });
      setMessage({ type: "success", text: o.active ? "Deactivated" : "Activated" });
      fetchOffices();
    } catch { setMessage({ type: "error", text: "Failed" }); }
  };

  const filteredOffices = offices.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return o.name.toLowerCase().includes(q) || (o.category || "").toLowerCase().includes(q) || (o.email || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offices</h1>
          <p className="text-sm text-gray-500 mt-0.5">{offices.length} office{offices.length !== 1 ? "s" : ""} configured</p>
        </div>
        <button onClick={openCreate} className="btn-primary btn-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Office
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in ${message.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {message.type === "success" ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          {message.text}
        </div>
      )}

      <div className="relative">
        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search offices by name, category, or email..."
          className="input"
          style={{ paddingLeft: "2.5rem" }}
          autoComplete="off"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-xl border border-gray-200 p-5"><div className="skeleton h-5 w-32 mb-3" /><div className="skeleton h-3 w-48 mb-2" /><div className="skeleton h-3 w-24" /></div>)}
        </div>
      ) : offices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
          </div>
          <p className="text-sm text-gray-500 mb-3">No offices yet</p>
          <button onClick={openCreate} className="text-sm font-medium text-primary hover:text-primary-light">Add your first office</button>
        </div>
      ) : filteredOffices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500">No offices match your search.</p>
          {query && <button onClick={() => setQuery("")} className="text-sm font-medium text-primary hover:text-primary-light mt-2">Clear search</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOffices.map((o) => (
            <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{o.name}</h3>
                  {o.category && <p className="text-[11px] text-primary font-medium truncate mt-0.5">{o.category}</p>}
                  {o.email && <p className="text-xs text-gray-400 truncate mt-0.5">{o.email}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ml-2 ${o.active ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-400 border border-gray-200"}`}>
                  {o.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {o.operating_hours}
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {o.capacity_per_slot} visitor{o.capacity_per_slot !== 1 ? "s" : ""} per slot
                </div>
                {o.hide_time_slots && (
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    <span className="font-medium">Time slots hidden</span>
                  </div>
                )}
                {(o.contact_email || o.contact_phone) && (
                  <div className="flex flex-col gap-1 pt-1 border-t border-gray-100">
                    {o.contact_email && <div className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>{o.contact_email}</div>}
                    {o.contact_phone && <div className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h.34c.32 0 .61.19.73.48l.9 2.12a.75.75 0 01-.03.65l-.56 1.13a12.05 12.05 0 005.34 5.34l1.13-.56a.75.75 0 01.65-.03l2.12.9c.29.12.48.41.48.73V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" /></svg>{o.contact_phone}</div>}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => openEdit(o)} className="flex-1 text-center text-xs font-medium text-gray-600 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">Edit</button>
                <button onClick={() => setContactsOffice(o)} className="flex-1 text-center text-xs font-medium text-cyan-700 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 transition-colors">Contacts</button>
                <button onClick={() => handleToggle(o)} className={`flex-1 text-center text-xs font-medium py-1.5 rounded-lg transition-colors ${o.active ? "text-gray-500 bg-gray-50 hover:bg-gray-100" : "text-green-600 bg-green-50 hover:bg-green-100"}`}>
                  {o.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ModalShell open={true} title={editingOffice ? "Edit Office" : "Add Office"} subtitle={editingOffice ? `Editing ${editingOffice.name}` : "Configure a new campus office"} onClose={() => setModalOpen(false)} maxWidthClass="max-w-2xl"
          footer={
            <>
              <button type="submit" form="office-form" disabled={saving} className="btn-primary flex-1 btn-sm disabled:opacity-50">
                {saving ? "Saving..." : editingOffice ? "Update Office" : "Create Office"}
              </button>
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary btn-sm">Cancel</button>
            </>
          }>
          <form id="office-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><label className="label">Office Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Registrar" /></div>
              <div className="sm:col-span-2"><label className="label">Category</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Vice Chancellor for Academic Affairs" /><p className="text-[11px] text-gray-400 mt-1">Groups this office under a section on the booking form and encounters list.</p></div>
              <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@email.com" /></div>
              <div><label className="label">Capacity per Slot</label><input type="number" min={1} className="input" value={form.capacity_per_slot} onChange={(e) => setForm({ ...form, capacity_per_slot: parseInt(e.target.value) || 1 })} /></div>
              <div><label className="label">Contact Email</label><input type="email" className="input" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="Shown to visitors for follow-ups" /></div>
              <div><label className="label">Contact Phone</label><input type="tel" className="input" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="e.g. (034) 433-7777 loc 123" /></div>
              <div className="sm:col-span-2"><label className="label">Operating Hours</label><input className="input" value={form.operating_hours} onChange={(e) => setForm({ ...form, operating_hours: e.target.value })} required placeholder="8:00 AM - 5:00 PM" /><p className="text-[11px] text-gray-400 mt-1">All offices run 8:00 AM - 5:00 PM with a 12:00 PM - 1:30 PM lunch break. Shown to visitors for reference.</p></div>
              <div className="sm:col-span-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={form.hide_time_slots} 
                    onChange={(e) => setForm({ ...form, hide_time_slots: e.target.checked })} 
                    className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">Hide Time Slots from Visitors</span>
                    <p className="text-[11px] text-gray-500 mt-0.5">When enabled, visitors can only select a date during booking. The office will contact them to schedule a specific time. Useful for high-security offices.</p>
                  </div>
                </label>
              </div>
              <div className="sm:col-span-2"><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the office..." /></div>
            </div>
          </form>
        </ModalShell>
      )}

      <OfficeContactsModal
        open={Boolean(contactsOffice)}
        officeId={contactsOffice?.id || ""}
        officeName={contactsOffice?.name || "Office"}
        onClose={() => setContactsOffice(null)}
      />
    </div>
  );
}
