"use client";

import { useState, useEffect, useCallback } from "react";
import type { OfficeContact } from "@/types/database";
import { ModalShell } from "@/components/admin/ModalShell";

interface OfficeContactsModalProps {
  open: boolean;
  officeId: string;
  officeName: string;
  onClose: () => void;
  onChanged?: () => void;
}

interface ContactForm {
  name: string;
  email: string;
  position: string;
}

const emptyForm: ContactForm = { name: "", email: "", position: "" };

function ContactFormModal({ open, officeId, contact, onClose, onSaved }: {
  open: boolean;
  officeId: string;
  contact: OfficeContact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ContactForm>(contact ? { name: contact.name, email: contact.email, position: contact.position || "" } : emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!form.name.trim()) throw new Error("Contact name is required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) throw new Error("Invalid contact email");
      const method = contact ? "PUT" : "POST";
      const url = contact ? `/api/admin/office-contacts/${contact.id}` : "/api/admin/office-contacts";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(contact ? {} : { officeId }), name: form.name, email: form.email, position: form.position || null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.message || "Failed to save contact"); }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} title={contact ? "Edit Contact" : "Add Contact"} subtitle={officeId ? "Tagged on invitations, calendar invites, and notifications." : undefined} onClose={onClose} maxWidthClass="max-w-xl"
      footer={
        <>
          <button type="submit" form="contact-form" disabled={saving} className="btn-primary flex-1 btn-sm disabled:opacity-50">
            {saving ? "Saving..." : contact ? "Update Contact" : "Add Contact"}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
        </>
      }>
      <form id="contact-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
        <div>
          <label className="label">Name <span className="text-red-500">*</span></label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={255} placeholder="e.g. Maria Santos" autoFocus required />
        </div>
        <div>
          <label className="label">Email <span className="text-red-500">*</span></label>
          <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={254} placeholder="contact@email.com" required />
        </div>
        <div>
          <label className="label">Position</label>
          <input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} maxLength={255} placeholder="e.g. Secretary" />
        </div>
      </form>
    </ModalShell>
  );
}

export function OfficeContactsPanel({ officeId, onChanged }: { officeId: string; onChanged?: () => void }) {
  const [contacts, setContacts] = useState<OfficeContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeContact | null>(null);
  const [formSession, setFormSession] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/office-contacts?officeId=${encodeURIComponent(officeId)}`);
      if (!res.ok) throw new Error("Failed to load contacts");
      const data = await res.json();
      setContacts((data || []).filter((c: OfficeContact) => c.active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [officeId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const openCreate = () => { setEditing(null); setFormSession((s) => s + 1); setFormOpen(true); };
  const openEdit = (contact: OfficeContact) => { setEditing(contact); setFormSession((s) => s + 1); setFormOpen(true); };

  const handleDelete = async (contact: OfficeContact) => {
    if (!confirm(`Remove ${contact.name} from office contacts?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/office-contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.message || "Failed to delete contact"); }
      fetchContacts();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contact");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-900">{contacts.length} Contact{contacts.length !== 1 ? "s" : ""}</h4>
        <button onClick={openCreate} className="btn-primary btn-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Contact
        </button>
      </div>

      {error && <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
        </div>
      ) : contacts.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-gray-200 rounded-xl">
          <p className="text-sm text-gray-500 font-medium mb-1">No contacts yet</p>
          <p className="text-xs text-gray-400">No office contacts have been added. Tagged contacts are added to invitations, calendar invites, and notifications.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{contact.name}</div>
                <div className="text-xs text-gray-400 truncate">
                  {contact.position ? `${contact.position} · ` : ""}{contact.email}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => openEdit(contact)} className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">Edit</button>
                <button onClick={() => handleDelete(contact)} className="text-xs font-medium text-red-600 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ContactFormModal
        key={formOpen ? `contact-form-${formSession}` : "contact-form-closed"}
        open={formOpen}
        officeId={officeId}
        contact={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); fetchContacts(); onChanged?.(); }}
      />
    </div>
  );
}

export function OfficeContactsModal({ open, officeId, officeName, onClose, onChanged }: OfficeContactsModalProps) {
  return (
    <ModalShell open={open} title="Office Contacts" subtitle={officeName} onClose={onClose} maxWidthClass="max-w-xl"
      footer={<button type="button" onClick={onClose} className="btn-secondary w-full btn-sm">Close</button>}>
      <OfficeContactsPanel officeId={officeId} onChanged={onChanged} />
    </ModalShell>
  );
}