"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";

interface OfficeContact {
  id: string;
  name: string;
  email: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  active: boolean;
}

interface SystemSettings {
  system_name: string;
  support_email: string;
  support_phone: string;
  max_advance_days: string;
  min_notice_hours: string;
  archive_approved: string;
  archive_declined: string;
  archive_completed: string;
  archive_expired: string;
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
  const [offices, setOffices] = useState<OfficeContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!admin) return;
    try {
      const [settingsRes, officesRes] = await Promise.all([
        fetch("/api/admin/settings", { headers: { "x-admin-email": admin.email } }),
        fetch("/api/admin/office-settings", { headers: { "x-admin-email": admin.email } }),
      ]);
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (officesRes.ok) setOffices(await officesRes.json());
    } catch { /* */ }
    finally { setLoading(false); }
  }, [admin]);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
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

  const updateOffice = (officeId: string, field: "contact_email" | "contact_phone", value: string) => {
    setOffices((prev) => prev.map((o) => o.id === officeId ? { ...o, [field]: value } : o));
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
        headers: { "Content-Type": "application/json", "x-admin-email": admin.email },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMessage({ type: "success", text: "Settings saved" });
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setSaving(false); }
  };

  const saveOfficeContact = async (office: OfficeContact) => {
    setSaving(true); setMessage(null);
    try {
      const res = await fetch("/api/admin/office-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-email": admin.email },
        body: JSON.stringify({ officeId: office.id, contact_email: office.contact_email, contact_phone: office.contact_phone }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMessage({ type: "success", text: `${office.name} contact info updated` });
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setSaving(false); }
  };

  const handleSync = async () => {
    setSyncLoading(true); setSyncResult(null);
    try {
      const res = await fetch("/api/admin/archive-sync", {
        method: "POST",
        headers: { "x-admin-email": admin.email },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSyncResult({ type: "success", text: data.message });
    } catch (err) { setSyncResult({ type: "error", text: err instanceof Error ? err.message : "Sync failed" }); }
    finally { setSyncLoading(false); }
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

      {/* Archive */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Data Archive</h2>
          <p className="text-xs text-gray-400 mt-0.5">Select which statuses are synced to cPanel MySQL backup</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: "archive_approved" as const, label: "Approved", color: "text-green-600 bg-green-50 border-green-200" },
              { key: "archive_declined" as const, label: "Declined", color: "text-red-600 bg-red-50 border-red-200" },
              { key: "archive_completed" as const, label: "Completed", color: "text-blue-600 bg-blue-50 border-blue-200" },
              { key: "archive_expired" as const, label: "Expired", color: "text-gray-600 bg-gray-50 border-gray-200" },
            ].map((item) => {
              const enabled = settings?.[item.key] !== "false";
              return (
                <button key={item.key} onClick={() => updateSetting(item.key, enabled ? "false" : "true")}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-center ${enabled ? item.color : "bg-white text-gray-400 border-gray-200 opacity-50"}`}>
                  <div className="flex items-center justify-center gap-2">
                    <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${enabled ? "border-current bg-current/10" : "border-gray-300"}`}>
                      {enabled && <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </span>
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSync} disabled={syncLoading}
              className="btn-primary btn-sm disabled:opacity-50 flex items-center gap-2">
              {syncLoading ? (
                <><span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> Syncing...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> Sync Now</>
              )}
            </button>
            <span className="text-xs text-gray-400">All unarchived records</span>
          </div>
          {syncResult && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in ${syncResult.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {syncResult.type === "success" ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              {syncResult.text}
            </div>
          )}
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
            { key: "notify_approval" as const, label: "Approval Email", desc: "Sent to visitor when appointment is approved (includes QR code)" },
            { key: "notify_decline" as const, label: "Decline Email", desc: "Sent to visitor when appointment is declined" },
            { key: "notify_qr_resend" as const, label: "QR Re-send", desc: "Sent to visitor when QR code is reset and re-issued" },
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

      {/* Office Contact Info */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Office Contact Information</h2>
          <p className="text-xs text-gray-400 mt-0.5">Set contact email and phone shown to visitors for follow-ups</p>
        </div>
        <div className="divide-y divide-gray-50">
          {offices.map((office) => (
            <div key={office.id} className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-900">{office.name}</div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${office.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  <span className={`w-1 h-1 rounded-full ${office.active ? "bg-green-500" : "bg-gray-400"}`} />
                  {office.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Contact Email</label>
                  <input type="email" value={office.contact_email || ""} onChange={(e) => updateOffice(office.id, "contact_email", e.target.value)}
                    className="input text-sm" placeholder={office.email || "Same as office email"} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Contact Phone</label>
                  <input type="tel" value={office.contact_phone || ""} onChange={(e) => updateOffice(office.id, "contact_phone", e.target.value)}
                    className="input text-sm" placeholder="e.g. (034) 433-7777 loc 123" />
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <button onClick={() => saveOfficeContact(office)} disabled={saving}
                  className="text-xs font-medium text-primary hover:text-primary/80 px-3 py-1 rounded hover:bg-primary/5 transition-colors disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save All System Settings */}
      <div className="flex justify-end pb-4">
        <button onClick={saveSettings} disabled={saving}
          className="btn-primary disabled:opacity-50 flex items-center gap-2">
          {saving ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</> : "Save All Settings"}
        </button>
      </div>
    </div>
  );
}
