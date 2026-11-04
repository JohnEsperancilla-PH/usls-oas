"use client";

import { useState, useEffect, useCallback } from "react";
import { ModalShell } from "@/components/admin/ModalShell";
import { OfficeContactsPanel } from "@/components/admin/OfficeContactsModal";
import { adminFetch } from "@/lib/admin-fetch";

interface OfficeAccount { id: string; email: string; name: string; role: string; office_id: string | null; approval_status?: "pending" | "approved"; created_at?: string; }

const emptyForm = { name: "", email: "", password: "" };

export function OfficeAccountsPanel({ officeId, officeName }: { officeId: string; officeName: string }) {
  const [accounts, setAccounts] = useState<OfficeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/accounts");
      if (!res.ok) throw new Error("Failed to load accounts");
      const data = await res.json();
      setAccounts((Array.isArray(data) ? data : []).filter((a: OfficeAccount) => a.office_id === officeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [officeId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const openCreate = () => { setForm(emptyForm); setFormError(null); setShowPassword(false); setFormOpen(true); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role: "office_admin", office_id: officeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not create the account. Please try again.");
      setSuccess(`Account created for ${form.name}`);
      setFormOpen(false);
      fetchAccounts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the account. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-900">{accounts.length} Account{accounts.length !== 1 ? "s" : ""}</h4>
        <button onClick={openCreate} className="btn-primary btn-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Account
        </button>
      </div>

      {error && <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
      {success && <div role="status" className="p-3 rounded-lg text-sm bg-green-50 border border-green-200 text-green-700">{success}</div>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-gray-200 rounded-xl">
          <p className="text-sm text-gray-500 font-medium mb-1">No accounts yet</p>
          <p className="text-xs text-gray-400">No office admins are registered under this office. Office admins sign in to manage its appointments.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
              <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{(a.name || a.email || "?")[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{a.name || "—"}</div>
                <div className="text-xs text-gray-400 truncate">{a.email}</div>
              </div>
              {a.approval_status === "pending" && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">Pending approval</span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-400">To edit, reset passwords, approve, or remove accounts, go to the Accounts page.</p>

      <ModalShell open={formOpen} title="Add Office Admin" subtitle={officeName} onClose={() => setFormOpen(false)} maxWidthClass="max-w-xl"
        footer={
          <>
            <button type="submit" form="office-account-form" disabled={saving} className="btn-primary flex-1 btn-sm disabled:opacity-50">
              {saving ? "Creating..." : "Create Account"}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary btn-sm">Cancel</button>
          </>
        }>
        <form id="office-account-form" onSubmit={handleCreate} className="space-y-4">
          {formError && <div role="alert" className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">{formError}</div>}
          <div>
            <label htmlFor="office-account-name" className="label">Name</label>
            <input id="office-account-name" required maxLength={100} className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div>
            <label htmlFor="office-account-email" className="label">Email</label>
            <input id="office-account-email" type="email" required maxLength={254} className="input" placeholder="name@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label htmlFor="office-account-password" className="label">Password</label>
            <div className="relative">
              <input id="office-account-password" type={showPassword ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password" className="input pr-10" placeholder="Minimum 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors">
                {showPassword ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400">The account is created as an Office Admin for {officeName}.</p>
        </form>
      </ModalShell>
    </div>
  );
}

export function OfficePeopleModal({ open, officeId, officeName, onClose }: { open: boolean; officeId: string; officeName: string; onClose: () => void }) {
  const [tab, setTab] = useState<"accounts" | "contacts">("accounts");

  return (
    <ModalShell open={open} title="Office People" subtitle={officeName} onClose={onClose} maxWidthClass="max-w-xl"
      footer={<button type="button" onClick={onClose} className="btn-secondary w-full btn-sm">Close</button>}>
      <div className="space-y-4">
        <div className="flex items-center gap-1 border-b border-gray-200" role="tablist" aria-label="Office people">
          {([["accounts", "Accounts"], ["contacts", "Contacts"]] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 -mb-px text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
              {label}
            </button>
          ))}
        </div>
        {open && officeId && (tab === "accounts"
          ? <OfficeAccountsPanel key={officeId} officeId={officeId} officeName={officeName} />
          : <OfficeContactsPanel key={officeId} officeId={officeId} />)}
      </div>
    </ModalShell>
  );
}
