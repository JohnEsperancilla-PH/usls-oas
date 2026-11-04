"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import { ModalShell } from "@/components/admin/ModalShell";
import { StatusMessage, useStatusMessage } from "@/components/admin/StatusMessage";
import { adminFetch } from "@/lib/admin-fetch";
import { formatHours, parseHours } from "@/lib/office-hours";
import type { Office } from "@/types/database";
import type { OfficeDeleteCheck } from "@/lib/office-delete";

interface FormState {
  name: string;
  email: string;
  contact_email: string;
  contact_phone: string;
  description: string;
  operating_hours: string;
  capacity_per_slot: string;
  hide_time_slots: boolean;
  max_advance_days: string;
  min_notice_hours: string;
}

const EMPTY_FORM: FormState = {
  name: "", email: "", contact_email: "", contact_phone: "", description: "", operating_hours: "8:00 AM - 5:00 PM",
  capacity_per_slot: "1", hide_time_slots: false, max_advance_days: "", min_notice_hours: "",
};

function toForm(office: Office): FormState {
  return {
    name: office.name,
    email: office.email || "",
    contact_email: office.contact_email || "",
    contact_phone: office.contact_phone || "",
    description: office.description || "",
    operating_hours: office.operating_hours || "8:00 AM - 5:00 PM",
    capacity_per_slot: String(office.capacity_per_slot ?? 1),
    hide_time_slots: Boolean(office.hide_time_slots),
    max_advance_days: office.max_advance_days == null ? "" : String(office.max_advance_days),
    min_notice_hours: office.min_notice_hours == null ? "" : String(office.min_notice_hours),
  };
}

export default function SubOfficesPage() {
  const { admin } = useAdmin();
  const enabled = admin?.role === "office_admin" && Boolean(admin.offices?.allow_sub_offices);
  const [parentName, setParentName] = useState("");
  const [subOffices, setSubOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useStatusMessage();
  const [editing, setEditing] = useState<Office | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deletingOffice, setDeletingOffice] = useState<Office | null>(null);
  const [deleteCheck, setDeleteCheck] = useState<OfficeDeleteCheck | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchSubOffices = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/sub-offices", {});
      if (!res.ok) throw new Error("Failed to load sub-offices");
      const data: { parent: { name: string }; subOffices: Office[] } = await res.json();
      setParentName(data.parent.name);
      setSubOffices(data.subOffices);
      setLoadFailed(false);
    } catch { setLoadFailed(true); }
    finally { setLoading(false); }
  }, [enabled]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchSubOffices(); }, [fetchSubOffices]);

  if (!enabled) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-sm text-gray-500">Sub-offices aren&apos;t enabled for your office. A super admin can turn them on.</p>
      </div>
    );
  }

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); };
  const openEdit = (office: Office) => { setEditing(office); setForm(toForm(office)); setFormError(null); setModalOpen(true); };
  const update = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const parsedHours = parseHours(form.operating_hours);
  const hours = parsedHours || { start: "08:00", end: "17:00" };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); setMessage(null);
    if (!form.name.trim()) { setFormError("Sub-office name is required"); return; }
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/sub-offices", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editing ? { id: editing.id } : {}), ...form, capacity_per_slot: Number(form.capacity_per_slot) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save the sub-office. Please try again.");
      setMessage({ type: "success", text: editing ? `${form.name} updated` : `${form.name} created` });
      setModalOpen(false);
      fetchSubOffices();
    } catch (err) { setFormError(err instanceof Error ? err.message : "Could not save the sub-office. Please try again."); }
    finally { setSaving(false); }
  };

  const toggleActive = async (office: Office) => {
    setToggling(office.id); setMessage(null);
    try {
      const res = await adminFetch("/api/admin/sub-offices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: office.id, active: !office.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Could not update ${office.name}.`);
      setMessage({ type: "success", text: office.active ? `${office.name} deactivated. Visitors can no longer book it.` : `${office.name} activated.` });
      fetchSubOffices();
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : `Could not update ${office.name}.` }); }
    finally { setToggling(null); }
  };

  const openDelete = async (office: Office) => {
    setMessage(null); setDeletingOffice(office); setDeleteCheck(null); setDeleteError(null); setDeleteConfirmName("");
    try {
      const res = await adminFetch(`/api/admin/sub-offices?deleteCheck=${encodeURIComponent(office.id)}`, {});
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Could not check whether ${office.name} can be deleted.`);
      setDeleteCheck(data);
    } catch (err) { setDeleteError(err instanceof Error ? err.message : `Could not check whether ${office.name} can be deleted.`); }
  };

  const closeDelete = () => { if (!deleting) setDeletingOffice(null); };

  const handleDelete = async () => {
    if (!deletingOffice) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await adminFetch("/api/admin/sub-offices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingOffice.id, confirmName: deleteConfirmName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Could not delete ${deletingOffice.name}.`);
      setMessage({ type: "success", text: `${deletingOffice.name} was permanently deleted.` });
      setDeletingOffice(null);
      fetchSubOffices();
    } catch (err) { setDeleteError(err instanceof Error ? err.message : `Could not delete ${deletingOffice.name}.`); }
    finally { setDeleting(false); }
  };

  const canDelete = Boolean(deleteCheck && deleteCheck.blockers.length === 0 && deleteConfirmName.trim() === deleteCheck.name.trim());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sub-offices</h1>
          <p className="text-sm text-gray-500 mt-0.5">Under {parentName}. Each has its own schedule and can have its own accounts.</p>
        </div>
        <button onClick={openCreate} className="btn-primary btn-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Sub-office
        </button>
      </div>

      {message && <StatusMessage message={message} onDismiss={() => setMessage(null)} />}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 space-y-1">
        <p>Visitors see sub-offices under {parentName} when booking. Your office can view, approve, and decline their appointments, and tag them on your own appointments so they&apos;re notified.</p>
        <p>Sub-office staff create their accounts on the register page by choosing their sub-office.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-xl border border-gray-200 p-5"><div className="skeleton h-5 w-32 mb-3" /><div className="skeleton h-3 w-48" /></div>)}
        </div>
      ) : loadFailed ? (
        <StatusMessage message={{ type: "error", text: "Could not load sub-offices. Check your connection and try again." }} onRetry={fetchSubOffices} />
      ) : subOffices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500 mb-3">No sub-offices yet</p>
          <button onClick={openCreate} className="text-sm font-medium text-primary hover:text-primary-light">Add your first sub-office</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subOffices.map((office) => (
            <div key={office.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{office.name}</h3>
                  {office.email && <p className="text-xs text-gray-400 truncate mt-0.5">{office.email}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ml-2 ${office.active ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-400 border border-gray-200"}`}>
                  {office.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="space-y-1 text-xs text-gray-500 mb-4">
                <div>{office.operating_hours} · {office.capacity_per_slot} per slot</div>
                {office.contact_phone && <div>{office.contact_phone}</div>}
                {office.hide_time_slots && <div className="text-blue-600 font-medium">Time slots hidden</div>}
              </div>
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => openEdit(office)} className="flex-1 text-center text-xs font-medium text-gray-600 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">Edit</button>
                <button onClick={() => toggleActive(office)} disabled={toggling === office.id}
                  className={`flex-1 text-center text-xs font-medium py-1.5 rounded-lg transition-colors disabled:opacity-50 ${office.active ? "text-gray-500 bg-gray-50 hover:bg-gray-100" : "text-green-600 bg-green-50 hover:bg-green-100"}`}>
                  {office.active ? "Deactivate" : "Activate"}
                </button>
                {!office.active && (
                  <button onClick={() => openDelete(office)} className="flex-1 text-center text-xs font-medium text-red-600 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalShell open={Boolean(deletingOffice)} title="Delete Sub-office Permanently" subtitle={deletingOffice?.name} onClose={closeDelete} maxWidthClass="max-w-md"
        footer={
          <>
            <button type="button" onClick={handleDelete} disabled={!canDelete || deleting} className="btn-danger flex-1 btn-sm disabled:opacity-50">
              {deleting ? "Deleting..." : "Delete permanently"}
            </button>
            <button type="button" onClick={closeDelete} disabled={deleting} className="btn-secondary btn-sm">Cancel</button>
          </>
        }>
        <div className="space-y-3 text-sm text-gray-600">
          {deleteError && <StatusMessage message={{ type: "error", text: deleteError }} />}
          {!deleteCheck && !deleteError && <div className="skeleton h-16 rounded-lg" />}
          {deleteCheck && deleteCheck.blockers.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
              <p className="font-semibold">This sub-office can&apos;t be deleted yet</p>
              <ul className="mt-1 list-disc pl-5 text-xs space-y-0.5">
                {deleteCheck.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            </div>
          )}
          {deleteCheck && deleteCheck.blockers.length === 0 && (
            <>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900">
                <p className="font-semibold">This can&apos;t be undone</p>
                <ul className="mt-1 list-disc pl-5 text-xs space-y-0.5">
                  <li>
                    {deleteCheck.totalAppointments > 0
                      ? <>All <strong>{deleteCheck.totalAppointments}</strong> appointment{deleteCheck.totalAppointments !== 1 ? "s" : ""} for this sub-office, with their visitor and vehicle details, are deleted.</>
                      : <>This sub-office has no appointments.</>}
                  </li>
                  <li>Its contacts, blocked times, and tags on your office&apos;s appointments are removed.</li>
                  <li>The audit log keeps a record of the deletion.</li>
                </ul>
              </div>
              <p className="text-xs">To keep the history, leave the sub-office deactivated instead.</p>
              <div>
                <label htmlFor="sub-office-delete-confirm" className="label">Type <strong>{deleteCheck.name}</strong> to confirm</label>
                <input id="sub-office-delete-confirm" className="input" value={deleteConfirmName} autoComplete="off"
                  onChange={(e) => setDeleteConfirmName(e.target.value)} />
              </div>
            </>
          )}
        </div>
      </ModalShell>

      {modalOpen && (
        <ModalShell open={true} title={editing ? "Edit Sub-office" : "Add Sub-office"} subtitle={`Under ${parentName}`} onClose={() => setModalOpen(false)} maxWidthClass="max-w-2xl"
          footer={
            <>
              <button type="submit" form="sub-office-form" disabled={saving} className="btn-primary flex-1 btn-sm disabled:opacity-50">
                {saving ? "Saving..." : editing ? "Update Sub-office" : "Create Sub-office"}
              </button>
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary btn-sm">Cancel</button>
            </>
          }>
          <form id="sub-office-form" onSubmit={save} className="space-y-4">
            {formError && <StatusMessage message={{ type: "error", text: formError }} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="sub-name" className="label">Sub-office Name</label>
                <input id="sub-name" className="input" required maxLength={100} value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Records Section" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="sub-email" className="label">Office Email</label>
                <input id="sub-email" type="email" className="input" maxLength={254} value={form.email} onChange={(e) => update({ email: e.target.value })} placeholder="section@usls.edu.ph" />
                <p className="text-[11px] text-gray-500 mt-1"><strong>Google Calendar invitations and tag notifications are sent to this email</strong>, along with new appointment alerts.</p>
              </div>
              <div>
                <label htmlFor="sub-contact-email" className="label">Contact Email</label>
                <input id="sub-contact-email" type="email" className="input" maxLength={254} value={form.contact_email} onChange={(e) => update({ contact_email: e.target.value })} placeholder="Shown to visitors for follow-ups" />
              </div>
              <div>
                <label htmlFor="sub-contact-phone" className="label">Contact Phone</label>
                <input id="sub-contact-phone" type="tel" className="input" maxLength={30} value={form.contact_phone} onChange={(e) => update({ contact_phone: e.target.value })} placeholder="e.g. (034) 433-7777 loc 123" />
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="label">Operating Hours</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="sub-hours-start" className="block text-xs text-gray-500 mb-1">Opens</label>
                    <input id="sub-hours-start" type="time" step={1800} className="input" value={hours.start} onChange={(e) => update({ operating_hours: formatHours(e.target.value, hours.end) })} />
                  </div>
                  <div>
                    <label htmlFor="sub-hours-end" className="block text-xs text-gray-500 mb-1">Closes</label>
                    <input id="sub-hours-end" type="time" step={1800} className="input" value={hours.end} onChange={(e) => update({ operating_hours: formatHours(hours.start, e.target.value) })} />
                  </div>
                </div>
              </fieldset>
              <div>
                <label htmlFor="sub-capacity" className="label">Capacity per Slot</label>
                <input id="sub-capacity" type="number" min={1} max={100} className="input" value={form.capacity_per_slot} onChange={(e) => update({ capacity_per_slot: e.target.value })} />
              </div>
              <div />
              <div>
                <label htmlFor="sub-max-advance" className="label">Max Advance Booking (days)</label>
                <input id="sub-max-advance" type="number" min={1} max={365} className="input" value={form.max_advance_days} onChange={(e) => update({ max_advance_days: e.target.value })} placeholder="System setting" />
                <p className="text-[11px] text-gray-400 mt-1">Leave blank to follow the system Booking Rules.</p>
              </div>
              <div>
                <label htmlFor="sub-min-notice" className="label">Minimum Notice (hours)</label>
                <input id="sub-min-notice" type="number" min={0} max={168} className="input" value={form.min_notice_hours} onChange={(e) => update({ min_notice_hours: e.target.value })} placeholder="System setting" />
                <p className="text-[11px] text-gray-400 mt-1">Leave blank to follow the system Booking Rules.</p>
              </div>
              <label className="sm:col-span-2 flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.hide_time_slots} onChange={(e) => update({ hide_time_slots: e.target.checked })} className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
                <span className="flex-1">
                  <span className="text-sm font-medium text-gray-900">Hide Time Slots from Visitors</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">Visitors pick only a date. The time is set when approving.</span>
                </span>
              </label>
              <div className="sm:col-span-2">
                <label htmlFor="sub-description" className="label">Description</label>
                <textarea id="sub-description" className="input" rows={2} maxLength={500} value={form.description} onChange={(e) => update({ description: e.target.value })} placeholder="Brief description of the sub-office..." />
              </div>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
