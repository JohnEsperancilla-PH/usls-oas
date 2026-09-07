"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";

interface SystemSettings {
  system_name: string;
  support_email: string;
  support_phone: string;
  max_advance_days: string;
  min_notice_hours: string;
  notify_confirmation: string;
  notify_admin_alert: string;
  notify_approval: string;
  notify_decline: string;
  notify_qr_resend: string;
}

export default function SettingsPage() {
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "super_admin";
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!admin) return;
    try {
      const settingsRes = await fetch("/api/admin/settings", {});
      if (settingsRes.ok) setSettings(await settingsRes.json());
    } catch { /* */ }
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

  const updateSetting = (key: keyof SystemSettings, value: string) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const toggleNotification = (key: keyof SystemSettings) => {
    setSettings((prev) => prev ? { ...prev, [key]: prev[key] === "true" ? "false" : "true" } : prev);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true); setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMessage({ type: "success", text: "Settings saved" });
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setSaving(false); }
  };

  const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button type="button" onClick={onToggle}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-primary" : "bg-gray-300"}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">System configuration and data management</p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in ${message.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {message.type === "success" ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          {message.text}
        </div>
      )}

      {/* System Info */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">System Information</h2>
          <p className="text-xs text-gray-400 mt-0.5">General system configuration</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">System Name</label>
            <input type="text" value={settings?.system_name || ""} onChange={(e) => updateSetting("system_name", e.target.value)} className="input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Support Email</label>
              <input type="email" value={settings?.support_email || ""} onChange={(e) => updateSetting("support_email", e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Support Phone</label>
              <input type="tel" value={settings?.support_phone || ""} onChange={(e) => updateSetting("support_phone", e.target.value)} className="input" placeholder="Optional" />
            </div>
          </div>
        </div>
      </div>

      {/* Booking Rules */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Booking Rules</h2>
          <p className="text-xs text-gray-400 mt-0.5">Control how far in advance visitors can book</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Advance Booking (days)</label>
              <input type="number" min="1" max="365" value={settings?.max_advance_days || "30"} onChange={(e) => updateSetting("max_advance_days", e.target.value)} className="input" />
              <p className="text-[11px] text-gray-400 mt-1">Visitors cannot book beyond this many days</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Minimum Notice (hours)</label>
              <input type="number" min="0" max="168" value={settings?.min_notice_hours || "24"} onChange={(e) => updateSetting("min_notice_hours", e.target.value)} className="input" />
              <p className="text-[11px] text-gray-400 mt-1">Appointments must be at least this far in advance</p>
            </div>
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
            { key: "notify_qr_resend" as const, label: "Reference Re-send", desc: "Sent to visitor when the reference number is reset and re-issued" },
          ].map((item) => (
            <div key={item.key} className="px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">{item.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
              </div>
              <Toggle enabled={settings?.[item.key] !== "false"} onToggle={() => toggleNotification(item.key)} />
            </div>
          ))}
        </div>
      </div>

      {/* Office contact info is edited per office under the Offices page. */}

      {/* Save All System Settings */}
      <div className="flex justify-end pb-4">
        <button onClick={saveSettings} disabled={saving}
          className="btn-primary disabled:opacity-50 flex items-center gap-2">
          {saving ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</> : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
