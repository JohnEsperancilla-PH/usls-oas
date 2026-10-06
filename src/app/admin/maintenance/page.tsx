"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import { toManilaInputValue, formatManilaDateTime, type MaintenanceWindowState } from "@/lib/maintenance";

interface MaintenancePayload {
  active: boolean;
  reason: "manual" | "scheduled" | null;
  enabled: boolean;
  scheduled: boolean;
  headline: string;
  message: string;
  contactEmail: string;
  startAt: string | null;
  endAt: string | null;
  updatedAt: string | null;
  windowState: MaintenanceWindowState | null;
  remainingMs: number | null;
}

interface FormState {
  enabled: boolean;
  scheduled: boolean;
  start: string;
  end: string;
  headline: string;
  message: string;
  contactEmail: string;
}

const PRESETS = [
  { label: "1 hour", hours: 1 },
  { label: "2 hours", hours: 2 },
  { label: "4 hours", hours: 4 },
  { label: "8 hours", hours: 8 },
];

function toLocalInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

function Toggle({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled} aria-pressed={enabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-primary" : "bg-gray-300"}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function MaintenancePage() {
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "super_admin";

  const [form, setForm] = useState<FormState | null>(null);
  const [status, setStatus] = useState<MaintenancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await fetch("/api/admin/maintenance", { cache: "no-store" });
      if (!res.ok) return;
      const data: MaintenancePayload = await res.json();
      setStatus(data);
      setForm({
        enabled: data.enabled,
        scheduled: data.scheduled,
        start: toManilaInputValue(data.startAt),
        end: toManilaInputValue(data.endAt),
        headline: data.headline,
        message: data.message,
        contactEmail: data.contactEmail,
      });
    } catch {
      /* handled by empty form state */
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6V9a4 4 0 00-8 0v2" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">Super admin access required</p>
        </div>
      </div>
    );
  }

  if (loading || !form) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-64 rounded-lg" />
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  const update = (patch: Partial<FormState>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const applyPreset = (hours: number) => {
    const now = new Date();
    update({
      scheduled: true,
      enabled: false,
      start: toLocalInput(now),
      end: toLocalInput(new Date(now.getTime() + hours * 60 * 60 * 1000)),
    });
  };

  const clearWindow = () => update({ scheduled: false, start: "", end: "" });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      if (!csrfRes.ok) throw new Error("Unable to obtain security token");
      const { csrfToken } = await csrfRes.json();

      const res = await fetch("/api/admin/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save maintenance settings");

      setMessage({ type: "success", text: data.message || "Maintenance settings saved" });
      await fetchStatus();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Mode</h1>
          <p className="text-sm text-gray-500 mt-1">
            Temporarily replace the public booking page with an alternative maintenance landing page.
          </p>
        </div>
        <a href="/maintenance" target="_blank" rel="noopener noreferrer"
          className="btn-secondary btn-sm inline-flex items-center gap-2">
          Preview page
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h6m0 0v6m0-6l-8 8-3 3-2-2 3-3 8-8z" />
          </svg>
        </a>
      </div>

      {status?.updatedAt && (
        <p className="text-xs text-gray-400 -mt-3">
          Last changed {formatManilaDateTime(status.updatedAt) || status.updatedAt}
        </p>
      )}

      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in ${message.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {message.type === "success" ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          {message.text}
        </div>
      )}

      <div className={`rounded-xl border p-5 flex flex-wrap items-center justify-between gap-4 ${status?.active ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${status?.active ? "bg-amber-100" : "bg-green-100"}`}>
            {status?.active ? (
              <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <p className={`text-sm font-semibold ${status?.active ? "text-amber-900" : "text-gray-900"}`}>
              {status?.active ? "Maintenance mode is ON" : "Maintenance mode is OFF"}
            </p>
            <p className={`text-xs mt-0.5 ${status?.active ? "text-amber-800" : "text-gray-400"}`}>
              {status?.active
                ? status.reason === "scheduled"
                  ? "Visitors see the maintenance page inside the scheduled window."
                  : "Visitors see the maintenance page on every public page refresh."
                : "Public booking form is live and accepting requests."}
            </p>
          </div>
        </div>
        <Toggle enabled={form.enabled} onToggle={() => update({ enabled: !form.enabled })} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Scheduled Window</h2>
            <p className="text-xs text-gray-400 mt-0.5">Automatically activate and deactivate without further action</p>
          </div>
          {form.scheduled ? (
            <button type="button" onClick={clearWindow} className="btn-ghost btn-sm text-xs">Clear</button>
          ) : (
            <Toggle enabled={form.scheduled} onToggle={() => update({ scheduled: true })} />
          )}
        </div>

        {form.scheduled && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="maint-start" className="block text-xs font-medium text-gray-600 mb-1">Starts (Philippine Time)</label>
                <input id="maint-start" type="datetime-local" value={form.start}
                  onChange={(e) => update({ start: e.target.value })} className="input" />
              </div>
              <div>
                <label htmlFor="maint-end" className="block text-xs font-medium text-gray-600 mb-1">Ends (Philippine Time)</label>
                <input id="maint-end" type="datetime-local" value={form.end}
                  onChange={(e) => update({ end: e.target.value })} className="input" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Quick set:</span>
              {PRESETS.map((preset) => (
                <button key={preset.hours} type="button" onClick={() => applyPreset(preset.hours)}
                  className="btn-secondary btn-sm text-xs">{preset.label} from now</button>
              ))}
            </div>

            {status?.windowState && (
              <div className={`text-xs px-3 py-2 rounded-lg border ${
                status.windowState === "running" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-gray-50 border-gray-200 text-gray-600"
              }`}>
                {status.windowState === "upcoming" && "Scheduled — the maintenance page is not live yet."}
                {status.windowState === "running" && "The scheduled window is currently open — the maintenance page is live."}
                {status.windowState === "ended" && "The scheduled window has ended — the maintenance page is no longer live from this schedule."}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Maintenance Page Content</h2>
          <p className="text-xs text-gray-400 mt-0.5">Shown to visitors on the alternative landing page</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="maint-headline" className="block text-xs font-medium text-gray-600 mb-1">Headline</label>
            <input id="maint-headline" type="text" maxLength={200} value={form.headline}
              onChange={(e) => update({ headline: e.target.value })} className="input" placeholder="We are currently under maintenance" />
            <p className="text-[11px] text-gray-400 mt-1">{form.headline.length}/200</p>
          </div>
          <div>
            <label htmlFor="maint-message" className="block text-xs font-medium text-gray-600 mb-1">Message</label>
            <textarea id="maint-message" rows={5} maxLength={2000} value={form.message}
              onChange={(e) => update({ message: e.target.value })} className="input resize-y" />
            <p className="text-[11px] text-gray-400 mt-1">{form.message.length}/2000 &mdash; line breaks are preserved on the page</p>
          </div>
          <div>
            <label htmlFor="maint-email" className="block text-xs font-medium text-gray-600 mb-1">Contact Email</label>
            <input id="maint-email" type="email" value={form.contactEmail}
              onChange={(e) => update({ contactEmail: e.target.value })} className="input" placeholder="Optional &mdash; shown to visitors with questions" />
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-blue-900">While maintenance is active</h2>
        <ul className="mt-2 space-y-1 text-xs text-blue-800 list-disc pl-5">
          <li>The public booking form at <code className="font-mono">/</code> is replaced by the maintenance page.</li>
          <li>Appointment submissions are rejected by the server even from an already-open booking page.</li>
          <li>Admin, gate, and office pages stay reachable so staff can keep handling existing appointments.</li>
          <li>Every change here is written to the audit log.</li>
        </ul>
      </div>

      <div className="flex justify-end gap-3 pb-4">
        <button type="button" onClick={fetchStatus} disabled={saving} className="btn-ghost">Discard changes</button>
        <button type="button" onClick={save} disabled={saving}
          className="btn-primary disabled:opacity-50 flex items-center gap-2">
          {saving ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</> : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
