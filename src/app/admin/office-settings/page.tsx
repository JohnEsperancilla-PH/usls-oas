"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import { StatusMessage, useStatusMessage } from "@/components/admin/StatusMessage";
import { adminFetch } from "@/lib/admin-fetch";
import { describeNotice, type BookingRules } from "@/lib/booking-rules";
import { formatHours, parseHours } from "@/lib/office-hours";
import type { Office } from "@/types/database";

interface FormState {
  email: string;
  contact_email: string;
  contact_phone: string;
  description: string;
  operating_hours: string;
  capacity_per_slot: string;
  hide_time_slots: boolean;
  // Empty means the office follows the system Booking Rules.
  max_advance_days: string;
  min_notice_hours: string;
}

function toForm(office: Office): FormState {
  return {
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

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export default function OfficeSettingsPage() {
  const { admin } = useAdmin();
  const isOfficeAdmin = admin?.role === "office_admin";
  const [officeName, setOfficeName] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [savedForm, setSavedForm] = useState<FormState | null>(null);
  const [systemRules, setSystemRules] = useState<BookingRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useStatusMessage();

  const fetchOffice = useCallback(async () => {
    if (!isOfficeAdmin) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/my-office", {});
      if (!res.ok) throw new Error("Failed to load office settings");
      const data: { office: Office; systemRules: BookingRules } = await res.json();
      setOfficeName(data.office.name);
      setForm(toForm(data.office));
      setSavedForm(toForm(data.office));
      setSystemRules(data.systemRules);
      setLoadFailed(false);
    } catch { setLoadFailed(true); }
    finally { setLoading(false); }
  }, [isOfficeAdmin]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchOffice(); }, [fetchOffice]);

  if (!isOfficeAdmin) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-sm text-gray-500">Office Settings is for office admins. Super admins edit offices on the Offices page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (loadFailed || !form) {
    return (
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Office Settings</h1>
        <StatusMessage message={{ type: "error", text: "Could not load your office's settings, so they can't be edited right now." }} onRetry={fetchOffice} />
      </div>
    );
  }

  const update = (patch: Partial<FormState>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setMessage(null);
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const parsedHours = parseHours(form.operating_hours);
  const hours = parsedHours || { start: "08:00", end: "17:00" };

  const systemAdvance = systemRules?.maxAdvanceDays == null ? "no limit" : `${systemRules.maxAdvanceDays} days`;
  const systemNotice = systemRules?.minNoticeHours == null ? "no minimum" : describeNotice(systemRules.minNoticeHours);

  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      const res = await adminFetch("/api/admin/my-office", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, capacity_per_slot: Number(form.capacity_per_slot) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save office settings. Please try again.");
      setSavedForm(form);
      setMessage({ type: "success", text: "Office settings saved" });
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Could not save office settings. Please try again." }); }
    finally { setSaving(false); }
  };

  const limits = [
    { key: "max_advance_days" as const, label: "Max Advance Booking (days)", min: 1, max: 365, system: systemAdvance,
      hint: "Visitors can't book further ahead than this." },
    { key: "min_notice_hours" as const, label: "Minimum Notice (hours)", min: 0, max: 168, system: systemNotice,
      hint: "Visitors must book at least this far ahead of the visit." },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Office Settings</h1>
        <p className="text-sm text-gray-500 mt-1">{officeName}</p>
      </div>

      <Section title="Contact Details" subtitle="How the system and visitors reach your office">
        <div>
          <label htmlFor="office-email" className="label">Office Email</label>
          <input id="office-email" type="email" className="input" value={form.email} maxLength={254}
            onChange={(e) => update({ email: e.target.value })} placeholder="office@usls.edu.ph" />
          <p className="text-[11px] text-gray-500 mt-1">
            <strong>Google Calendar invitations for approved appointments and invitations are sent to this email</strong>, along with new appointment request alerts. Use an inbox your office checks.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="office-contact-email" className="label">Contact Email</label>
            <input id="office-contact-email" type="email" className="input" value={form.contact_email} maxLength={254}
              onChange={(e) => update({ contact_email: e.target.value })} placeholder="Optional" />
            <p className="text-[11px] text-gray-400 mt-1">Shown to visitors in emails for follow-up questions. If blank, the office email is shown.</p>
          </div>
          <div>
            <label htmlFor="office-contact-phone" className="label">Contact Phone</label>
            <input id="office-contact-phone" type="tel" className="input" value={form.contact_phone} maxLength={30}
              onChange={(e) => update({ contact_phone: e.target.value })} placeholder="e.g. (034) 433-7777 loc 123" />
            <p className="text-[11px] text-gray-400 mt-1">Shown to visitors in emails.</p>
          </div>
        </div>
        <div>
          <label htmlFor="office-description" className="label">Description</label>
          <textarea id="office-description" className="input" rows={2} maxLength={500} value={form.description}
            onChange={(e) => update({ description: e.target.value })} placeholder="Brief description of the office..." />
        </div>
      </Section>

      <Section title="Scheduling" subtitle="Your office's hours and how visitors pick a time">
        <fieldset>
          <legend className="label">Operating Hours</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="office-hours-start" className="block text-xs text-gray-500 mb-1">Opens</label>
              <input id="office-hours-start" type="time" step={1800} className="input" value={hours.start}
                onChange={(e) => update({ operating_hours: formatHours(e.target.value, hours.end) })} />
            </div>
            <div>
              <label htmlFor="office-hours-end" className="block text-xs text-gray-500 mb-1">Closes</label>
              <input id="office-hours-end" type="time" step={1800} className="input" value={hours.end}
                onChange={(e) => update({ operating_hours: formatHours(hours.start, e.target.value) })} />
            </div>
          </div>
          {!parsedHours && (
            <p className="text-[11px] text-amber-700 mt-1">The saved hours &ldquo;{form.operating_hours}&rdquo; aren&apos;t in a standard format. Pick the times above to fix them.</p>
          )}
          <p className="text-[11px] text-gray-400 mt-1">Shown to visitors and used for the postpone, approval, and invitation time options.</p>
        </fieldset>
        <div className="sm:w-1/2">
          <label htmlFor="office-capacity" className="label">Capacity per Slot</label>
          <input id="office-capacity" type="number" min={1} max={100} className="input" value={form.capacity_per_slot}
            onChange={(e) => update({ capacity_per_slot: e.target.value })} />
          <p className="text-[11px] text-gray-400 mt-1">How many appointments can share one time slot.</p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.hide_time_slots} onChange={(e) => update({ hide_time_slots: e.target.checked })}
            className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
          <span className="flex-1">
            <span className="text-sm font-medium text-gray-900">Hide Time Slots from Visitors</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">Visitors pick only a date. Your office sets the time when approving, from the dashboard.</span>
          </span>
        </label>
      </Section>

      <Section title="Booking Limits" subtitle="How far ahead visitors can book your office. Leave a limit off to follow the system setting.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {limits.map((limit) => {
            const custom = form[limit.key] !== "";
            return (
              <div key={limit.key} className={`rounded-lg border p-4 ${custom ? "border-gray-200" : "border-dashed border-gray-200 bg-gray-50"}`}>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2 cursor-pointer">
                  <input type="checkbox" checked={custom}
                    onChange={(e) => update({ [limit.key]: e.target.checked ? String(limit.min === 0 ? 24 : 30) : "" })} />
                  Set a limit for this office
                </label>
                <label htmlFor={`office-${limit.key}`} className={`block text-xs font-medium mb-1 ${custom ? "text-gray-600" : "text-gray-400"}`}>{limit.label}</label>
                <input id={`office-${limit.key}`} type="number" min={limit.min} max={limit.max} disabled={!custom}
                  value={custom ? form[limit.key] : ""} placeholder={custom ? "" : `System: ${limit.system}`}
                  onChange={(e) => update({ [limit.key]: e.target.value })}
                  className="input disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" />
                <p className="text-[11px] text-gray-400 mt-1">{custom ? limit.hint : `Following the system setting: ${limit.system}.`}</p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400">Invitations your office creates aren&apos;t limited by these rules.</p>
      </Section>

      <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-gray-50/95 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
        {message ? (
          <StatusMessage message={message} onDismiss={() => setMessage(null)} className="sm:mr-auto py-2" />
        ) : dirty ? (
          <p className="text-xs text-amber-700 sm:mr-auto">You have unsaved changes.</p>
        ) : null}
        <button type="button" onClick={() => { setForm(savedForm); setMessage(null); }} disabled={saving || !dirty} className="btn-ghost disabled:opacity-40">Discard changes</button>
        <button type="button" onClick={save} disabled={saving || !dirty} className="btn-primary disabled:opacity-50 flex items-center gap-2">
          {saving ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</> : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
