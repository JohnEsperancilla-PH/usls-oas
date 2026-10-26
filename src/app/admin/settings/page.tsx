"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import { StatusMessage, useStatusMessage } from "@/components/admin/StatusMessage";
import { adminFetch } from "@/lib/admin-fetch";

interface SystemSettings {
  system_name: string;
  support_email: string;
  support_phone: string;
  max_advance_days: string;
  min_notice_hours: string;
  booking_max_advance_enabled?: string;
  booking_min_notice_enabled?: string;
  notify_confirmation: string;
  notify_admin_alert: string;
  notify_approval: string;
  notify_decline: string;
  notify_qr_resend: string;
  notify_postponement: string;
  notify_invitation: string;
}

export default function SettingsPage() {
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "super_admin";
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useStatusMessage();
  const [loadFailed, setLoadFailed] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchData = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    try {
      const settingsRes = await adminFetch("/api/admin/settings", {});
      if (!settingsRes.ok) throw new Error("Failed to load settings");
      setSettings(await settingsRes.json());
      setLoadFailed(false);
    } catch { setLoadFailed(true); }
    finally { setLoading(false); }
  }, [admin]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [fetchData]);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (loadFailed || !settings) {
    return (
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <StatusMessage message={{ type: "error", text: "Could not load the current settings, so they can't be edited right now." }} onRetry={fetchData} />
      </div>
    );
  }

  const updateSetting = (key: keyof SystemSettings, value: string) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
    setDirty(true); setMessage(null);
  };

  const toggleNotification = (key: keyof SystemSettings) => {
    setSettings((prev) => prev ? { ...prev, [key]: prev[key] !== "false" ? "false" : "true" } : prev);
    setDirty(true); setMessage(null);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true); setMessage(null);
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Could not save settings. Please try again.");
      }
      setMessage({ type: "success", text: "Settings saved" });
      setDirty(false);
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Could not save settings. Please try again." }); }
    finally { setSaving(false); }
  };

  const Toggle = ({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) => (
    <button type="button" onClick={onToggle} role="switch" aria-checked={enabled} aria-label={label}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${enabled ? "bg-primary" : "bg-gray-300"}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">System configuration and data management</p>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">System Information</h2>
          <p className="text-xs text-gray-400 mt-0.5">General system configuration</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="setting-system_name" className="block text-xs font-medium text-gray-600 mb-1">System Name</label>
            <input type="text" value={settings?.system_name || ""} id="setting-system_name" onChange={(e) => updateSetting("system_name", e.target.value)} className="input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="setting-support_email" className="block text-xs font-medium text-gray-600 mb-1">Support Email</label>
              <input type="email" value={settings?.support_email || ""} id="setting-support_email" onChange={(e) => updateSetting("support_email", e.target.value)} className="input" />
            </div>
            <div>
              <label htmlFor="setting-support_phone" className="block text-xs font-medium text-gray-600 mb-1">Support Phone</label>
              <input type="tel" value={settings?.support_phone || ""} id="setting-support_phone" onChange={(e) => updateSetting("support_phone", e.target.value)} className="input" placeholder="Optional" />
            </div>
          </div>
        </div>
      </div>

      {/* Booking Rules */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Booking Rules</h2>
          <p className="text-xs text-gray-400 mt-0.5">Control how far in advance visitors can book. Admin-created invitations aren&apos;t limited by these rules.</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { enabledKey: "booking_max_advance_enabled" as const, valueKey: "max_advance_days" as const, label: "Max Advance Booking (days)", fallback: "30", min: 1, max: 365,
                on: "Visitors cannot book beyond this many days", off: "Off: visitors can book any future date" },
              { enabledKey: "booking_min_notice_enabled" as const, valueKey: "min_notice_hours" as const, label: "Minimum Notice (hours)", fallback: "24", min: 0, max: 168,
                on: "Appointments must be at least this far in advance", off: "Off: visitors can book any slot that hasn't started" },
            ].map((rule) => {
              const enabled = settings?.[rule.enabledKey] !== "false";
              return (
                <div key={rule.valueKey} className={`rounded-lg border p-4 transition-colors ${enabled ? "border-gray-200" : "border-dashed border-gray-200 bg-gray-50"}`}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <label htmlFor={`setting-${rule.valueKey}`} className={`text-xs font-medium ${enabled ? "text-gray-600" : "text-gray-400"}`}>{rule.label}</label>
                    <Toggle enabled={enabled} onToggle={() => toggleNotification(rule.enabledKey)} label={`${rule.label} rule`} />
                  </div>
                  <input type="number" min={rule.min} max={rule.max} id={`setting-${rule.valueKey}`} disabled={!enabled}
                    value={settings?.[rule.valueKey] || rule.fallback}
                    onChange={(e) => updateSetting(rule.valueKey, e.target.value)}
                    className="input disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" />
                  <p className="text-[11px] text-gray-400 mt-1">{enabled ? rule.on : rule.off}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notification Toggles */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Email Notifications</h2>
          <p className="text-xs text-gray-400 mt-0.5">Toggle which emails are sent automatically</p>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { key: "notify_confirmation" as const, label: "Booking Confirmation", desc: "Sent to visitor when appointment is created" },
            { key: "notify_admin_alert" as const, label: "Admin Alert", desc: "Sent to office admin when new appointment is pending" },
            { key: "notify_approval" as const, label: "Approval Email", desc: "Sent to visitor when appointment is approved (includes reference number)" },
            { key: "notify_decline" as const, label: "Decline Email", desc: "Sent to visitor when appointment is declined" },
            { key: "notify_postponement" as const, label: "Postponement Email", desc: "Sent to visitor when appointment is postponed to a new schedule" },
            { key: "notify_invitation" as const, label: "Invitation Email", desc: "Sent to visitor when the office creates a manual invitation (includes ticket PDF)" },
            { key: "notify_qr_resend" as const, label: "Reference Re-send", desc: "Sent to visitor when the reference number is reset and re-issued" },
          ].map((item) => (
            <div key={item.key} className="px-5 py-3.5 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-gray-900">{item.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
              </div>
              <Toggle enabled={settings?.[item.key] !== "false"} onToggle={() => toggleNotification(item.key)} label={item.label} />
            </div>
          ))}
        </div>
      </div>

      {/* Office contact info is edited per office under the Offices page. */}

      {/* Save All System Settings */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-gray-50/95 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
        {message ? (
          <StatusMessage message={message} onDismiss={() => setMessage(null)} className="sm:mr-auto py-2" />
        ) : dirty ? (
          <p className="text-xs text-amber-700 sm:mr-auto">You have unsaved changes.</p>
        ) : null}
        <button onClick={saveSettings} disabled={saving}
          className="btn-primary disabled:opacity-50 flex items-center gap-2">
          {saving ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</> : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
