"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import { VALID_IDS } from "@/lib/valid-ids";
import type { Office, OfficeContact } from "@/types/database";
import { ModalShell } from "@/components/admin/ModalShell";

interface InvitationVehicle {
  plateNumber: string;
  makeModel: string | null;
}

interface NewInvitationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const VISITOR_CATEGORIES = [
  { value: "external", label: "External (Companies, Organizations, Groups)" },
  { value: "parents", label: "Parents" },
  { value: "alumni", label: "Alumni" },
  { value: "vendor", label: "Vendor / Supplier" },
];

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  visitorCategory: "external",
  validId: "",
  personToMeet: "",
  purposeOfVisit: "",
  officeId: "",
  date: "",
  timeSlot: "",
  duration: "30",
};

function parseOperatingHours(hours: string): { startH: number; endH: number } {
  const match = hours.match(/(\d{1,2}):?\d{0,2}\s*(AM|PM)\s*[-–]\s*(\d{1,2}):?\d{0,2}\s*(AM|PM)/i);
  if (!match) return { startH: 8, endH: 17 };
  let startH = parseInt(match[1]);
  let endH = parseInt(match[3]);
  if (match[2].toUpperCase() === "PM" && startH < 12) startH += 12;
  if (match[2].toUpperCase() === "AM" && startH === 12) startH = 0;
  if (match[4].toUpperCase() === "PM" && endH < 12) endH += 12;
  if (match[4].toUpperCase() === "AM" && endH === 12) endH = 0;
  return { startH, endH };
}

function buildTimeSlots(office: Office | undefined): string[] {
  if (!office) return [];
  const { startH, endH } = parseOperatingHours(office.operating_hours);
  const slots: string[] = [];
  for (let h = startH; h < endH; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

function formatSlot(timeSlot: string): string {
  const [h, m] = timeSlot.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide text-primary">{title}</h3>
      <div className="flex-1 h-px bg-gray-200" />
      {children}
    </div>
  );
}

function HelperText({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-gray-400 mt-1.5">{children}</p>;
}

function RequiredLabel({ label, htmlFor }: { label: string; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="label flex items-center gap-1">
      {label}
      <span className="text-red-500 font-medium" aria-hidden="true">*</span>
    </label>
  );
}

function NewInvitationModalInner({ onClose, onSuccess }: Omit<NewInvitationModalProps, "open">) {
  const { admin } = useAdmin();
  const isSuperAdmin = admin.role === "super_admin";
  const [offices, setOffices] = useState<Office[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm, officeId: !isSuperAdmin ? admin.office_id || "" : "" });
  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicles, setVehicles] = useState<InvitationVehicle[]>([]);
  const [visitorCount, setVisitorCount] = useState(1);
  const [visitorsEnabled, setVisitorsEnabled] = useState(false);
  const [additionalVisitors, setAdditionalVisitors] = useState<{ fullName: string; validId: string }[]>([]);
  const [created, setCreated] = useState<{ id: string; referenceNumber: string } | null>(null);
  const [contacts, setContacts] = useState<OfficeContact[]>([]);
  const [taggedContactIds, setTaggedContactIds] = useState<string[]>([]);

  const fetchOffices = useCallback(async () => {
    try {
      const offRes = await fetch("/api/offices");
      const offData = offRes.ok ? await offRes.json() : [];
      setOffices((offData || []).filter((o: Office) => o.active));
    } catch { /* keep empty */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchOffices(); }, [fetchOffices]);

  const selectableOffices = isSuperAdmin ? offices : offices.filter((o) => o.id === admin.office_id);
  const selectedOffice = selectableOffices.find((o) => o.id === (form.officeId || (!isSuperAdmin ? admin.office_id : "")));
  const timeSlots = buildTimeSlots(selectedOffice);
  const activeOfficeId = form.officeId || (!isSuperAdmin ? admin.office_id || "" : "");

  const fetchContacts = useCallback(async (officeId: string) => {
    if (!officeId) { setContacts([]); setTaggedContactIds([]); return; }
    try {
      const res = await fetch(`/api/admin/office-contacts?officeId=${encodeURIComponent(officeId)}`, {});
      if (!res.ok) { setContacts([]); return; }
      const data = await res.json();
      setContacts((data || []).filter((c: OfficeContact) => c.active));
    } catch { setContacts([]); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchContacts(activeOfficeId); }, [activeOfficeId, fetchContacts]);

  const toggleContact = (id: string) => {
    setTaggedContactIds((previous) => previous.includes(id) ? previous.filter((c) => c !== id) : [...previous, id]);
  };

  const changeVehicleCount = (nextCount: number) => {
    const count = Math.min(5, Math.max(1, nextCount));
    setVehicles((previous) => Array.from({ length: count }, (_, index) => previous[index] || { plateNumber: "", makeModel: "" }));
  };

  const toggleVehicle = (enabled: boolean) => {
    setHasVehicle(enabled);
    if (enabled) setVehicles((previous) => (previous.length > 0 ? previous : [{ plateNumber: "", makeModel: "" }]));
  };

  const updateVehicle = (index: number, field: "plateNumber" | "makeModel", value: string) => {
    setVehicles((previous) => previous.map((vehicle, vehicleIndex) => (vehicleIndex === index ? { ...vehicle, [field]: value } : vehicle)));
  };

  const changeVisitorCount = (nextCount: number) => {
    const count = Math.min(10, Math.max(1, nextCount));
    setVisitorCount(count);
    setAdditionalVisitors((previous) => Array.from({ length: count - 1 }, (_, index) => previous[index] || { fullName: "", validId: "" }));
  };

  const toggleVisitors = (enabled: boolean) => {
    setVisitorsEnabled(enabled);
    if (!enabled) {
      setVisitorCount(1);
      setAdditionalVisitors([]);
    }
  };

  const updateAdditionalVisitor = (index: number, field: "fullName" | "validId", value: string) => {
    setAdditionalVisitors((previous) => previous.map((visitor, visitorIndex) => visitorIndex === index ? { ...visitor, [field]: value } : visitor));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const officeId = form.officeId || (!isSuperAdmin ? admin.office_id : "");
      if (!officeId) throw new Error("Please select an office");
      if (!form.fullName.trim()) throw new Error("Visitor name is required");
      if (!form.date) throw new Error("Please select a date");
      if (!form.timeSlot) throw new Error("Please select a time slot");
      if (hasVehicle && vehicles.some((vehicle) => !vehicle.plateNumber.trim())) throw new Error("Plate number is required for each vehicle");
      if (visitorsEnabled) {
        for (const visitor of additionalVisitors) {
          if (!visitor.fullName.trim()) throw new Error("Each additional visitor must have a name");
          if (!visitor.validId) throw new Error("Each additional visitor must have a valid ID selected");
        }
      }

      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email || undefined,
          phone: form.phone || undefined,
          visitorCategory: form.visitorCategory,
          validId: form.validId || undefined,
          personToMeet: form.personToMeet || undefined,
          purposeOfVisit: form.purposeOfVisit || undefined,
          officeId,
          date: form.date,
          timeSlot: form.timeSlot,
          duration: Number(form.duration),
          visitorCount: visitorsEnabled ? visitorCount : 1,
          additionalVisitors: visitorsEnabled ? additionalVisitors : [],
          vehicles: hasVehicle ? vehicles : [],
          taggedContactIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create invitation");
      setCreated({ id: data.invitation.id, referenceNumber: data.invitation.referenceNumber });
      onSuccess?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create invitation");
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <ModalShell open={true} title="Invitation Created" onClose={onClose} maxWidthClass="max-w-md"
        footer={
          <>
            <a href={`/api/admin/invitations/${created.id}/ticket`} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download Ticket PDF
            </a>
            <button onClick={onClose} className="btn-secondary flex-1">Close</button>
          </>
        }>
        <div className="text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Invitation Created</h3>
          <p className="text-sm text-gray-500 mb-6">
            {form.email ? "The invitation email with the ticket PDF was sent (or is being sent) to the visitor." : "No email was provided — download the ticket and share it with the visitor."}
            {taggedContactIds.length > 0 && " Tagged office contacts were added to the calendar invite and notified by email."}
          </p>
          <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Reference Number</div>
            <div className="font-mono text-2xl font-bold text-primary tracking-widest">{created.referenceNumber}</div>
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell open={true} title="New Invitation" subtitle={selectedOffice?.name} onClose={onClose} maxWidthClass="max-w-[1000px]"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" form="invitation-form" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? "Creating..." : "Create Invitation"}
          </button>
        </>
      }>
      <form id="invitation-form" onSubmit={handleCreate} className="min-w-full">
        {formError && <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700 mb-6">{formError}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-6">
          <div className="space-y-6">
            <div>
              <SectionHeader title="Appointment Details" />
              <div className="space-y-4">
                <div>
                  <RequiredLabel label="Office" htmlFor="inv-office" />
                  <select id="inv-office" className="input" value={form.officeId || (!isSuperAdmin ? admin.office_id || "" : "")}
                    onChange={(e) => { setForm((p) => ({ ...p, officeId: e.target.value, timeSlot: "" })); setTaggedContactIds([]); }} disabled={!isSuperAdmin}>
                    <option value="">Select an office...</option>
                    {selectableOffices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <RequiredLabel label="Date" htmlFor="inv-date" />
                    <input id="inv-date" type="date" className="input" value={form.date} min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div>
                    <RequiredLabel label="Time" htmlFor="inv-time" />
                    <select id="inv-time" className="input" value={form.timeSlot} onChange={(e) => setForm((p) => ({ ...p, timeSlot: e.target.value }))}>
                      <option value="">Select...</option>
                      {timeSlots.map((slot) => <option key={slot} value={slot}>{formatSlot(slot)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="inv-duration" className="label">Duration</label>
                    <select id="inv-duration" className="input" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}>
                      <option value="30">30 minutes</option>
                      <option value="60">60 minutes</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <SectionHeader title="Visitor Information" />
              <div className="space-y-4">
                <div>
                  <RequiredLabel label="Visitor Full Name" htmlFor="inv-name" />
                  <input id="inv-name" type="text" className="input" value={form.fullName} maxLength={100} placeholder="e.g. Juan Dela Cruz"
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inv-email" className="label">Email (optional)</label>
                    <input id="inv-email" type="email" className="input" value={form.email} maxLength={254} placeholder="visitor@email.com"
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                    <HelperText>If provided, the invitation and ticket PDF are emailed.</HelperText>
                  </div>
                  <div>
                    <label htmlFor="inv-phone" className="label">Phone (optional)</label>
                    <input id="inv-phone" type="tel" className="input" value={form.phone} maxLength={20} placeholder="0917 123 4567"
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inv-category" className="label">Visitor Category</label>
                    <select id="inv-category" className="input" value={form.visitorCategory} onChange={(e) => setForm((p) => ({ ...p, visitorCategory: e.target.value }))}>
                      {VISITOR_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="inv-validid" className="label">Valid ID (optional)</label>
                    <select id="inv-validid" className="input" value={form.validId} onChange={(e) => setForm((p) => ({ ...p, validId: e.target.value }))}>
                      <option value="">Not specified</option>
                      {VALID_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <SectionHeader title="Visit Details" />
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inv-meet" className="label">Person to Meet (optional)</label>
                    <input id="inv-meet" type="text" className="input" value={form.personToMeet} maxLength={120}
                      onChange={(e) => setForm((p) => ({ ...p, personToMeet: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="inv-purpose" className="label">Purpose (optional)</label>
                    <input id="inv-purpose" type="text" className="input" value={form.purposeOfVisit} maxLength={500}
                      onChange={(e) => setForm((p) => ({ ...p, purposeOfVisit: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <SectionHeader title="Additional Options" />
              <div className="space-y-6">
                <div>
                  <label className="label" htmlFor="inv-visitorCount">Number of Visitors</label>
                  <HelperText>The person booking is included. Everyone must enter together using the booking person&apos;s gate entry code.</HelperText>
                  <div className="mt-2 flex items-center gap-3">
                    <button type="button" onClick={() => toggleVisitors(false)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all flex-1 sm:flex-none ${!visitorsEnabled ? "bg-primary/10 text-primary border-primary/30" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                      1 Visitor
                    </button>
                    <button type="button" onClick={() => toggleVisitors(true)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all flex-1 sm:flex-none ${visitorsEnabled ? "bg-primary/10 text-primary border-primary/30" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                      Multiple Visitors
                    </button>
                  </div>

                  {visitorsEnabled && (
                    <div className="mt-4 flex items-center gap-3">
                      <button type="button" onClick={() => changeVisitorCount(visitorCount - 1)} disabled={visitorCount <= 1} aria-label="Decrease number of visitors" className="w-10 h-10 rounded-lg border border-gray-200 text-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40">-</button>
                      <input id="inv-visitorCount" type="number" min={1} max={10} value={visitorCount} onChange={(e) => changeVisitorCount(Number(e.target.value))} className="input w-20 text-center" />
                      <button type="button" onClick={() => changeVisitorCount(visitorCount + 1)} disabled={visitorCount >= 10} aria-label="Increase number of visitors" className="w-10 h-10 rounded-lg border border-gray-200 text-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40">+</button>
                      <span className="text-sm text-gray-500">visitors total</span>
                    </div>
                  )}
                </div>

                {additionalVisitors.length > 0 && (
                  <div className="space-y-4 border border-primary/10 bg-primary/5 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-900">Additional Visitors</h4>
                    {additionalVisitors.map((visitor, index) => (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-primary/10 pt-4 first:border-0 first:pt-0">
                        <div>
                          <label htmlFor={`inv-additional-${index}-name`} className="label">Visitor {index + 2} Full Name <span className="text-red-500">*</span></label>
                          <input id={`inv-additional-${index}-name`} type="text" value={visitor.fullName} onChange={(e) => updateAdditionalVisitor(index, "fullName", e.target.value)} className="input" placeholder="Full name" maxLength={100} />
                        </div>
                        <div>
                          <label htmlFor={`inv-additional-${index}-id`} className="label">Visitor {index + 2} Valid ID <span className="text-red-500">*</span></label>
                          <select id={`inv-additional-${index}-id`} value={visitor.validId} onChange={(e) => updateAdditionalVisitor(index, "validId", e.target.value)} className="input">
                            <option value="">Select a government-issued ID...</option>
                            {VALID_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="label mb-0 block">Vehicles (optional)</span>
                      <HelperText>Register vehicles the visitor will bring to campus.</HelperText>
                    </div>
                    <button type="button" role="switch" aria-checked={hasVehicle} aria-label="Toggle vehicles" onClick={() => toggleVehicle(!hasVehicle)}
                      className={`relative px-4 py-2 rounded-lg border text-sm font-medium transition-all shrink-0 flex items-center gap-2 ${hasVehicle ? "bg-primary/10 text-primary border-primary/30" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                      <span className="w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center transition-transform">
                        {hasVehicle && <span className="w-2.5 h-2.5 bg-primary rounded-full" />}
                      </span>
                      {hasVehicle ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  {hasVehicle && (
                    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => changeVehicleCount(vehicles.length - 1)} disabled={vehicles.length <= 1} aria-label="Decrease number of vehicles" className="w-9 h-9 rounded-lg border border-gray-200 text-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">-</button>
                        <span className="input w-16 text-center pointer-events-none">{vehicles.length}</span>
                        <button type="button" onClick={() => changeVehicleCount(vehicles.length + 1)} disabled={vehicles.length >= 5} aria-label="Increase number of vehicles" className="w-9 h-9 rounded-lg border border-gray-200 text-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">+</button>
                        <span className="text-sm text-gray-500">vehicle(s)</span>
                      </div>
                      {vehicles.map((vehicle, index) => (
                        <div key={index} className="grid grid-cols-2 gap-2">
                          <input type="text" className="input font-mono uppercase" value={vehicle.plateNumber} placeholder="Plate no. *" maxLength={15} aria-label={`Vehicle ${index + 1} plate number`}
                            onChange={(e) => updateVehicle(index, "plateNumber", e.target.value.toUpperCase())} />
                          <input type="text" className="input" value={vehicle.makeModel || ""} placeholder="Make / Model" maxLength={100} aria-label={`Vehicle ${index + 1} make and model`}
                            onChange={(e) => updateVehicle(index, "makeModel", e.target.value)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div>
                    <span className="label mb-0 block">Tag Office Contacts (optional)</span>
                    <HelperText>Tagged contacts are added to the calendar invite and receive a notification email (no ticket).</HelperText>
                  </div>
                  {activeOfficeId && contacts.length > 0 ? (
                    <div className="mt-3 space-y-2 max-h-44 overflow-y-auto pr-1">
                      {contacts.map((contact) => (
                        <label key={contact.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer">
                          <input type="checkbox" checked={taggedContactIds.includes(contact.id)} onChange={() => toggleContact(contact.id)} className="w-4 h-4 rounded border-gray-300 text-primary accent-[#006633]" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-gray-800 truncate">{contact.name}</span>
                            <span className="block text-xs text-gray-400 truncate">{contact.position ? `${contact.position} · ` : ""}{contact.email}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-400">
                      {activeOfficeId ? "No office contacts yet. Ask your admin to add contacts to this office." : "Select an office to load its contacts."}
                    </div>
                  )}
                  {taggedContactIds.length > 0 && (
                    <p className="text-[11px] text-primary font-medium mt-2.5">{taggedContactIds.length} contact{taggedContactIds.length !== 1 ? "s" : ""} tagged</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

export function NewInvitationModal({ open, onClose, onSuccess }: NewInvitationModalProps) {
  if (!open) return null;
  return <NewInvitationModalInner key="open" onClose={onClose} onSuccess={onSuccess} />;
}