"use client";

import { useState } from "react";
import { ModalShell } from "@/components/admin/ModalShell";
import { Select } from "@/components/ui/Select";
import { adminFetch } from "@/lib/admin-fetch";
import { VALID_IDS } from "@/lib/valid-ids";

export interface EditableVisitor {
  fullName: string;
  validId: string;
}

interface EditInvitationVisitorsModalProps {
  invitation: { id: string; referenceNumber: string | null; officeName: string; visitors: EditableVisitor[] } | null;
  onClose: () => void;
  onSaved: () => void;
}

// Changes the names on an existing invitation. The reference number and QR code stay the same;
// the gate and the ticket PDF both read the names fresh, so they show the new names immediately.
function EditInvitationVisitorsModalInner({ invitation, onClose, onSaved }: EditInvitationVisitorsModalProps & { invitation: NonNullable<EditInvitationVisitorsModalProps["invitation"]> }) {
  const [visitors, setVisitors] = useState<EditableVisitor[]>(invitation.visitors.map((visitor) => ({ ...visitor })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = (index: number, field: keyof EditableVisitor, value: string) => {
    setVisitors((previous) => previous.map((visitor, i) => (i === index ? { ...visitor, [field]: value } : visitor)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    for (const [index, visitor] of visitors.entries()) {
      if (!visitor.fullName.trim()) return setError(index === 0 ? "The main visitor's name is required" : `Visitor ${index + 1} needs a name`);
      if (index > 0 && !visitor.validId) return setError(`Select a valid ID for visitor ${index + 1}`);
    }
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/invitations/${invitation.id}/visitors`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitors }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update visitor names");
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update visitor names");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <ModalShell open={true} title="Names Updated" onClose={onClose} maxWidthClass="max-w-md"
        footer={
          <>
            <a href={`/api/admin/invitations/${invitation.id}/ticket`} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download Updated Ticket
            </a>
            <button onClick={onClose} className="btn-secondary flex-1">Close</button>
          </>
        }>
        <div className="text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-sm text-gray-600">
            The guards will see the new names when they scan reference <span className="font-mono font-bold text-primary">{invitation.referenceNumber}</span>.
            The reference number and QR code are unchanged. Download the updated ticket and share it with the visitor.
          </p>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell open={true} title="Edit Visitor Names" subtitle={`${invitation.officeName}${invitation.referenceNumber ? ` · ${invitation.referenceNumber}` : ""}`} onClose={onClose} maxWidthClass="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" form="edit-visitors-form" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? "Saving..." : "Save Names"}
          </button>
        </>
      }>
      <form id="edit-visitors-form" onSubmit={handleSave} className="space-y-4">
        {error && <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
        <p className="text-xs text-gray-500">The reference number and QR code stay the same. Names can be changed until the visitors are checked in at the gate.</p>
        {visitors.map((visitor, index) => (
          <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4 first-of-type:border-0 first-of-type:pt-0">
            <div>
              <label htmlFor={`edit-visitor-${index}-name`} className="label">
                {index === 0 ? "Main Visitor Full Name" : `Visitor ${index + 1} Full Name`} <span className="text-red-500">*</span>
              </label>
              <input id={`edit-visitor-${index}-name`} type="text" className="input" maxLength={100} value={visitor.fullName}
                onChange={(e) => update(index, "fullName", e.target.value)} />
            </div>
            <div>
              <label htmlFor={`edit-visitor-${index}-id`} className="label">
                {index === 0 ? "Valid ID (optional)" : <>Visitor {index + 1} Valid ID <span className="text-red-500">*</span></>}
              </label>
              <Select id={`edit-visitor-${index}-id`} value={visitor.validId} onChange={(e) => update(index, "validId", e.target.value)}>
                <option value="">{index === 0 ? "Not specified" : "Select a government-issued ID..."}</option>
                {VALID_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
              </Select>
            </div>
          </div>
        ))}
      </form>
    </ModalShell>
  );
}

export function EditInvitationVisitorsModal({ invitation, onClose, onSaved }: EditInvitationVisitorsModalProps) {
  if (!invitation) return null;
  return <EditInvitationVisitorsModalInner key={invitation.id} invitation={invitation} onClose={onClose} onSaved={onSaved} />;
}
