"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import { StatusMessage, useStatusMessage } from "@/components/admin/StatusMessage";
import { adminFetch } from "@/lib/admin-fetch";
import { DEFAULT_ENTRY_WINDOW, MAX_ENTRY_WINDOW_MINUTES } from "@/lib/entry-window";
import { ModalShell } from "@/components/admin/ModalShell";
import { getAllowedPlaceholders, getEmailFieldMaxLength, getEmailFields, type EmailTemplateGroup, type EmailTemplateType } from "@/lib/email-templates";
import { toManilaInputValue } from "@/lib/maintenance";
import { ALL_SYSTEM_ALERT_AUDIENCES, SYSTEM_ALERT_AUDIENCES, SYSTEM_ALERT_HEADLINE_MAX, SYSTEM_ALERT_MESSAGE_MAX, parseSystemAlertAudience } from "@/lib/system-alert";

interface SystemSettings {
  system_name: string;
  support_email: string;
  support_phone: string;
  max_advance_days: string;
  min_notice_hours: string;
  booking_max_advance_enabled?: string;
  booking_min_notice_enabled?: string;
  entry_early_minutes?: string;
  entry_late_minutes?: string;
  require_account_approval?: string;
  alert_enabled: string;
  alert_start: string;
  alert_end: string;
  alert_headline: string;
  alert_message: string;
  alert_audience: string;
  notify_confirmation: string;
  notify_admin_alert: string;
  notify_approval: string;
  notify_decline: string;
  notify_qr_resend: string;
  notify_postponement: string;
  notify_invitation: string;
  [key: `email_${string}`]: string | undefined;
}

const Toggle = ({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) => (
  <button type="button" onClick={onToggle} role="switch" aria-checked={enabled} aria-label={label}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${enabled ? "bg-primary" : "bg-gray-300"}`}>
    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
  </button>
);

const EmailTextFields = ({ group, values, onChange }: { group: EmailTemplateGroup; values: SystemSettings; onChange: (key: `email_${string}`, value: string) => void }) => (
  <>
    {getEmailFields(group).map(({ key, def }) => {
      const inputId = `setting-${key}`;
      const placeholders = getAllowedPlaceholders(def).map((p) => `{${p}}`).join(", ");
      return (
        <div key={key}>
          <label htmlFor={inputId} className="block text-xs font-medium text-gray-600 mb-1">{def.label}</label>
          {def.multiline ? (
            <textarea id={inputId} rows={4} maxLength={getEmailFieldMaxLength(def)} value={values[key] ?? def.default} placeholder={def.default}
              onChange={(e) => onChange(key, e.target.value)} className="input resize-y" />
          ) : (
            <input id={inputId} type="text" maxLength={getEmailFieldMaxLength(def)} value={values[key] ?? def.default} placeholder={def.default}
              onChange={(e) => onChange(key, e.target.value)} className="input" />
          )}
          {(def.hint || placeholders) && (
            <p className="text-[11px] text-gray-400 mt-1">{[def.hint, placeholders && `You can use ${placeholders}.`].filter(Boolean).join(" ")}</p>
          )}
        </div>
      );
    })}
  </>
);

export default function SettingsPage() {
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "super_admin";
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useStatusMessage();
  const [loadFailed, setLoadFailed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingEmail, setEditingEmail] = useState<EmailTemplateGroup | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    try {
      const settingsRes = await adminFetch("/api/admin/settings", {});
      if (!settingsRes.ok) throw new Error("Failed to load settings");
      const data = await settingsRes.json();
      // The popup's times are stored as ISO but edited as Philippine Time.
      setSettings({
        ...data,
        alert_enabled: data.alert_enabled ?? "false",
        alert_start: toManilaInputValue(data.alert_start || null),
        alert_end: toManilaInputValue(data.alert_end || null),
        alert_headline: data.alert_headline ?? "",
        alert_message: data.alert_message ?? "",
        alert_audience: data.alert_audience ?? ALL_SYSTEM_ALERT_AUDIENCES,
      });
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

  const showEmailPreview = async (type: EmailTemplateType) => {
    setPreviewing(true); setMessage(null);
    try {
      const res = await adminFetch("/api/admin/settings/email-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, text: settings }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load the preview. Please try again.");
      setPreview({ subject: data.subject, html: data.html });
    } catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Could not load the preview. Please try again." }); }
    finally { setPreviewing(false); }
  };

  const resetEmailText = (group: EmailTemplateGroup) => {
    getEmailFields(group).forEach(({ key }) => updateSetting(key, ""));
  };

  const alertEnabled = settings.alert_enabled === "true";
  const alertAudience: string[] = parseSystemAlertAudience(settings.alert_audience);
  const allAudiencesSelected = alertAudience.length === SYSTEM_ALERT_AUDIENCES.length;
  const toggleAudience = (audience: string) => {
    const next = alertAudience.includes(audience) ? alertAudience.filter((a) => a !== audience) : [...alertAudience, audience];
    updateSetting("alert_audience", next.join(","));
  };

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

      {/* Gate Entry Window */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Gate Entry Window</h2>
          <p className="text-xs text-gray-400 mt-0.5">Control how early or late visitors can enter, relative to their scheduled time. Emails and tickets already sent keep the times they were sent with.</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "entry_early_minutes" as const, label: "Earliest Entry (minutes before)", fallback: DEFAULT_ENTRY_WINDOW.earlyMinutes,
                hint: "Scanning earlier than this shows \"Too Early\". 0 means entry opens at the scheduled time." },
              { key: "entry_late_minutes" as const, label: "Latest Entry (minutes after)", fallback: DEFAULT_ENTRY_WINDOW.lateMinutes,
                hint: "After this, the appointment expires and the visitor must reapply. 0 means no entry after the scheduled time." },
            ].map((limit) => (
              <div key={limit.key}>
                <label htmlFor={`setting-${limit.key}`} className="block text-xs font-medium text-gray-600 mb-1">{limit.label}</label>
                <input type="number" min={0} max={MAX_ENTRY_WINDOW_MINUTES} id={`setting-${limit.key}`}
                  value={settings?.[limit.key] ?? String(limit.fallback)}
                  onChange={(e) => updateSetting(limit.key, e.target.value)}
                  className="input" />
                <p className="text-[11px] text-gray-400 mt-1">{limit.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Account Registration */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Account Registration</h2>
          <p className="text-xs text-gray-400 mt-0.5">Control how self-registered office admin accounts are activated</p>
        </div>
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-gray-900">Require Manual Approval</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {settings?.require_account_approval !== "false"
                ? "A super admin must approve each new account before it can sign in"
                : "New accounts can sign in right away. Registration doesn't verify email ownership, so anyone who enters a valid USLS email gets admin access to the office they pick. Accounts already pending still need a decision."}
            </div>
          </div>
          <Toggle enabled={settings?.require_account_approval !== "false"} onToggle={() => toggleNotification("require_account_approval")} label="Require Manual Approval" />
        </div>
      </div>

      {/* System Update Popup */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">System Update Popup</h2>
            <p className="text-xs text-gray-400 mt-0.5">Announce updates in a popup during a set time. Each browser sees it once, and again only if you change the headline or message.</p>
          </div>
          <Toggle enabled={alertEnabled} onToggle={() => toggleNotification("alert_enabled")} label="Show the system update popup" />
        </div>
        {alertEnabled && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="setting-alert_start" className="block text-xs font-medium text-gray-600 mb-1">Starts (Philippine Time)</label>
                <input id="setting-alert_start" type="datetime-local" value={settings.alert_start}
                  onChange={(e) => updateSetting("alert_start", e.target.value)} className="input" />
              </div>
              <div>
                <label htmlFor="setting-alert_end" className="block text-xs font-medium text-gray-600 mb-1">Ends (Philippine Time)</label>
                <input id="setting-alert_end" type="datetime-local" value={settings.alert_end}
                  onChange={(e) => updateSetting("alert_end", e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label htmlFor="setting-alert_headline" className="block text-xs font-medium text-gray-600 mb-1">Headline</label>
              <input id="setting-alert_headline" type="text" maxLength={SYSTEM_ALERT_HEADLINE_MAX} value={settings.alert_headline}
                onChange={(e) => updateSetting("alert_headline", e.target.value)} className="input" />
              <p className="text-[11px] text-gray-400 mt-1">{settings.alert_headline.length}/{SYSTEM_ALERT_HEADLINE_MAX}</p>
            </div>
            <div>
              <label htmlFor="setting-alert_message" className="block text-xs font-medium text-gray-600 mb-1">Message</label>
              <textarea id="setting-alert_message" rows={5} maxLength={SYSTEM_ALERT_MESSAGE_MAX} value={settings.alert_message}
                onChange={(e) => updateSetting("alert_message", e.target.value)} className="input resize-y" />
              <p className="text-[11px] text-gray-400 mt-1">{settings.alert_message.length}/{SYSTEM_ALERT_MESSAGE_MAX} &mdash; line breaks are preserved in the popup</p>
            </div>
            <fieldset>
              <legend className="block text-xs font-medium text-gray-600 mb-2">Show On</legend>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <input type="checkbox" checked={allAudiencesSelected}
                    onChange={() => updateSetting("alert_audience", allAudiencesSelected ? "" : ALL_SYSTEM_ALERT_AUDIENCES)} />
                  All Pages
                </label>
                {SYSTEM_ALERT_AUDIENCES.map((audience) => (
                  <label key={audience.value} className="flex items-start gap-2 pl-5">
                    <input type="checkbox" className="mt-0.5" checked={alertAudience.includes(audience.value)} onChange={() => toggleAudience(audience.value)} />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">{audience.label}</span>
                      <span className="block text-xs text-gray-400">{audience.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </div>

      {/* Notification Toggles */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Email Notifications</h2>
          <p className="text-xs text-gray-400 mt-0.5">Toggle which emails are sent automatically and edit their text</p>
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
          ].map((item) => {
            const type = item.key.replace("notify_", "") as EmailTemplateType;
            const editing = editingEmail === type;
            return (
              <div key={item.key} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
                    <button type="button" onClick={() => setEditingEmail(editing ? null : type)} aria-expanded={editing}
                      className="text-xs font-medium text-primary hover:underline mt-1">
                      {editing ? "Hide email text" : "Edit email text"}
                    </button>
                  </div>
                  <Toggle enabled={settings?.[item.key] !== "false"} onToggle={() => toggleNotification(item.key)} label={item.label} />
                </div>
                {editing && (
                  <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-4">
                    <EmailTextFields group={type} values={settings} onChange={updateSetting} />
                    <p className="text-[11px] text-gray-400">
                      A blank field uses the default text. Wrap words in **double asterisks** to make them bold, except in the subject. The reference number, QR code, appointment values, and buttons can&apos;t be edited.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => showEmailPreview(type)} disabled={previewing} className="btn-secondary btn-sm text-xs disabled:opacity-50">
                        {previewing ? "Loading..." : "Preview email"}
                      </button>
                      <button type="button" onClick={() => resetEmailText(type)} className="btn-ghost btn-sm text-xs">
                        Reset to default
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="px-5 py-3.5">
            <div className="text-sm font-medium text-gray-900">Shared Labels</div>
            <div className="text-xs text-gray-400 mt-0.5">Table labels used across all of these emails</div>
            <button type="button" onClick={() => setEditingEmail(editingEmail === "shared" ? null : "shared")} aria-expanded={editingEmail === "shared"}
              className="text-xs font-medium text-primary hover:underline mt-1">
              {editingEmail === "shared" ? "Hide labels" : "Edit labels"}
            </button>
            {editingEmail === "shared" && (
              <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-4">
                <EmailTextFields group="shared" values={settings} onChange={updateSetting} />
                <button type="button" onClick={() => resetEmailText("shared")} className="btn-ghost btn-sm text-xs">
                  Reset to default
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ModalShell open={preview !== null} title="Email Preview" subtitle={preview ? `Subject: ${preview.subject}` : undefined} maxWidthClass="max-w-2xl" onClose={() => setPreview(null)}>
        <p className="text-xs text-gray-500 mb-3">Sample details, using the text on this page. Nothing was saved or sent. Invitation emails also attach the PDF ticket.</p>
        {preview && <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="w-full h-[60vh] rounded-lg border border-gray-200" />}
      </ModalShell>

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
