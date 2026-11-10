"use client";

import { useState, useEffect, useCallback } from "react";
import { ModalShell } from "@/components/admin/ModalShell";
import { StatusMessage, useStatusMessage } from "@/components/admin/StatusMessage";
import { adminFetch } from "@/lib/admin-fetch";

interface GuardAccount { id: string; name: string; employee_id: string | null; created_at?: string }

const emptyForm = { name: "", employee_id: "", password: "" };

/** Guard admins' list of guard logins, with a form that only creates guard (gate user) accounts. */
export function GuardAccounts() {
  const [guards, setGuards] = useState<GuardAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useStatusMessage();

  const fetchGuards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/guard-admin/accounts");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGuards(Array.isArray(data) ? data : []);
      setLoadError(false);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchGuards(); }, [fetchGuards]);

  const openCreate = () => { setForm(emptyForm); setFormError(null); setShowPassword(false); setFormOpen(true); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); setMessage(null);
    setSaving(true);
    try {
      const res = await adminFetch("/api/guard-admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not create the guard account.");
      setMessage({ type: "success", text: `Guard account created for ${form.name.trim()}. They sign in at the Gate Entry page with username ${form.employee_id.trim().toUpperCase()}.` });
      setFormOpen(false);
      fetchGuards();
    } catch (err) { setFormError(err instanceof Error ? err.message : "Could not create the guard account."); }
    finally { setSaving(false); }
  };

  // Password reset for one guard: their new password, typed twice, plus the guard admin's own password.
  const [resetting, setResetting] = useState<GuardAccount | null>(null);
  const [reset, setReset] = useState({ newPassword: "", confirm: "", own: "" });
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const openReset = (g: GuardAccount) => { setResetting(g); setReset({ newPassword: "", confirm: "", own: "" }); setResetError(null); };
  const closeReset = () => { if (!resetSaving) setResetting(null); };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetting) return;
    setResetError(null);
    if (reset.newPassword.length < 8) { setResetError("New password must be at least 8 characters."); return; }
    if (reset.newPassword !== reset.confirm) { setResetError("The new passwords don't match."); return; }
    if (!reset.own) { setResetError("Enter your own password to confirm."); return; }
    setResetSaving(true);
    try {
      const res = await adminFetch("/api/guard-admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resetting.id, new_password: reset.newPassword, password: reset.own }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not reset the password.");
      setMessage({ type: "success", text: `Password reset for ${resetting.name}. Give them the new password; they sign in with username ${resetting.employee_id || "—"}.` });
      setResetting(null);
    } catch (err) { setResetError(err instanceof Error ? err.message : "Could not reset the password."); }
    finally { setResetSaving(false); }
  };

  const q = query.trim().toLowerCase();
  const shown = q ? guards.filter((g) => g.name.toLowerCase().includes(q) || (g.employee_id || "").toLowerCase().includes(q)) : guards;

  return (
    <section className="bg-white rounded-xl border border-gray-200" aria-labelledby="guard-accounts-heading">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div>
          <h2 id="guard-accounts-heading" className="text-base font-semibold text-gray-900">Guard Accounts</h2>
          <p className="text-xs text-gray-500 mt-0.5">{guards.length} guard login{guards.length !== 1 ? "s" : ""}. You can create guard accounts only.</p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary btn-sm flex items-center justify-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Guard
        </button>
      </div>

      <div className="p-5 space-y-3">
        {message && <StatusMessage message={message} onDismiss={() => setMessage(null)} />}
        {guards.length > 5 && (
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="input" placeholder="Search by name or username..." aria-label="Search guard accounts" />
        )}
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
        ) : loadError ? (
          <StatusMessage message={{ type: "error", text: "Could not load guard accounts." }} onRetry={fetchGuards} />
        ) : shown.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">{q ? "No guards match your search." : "No guard accounts yet."}</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
            {shown.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-green-700">{(g.name || "?")[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{g.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{g.employee_id || "—"}</div>
                </div>
                <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 flex-shrink-0">Guard</span>
                <button type="button" onClick={() => openReset(g)} aria-label={`Reset password for ${g.name}`}
                  className="whitespace-nowrap text-xs font-medium text-primary px-2.5 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors flex-shrink-0">
                  Reset Password
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-gray-400">To remove a guard, ask a super admin.</p>
      </div>

      <ModalShell open={formOpen} title="Add Guard" subtitle="Creates a guard login for the Gate Entry page" onClose={() => setFormOpen(false)} maxWidthClass="max-w-md"
        footer={
          <>
            <button type="submit" form="guard-account-form" disabled={saving} className="btn-primary flex-1 btn-sm disabled:opacity-50">
              {saving ? "Creating..." : "Create Guard Account"}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary btn-sm">Cancel</button>
          </>
        }>
        <form id="guard-account-form" onSubmit={handleCreate} className="space-y-4">
          {formError && <StatusMessage message={{ type: "error", text: formError }} />}
          <div>
            <label htmlFor="guard-name" className="label">Name</label>
            <input id="guard-name" required maxLength={100} className="input" placeholder="Full name" value={form.name} autoFocus
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="guard-employee-id" className="label">Username</label>
            <input id="guard-employee-id" required minLength={3} maxLength={30} pattern="[A-Za-z0-9\-]{3,30}" className="input font-mono uppercase" placeholder="e.g. SEC-0142"
              value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value.toUpperCase() })} />
            <p className="text-[11px] text-gray-400 mt-1">The guard signs in with this. Letters, numbers, and dashes.</p>
          </div>
          <div>
            <label htmlFor="guard-password" className="label">Password</label>
            <div className="relative">
              <input id="guard-password" type={showPassword ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password" className="input pr-16"
                placeholder="Minimum 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-700">
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </form>
      </ModalShell>

      <ModalShell open={Boolean(resetting)} title="Reset Password" subtitle={resetting ? `${resetting.name} · ${resetting.employee_id || "—"}` : undefined} onClose={closeReset} maxWidthClass="max-w-md"
        footer={
          <>
            <button type="submit" form="guard-reset-form" disabled={resetSaving} className="btn-primary flex-1 btn-sm disabled:opacity-50">
              {resetSaving ? "Resetting..." : "Reset Password"}
            </button>
            <button type="button" onClick={closeReset} disabled={resetSaving} className="btn-secondary btn-sm">Cancel</button>
          </>
        }>
        <form id="guard-reset-form" onSubmit={handleReset} className="space-y-4">
          <p className="text-sm text-gray-600">Set a new password for <strong>{resetting?.name}</strong>. Their old password stops working right away.</p>
          {resetError && <StatusMessage message={{ type: "error", text: resetError }} />}
          <div>
            <label htmlFor="guard-reset-new" className="label">New Password</label>
            <input id="guard-reset-new" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="input" placeholder="Minimum 8 characters"
              value={reset.newPassword} autoFocus onChange={(e) => { setReset({ ...reset, newPassword: e.target.value }); setResetError(null); }} />
          </div>
          <div>
            <label htmlFor="guard-reset-confirm" className="label">Confirm New Password</label>
            <input id="guard-reset-confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="input" placeholder="Re-enter the new password"
              value={reset.confirm} onChange={(e) => { setReset({ ...reset, confirm: e.target.value }); setResetError(null); }} />
          </div>
          <div>
            <label htmlFor="guard-reset-own" className="label">Your Password</label>
            <input id="guard-reset-own" type="password" required autoComplete="current-password" className="input" placeholder="Enter your own password to confirm"
              value={reset.own} onChange={(e) => { setReset({ ...reset, own: e.target.value }); setResetError(null); }} />
          </div>
        </form>
      </ModalShell>
    </section>
  );
}
