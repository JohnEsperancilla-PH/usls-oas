"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/app/admin/layout";
import type { AdminRole, Office } from "@/types/database";
import { ModalShell } from "@/components/admin/ModalShell";
import { StatusMessage, useStatusMessage } from "@/components/admin/StatusMessage";
import { adminFetch } from "@/lib/admin-fetch";

interface AdminAccount { id: string; email: string; employee_id: string | null; name: string; role: string; office_id: string | null; approval_status?: "pending" | "approved"; created_at?: string; }

export default function AccountsPage() {
  const { admin } = useAdmin();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useStatusMessage();
  const [form, setForm] = useState({ email: "", employee_id: "", name: "", password: "", role: "office_admin" as "super_admin" | "office_admin" | "gate_user", office_id: "" });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AdminRole>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [tab, setTab] = useState<"accounts" | "pending">("accounts");
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, offRes] = await Promise.all([
        fetch("/api/admin/accounts", {}),
        fetch("/api/admin/offices", {}),
      ]);
      if (!accRes.ok) throw new Error("Failed to load accounts");
      const accData = await accRes.json();
      const offData = offRes.ok ? await offRes.json() : [];
      setAccounts(Array.isArray(accData) ? accData : []);
      setOffices(Array.isArray(offData) ? offData : []);
      setLoadError(false);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [admin]);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage(null); setFormError(null);
    if (form.role === "office_admin" && !form.office_id) { setFormError("Select the office this admin will manage."); return; }
    setSaving(true);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      if (!csrfRes.ok) throw new Error("Unable to obtain security token");
      const { csrfToken } = await csrfRes.json();

      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not create the account. Please try again.");
      setMessage({ type: "success", text: `Account created for ${form.name}` });
      setModalOpen(false);
      setForm({ email: "", employee_id: "", name: "", password: "", role: "office_admin", office_id: "" });
      fetchData();
    } catch (err) { setFormError(err instanceof Error ? err.message : "Could not create the account. Please try again."); }
    finally { setSaving(false); }
  };

  const openCreate = () => {
    setForm({ email: "", employee_id: "", name: "", password: "", role: "office_admin", office_id: "" });
    setFormError(null);
    setShowPassword(false);
    setModalOpen(true);
  };

  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "office_admin" as AdminRole, office_id: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = (account: AdminAccount) => {
    setEditingAccount(account);
    setEditForm({ name: account.name || "", role: account.role as AdminRole, office_id: account.office_id || "" });
    setEditError(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditError(null);
    if (!editForm.name.trim()) { setEditError("Enter a name."); return; }
    if (editForm.role === "office_admin" && !editForm.office_id) { setEditError("Select the office this admin will manage."); return; }
    setEditSaving(true);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      if (!csrfRes.ok) throw new Error("Unable to obtain security token");
      const { csrfToken } = await csrfRes.json();

      const res = await fetch("/api/admin/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ id: editingAccount.id, ...editForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not update the account. Please try again.");
      setMessage({ type: "success", text: `${editForm.name.trim()} updated` });
      setEditingAccount(null);
      fetchData();
    } catch (err) { setEditError(err instanceof Error ? err.message : "Could not update the account. Please try again."); }
    finally { setEditSaving(false); }
  };

  const [deletingAccount, setDeletingAccount] = useState<AdminAccount | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deletingAccount || !deletePassword) return;
    setDeleteLoading(true); setDeleteError(null);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      if (!csrfRes.ok) throw new Error("Unable to obtain security token");
      const { csrfToken } = await csrfRes.json();

      const res = await fetch("/api/admin/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ id: deletingAccount.id, password: deletePassword }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      setMessage({ type: "success", text: "Account removed" });
      setDeletingAccount(null); setDeletePassword("");
      fetchData();
    } catch (err) { setDeleteError(err instanceof Error ? err.message : "Failed"); }
    finally { setDeleteLoading(false); }
  };

  const [resettingAccount, setResettingAccount] = useState<AdminAccount | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetSuperPassword, setResetSuperPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const closeResetModal = () => {
    setResettingAccount(null);
    setResetNewPassword("");
    setResetConfirmPassword("");
    setResetSuperPassword("");
    setResetError(null);
  };

  const handleResetPassword = async () => {
    if (!resettingAccount || !resetNewPassword || !resetConfirmPassword || !resetSuperPassword) return;

    setResetError(null);

    if (resetNewPassword.length < 8) {
      setResetError("New password must be at least 8 characters");
      return;
    }
    if (resetNewPassword.length > 128) {
      setResetError("New password is too long (max 128 characters)");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("New passwords do not match");
      return;
    }

    setResetLoading(true);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      if (!csrfRes.ok) throw new Error("Unable to obtain security token");
      const { csrfToken } = await csrfRes.json();

      const res = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          id: resettingAccount.id,
          new_password: resetNewPassword,
          password: resetSuperPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reset password");

      setMessage({
        type: "success",
        text: `Password reset for ${resettingAccount.name || resettingAccount.email}`,
      });
      closeResetModal();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  // Self-registered office admins wait here until a super admin approves or rejects them.
  const pendingAccounts = accounts.filter((account) => account.approval_status === "pending");
  const activeAccounts = accounts.filter((account) => account.approval_status !== "pending");

  const handleApproval = async (account: AdminAccount, decision: "approve" | "reject") => {
    setApprovalBusyId(account.id);
    setMessage(null);
    try {
      const res = await adminFetch("/api/admin/accounts/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id, decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Could not ${decision} the account. Please try again.`);
      setMessage({
        type: "success",
        text: decision === "approve"
          ? `${account.name || account.email} approved. They've been emailed that they can sign in.`
          : `${account.name || account.email} rejected and removed.`,
      });
      setRejectingId(null);
      fetchData();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : `Could not ${decision} the account.` });
    } finally {
      setApprovalBusyId(null);
    }
  };

  const filteredAccounts = activeAccounts.filter((account) => {
    if (roleFilter !== "all" && account.role !== roleFilter) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const officeName = offices.find((office) => office.id === account.office_id)?.name || "";
    return [account.name, account.email, account.employee_id || "", account.role, account.role.replace(/_/g, " "), officeName]
      .some((value) => value.toLowerCase().includes(query));
  });

  const hasActiveFilters = search.trim() !== "" || roleFilter !== "all";
  const displayedCount = filteredAccounts.length;

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
  };

  const getRoleBadge = (role: string) => role === "super_admin"
    ? "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200"
    : role === "gate_user"
    ? "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200"
    : "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200";

  const getRoleLabel = (role: string) => role === "super_admin"
    ? "Super Admin"
    : role === "gate_user"
    ? "Gate User"
    : "Office Admin";

  const openResetPassword = (account: AdminAccount) => {
    setResettingAccount(account);
    setResetNewPassword("");
    setResetConfirmPassword("");
    setResetSuperPassword("");
    setResetError(null);
  };

  const openDeleteAccount = (account: AdminAccount) => {
    setDeletingAccount(account);
    setDeletePassword("");
    setDeleteError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {displayedCount} admin account{displayedCount !== 1 ? "s" : ""}
            {hasActiveFilters ? ` of ${activeAccounts.length}` : ""}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary btn-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Account
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200" role="tablist" aria-label="Account lists">
        {([
          { key: "accounts" as const, label: "Accounts", count: activeAccounts.length },
          { key: "pending" as const, label: "Pending approval", count: pendingAccounts.length },
        ]).map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 -mb-px text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t.label}
            {!loading && (
              <span className={`px-1.5 rounded-full text-xs ${t.key === "pending" && t.count > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "accounts" && pendingAccounts.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 flex flex-wrap items-center gap-2">
          <span className="flex-1">
            {pendingAccounts.length} office admin account{pendingAccounts.length !== 1 ? "s are" : " is"} waiting for your approval.
          </span>
          <button type="button" onClick={() => setTab("pending")} className="text-xs font-semibold underline underline-offset-2 hover:no-underline">Review</button>
        </div>
      )}

      {tab === "accounts" && (
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 lg:max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input" style={{ paddingLeft: "2.25rem" }}
            placeholder="Search by name, email, office, or role..."
            aria-label="Search admin accounts"
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label htmlFor="role-filter" className="sr-only">Filter by account type</label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | AdminRole)}
            className="input w-full sm:w-52"
          >
            <option value="all">All account types</option>
            <option value="super_admin">Super Admin</option>
            <option value="office_admin">Office Admin</option>
            <option value="gate_user">Gate User</option>
          </select>
          <div className="flex items-center self-start sm:self-auto rounded-lg border border-gray-200 bg-white p-1" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-gray-400 hover:text-gray-600"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-gray-400 hover:text-gray-600"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      )}

      {message && <StatusMessage message={message} onDismiss={() => setMessage(null)} />}

      {tab === "pending" && !loading && !loadError ? (
        pendingAccounts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-sm text-gray-500">No accounts are waiting for approval.</p>
            <p className="text-xs text-gray-400 mt-1">Office admins who register themselves appear here until you approve or reject them.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingAccounts.map((a) => {
              const officeName = offices.find((o) => o.id === a.office_id)?.name || "Unknown office";
              const busy = approvalBusyId === a.id;
              return (
                <div key={a.id} className="bg-white rounded-xl border border-amber-200 p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-amber-700">{(a.name || a.email || "?")[0].toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{a.name || "—"}</div>
                      <div className="text-xs text-gray-500 truncate">{a.email}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Office admin for <span className="font-medium text-gray-700">{officeName}</span>
                        {a.created_at && <> · registered {new Date(a.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>}
                      </div>
                    </div>
                  </div>
                  {rejectingId === a.id ? (
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirm rejecting ${a.name || a.email}`}>
                      <span className="text-xs text-gray-600">Reject and delete this account?</span>
                      <button type="button" onClick={() => handleApproval(a, "reject")} disabled={busy} className="btn-danger btn-sm disabled:opacity-50">
                        {busy ? "Rejecting..." : "Yes, reject"}
                      </button>
                      <button type="button" onClick={() => setRejectingId(null)} disabled={busy} className="btn-ghost btn-sm">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => handleApproval(a, "approve")} disabled={busy || approvalBusyId !== null} className="btn-primary btn-sm disabled:opacity-50">
                        {busy ? "Approving..." : "Approve"}
                      </button>
                      <button type="button" onClick={() => setRejectingId(a.id)} disabled={approvalBusyId !== null}
                        className="text-sm font-medium text-red-600 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-gray-400">Only approve people you know work in the office they chose. Approved admins can see that office&apos;s visitor details and approve appointments.</p>
          </div>
        )
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-xl border border-gray-200 p-5"><div className="skeleton h-5 w-32 mb-3" /><div className="skeleton h-3 w-48 mb-2" /><div className="skeleton h-3 w-24" /></div>)}
        </div>
      ) : loadError ? (
        <StatusMessage message={{ type: "error", text: "Could not load accounts. Check your connection and try again." }} onRetry={fetchData} />
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 7.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <p className="text-sm text-gray-500 mb-3">No admin accounts yet</p>
          <button onClick={openCreate} className="text-sm font-medium text-primary hover:text-primary-light">Create first account</button>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            {search.trim()
              ? `No accounts match “${search}”${roleFilter !== "all" ? " for the selected account type" : ""}`
              : "No accounts match the selected account type"}
          </p>
          <button onClick={clearFilters} className="text-sm font-medium text-primary hover:text-primary-light">Clear filters</button>
        </div>
      ) : viewMode === "list" ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Office / Employee ID</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAccounts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">{(a.name || a.email || "?")[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{a.name || "—"}</div>
                          <div className="text-xs text-gray-400 truncate">{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={getRoleBadge(a.role)}>{getRoleLabel(a.role)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {a.role === "gate_user"
                        ? a.employee_id || "—"
                        : a.office_id
                        ? offices.find((o) => o.id === a.office_id)?.name || "—"
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" aria-label={`Edit ${a.name || a.email}`} onClick={() => openEdit(a)} className="whitespace-nowrap text-xs font-medium text-gray-600 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                          Edit
                        </button>
                        <button type="button" aria-label={`Reset password for ${a.name || a.email}`} onClick={() => openResetPassword(a)} className="whitespace-nowrap text-xs font-medium text-primary px-2.5 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
                          Reset Password
                        </button>
                        <button type="button" aria-label={`Remove ${a.name || a.email}`} onClick={() => openDeleteAccount(a)} className="whitespace-nowrap text-xs font-medium text-red-500 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{(a.name || a.email || "?")[0].toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{a.name || "—"}</div>
                    <div className="text-xs text-gray-400 truncate">{a.email}</div>
                    {a.role === "gate_user" && <div className="text-xs text-gray-500">Employee ID: {a.employee_id}</div>}
                  </div>
                </div>
                  <span className={`${getRoleBadge(a.role)} whitespace-nowrap flex-shrink-0`}>{getRoleLabel(a.role)}</span>
              </div>
              {a.office_id && (
                <div className="text-xs text-gray-500 mb-3">
                  <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
                  {offices.find((o) => o.id === a.office_id)?.name || "—"}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" aria-label={`Edit ${a.name || a.email}`} onClick={() => openEdit(a)} className="flex-1 text-center text-xs font-medium text-gray-600 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  Edit
                </button>
                <button type="button" aria-label={`Reset password for ${a.name || a.email}`} onClick={() => openResetPassword(a)} className="flex-1 text-center text-xs font-medium text-primary py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
                  Reset Password
                </button>
                <button type="button" aria-label={`Remove ${a.name || a.email}`} onClick={() => openDeleteAccount(a)} className="flex-1 text-center text-xs font-medium text-red-500 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ModalShell open={true} title="Add Admin Account" subtitle="Create a new admin, office admin, or gate user" onClose={() => setModalOpen(false)} maxWidthClass="max-w-xl"
          footer={
            <>
              <button type="submit" form="account-form" disabled={saving} className="btn-primary flex-1 btn-sm disabled:opacity-50">
                {saving ? "Creating..." : "Create Account"}
              </button>
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary btn-sm">Cancel</button>
            </>
          }>
          <form id="account-form" onSubmit={handleCreate} className="space-y-4">
            {formError && <StatusMessage message={{ type: "error", text: formError }} />}
            <div>
              <span id="account-role-label" className="label">Role</span>
              <div className="flex gap-2" role="group" aria-labelledby="account-role-label">
                {[{ v: "office_admin", l: "Office Admin" }, { v: "super_admin", l: "Super Admin" }, { v: "gate_user", l: "Gate User" }].map((r) => (
                  <button key={r.v} type="button" aria-pressed={form.role === r.v} onClick={() => setForm({ ...form, role: r.v as "super_admin" | "office_admin" | "gate_user", email: "" })}
                    className={`flex-1 text-center py-2 rounded-lg text-sm font-medium border-2 transition-all ${form.role === r.v ? "border-primary bg-primary/5 text-primary" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}>
                    {r.l}
                  </button>
                ))}
              </div>
            </div>
            {form.role === "gate_user" ? (
              <div>
                <label htmlFor="account-employee-id" className="label">Employee ID</label>
                <input id="account-employee-id" required className="input" placeholder="Employee ID number" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
              </div>
            ) : (
              <div>
                <label htmlFor="account-email" className="label">Email</label>
                <input id="account-email" type="email" required className="input" placeholder="name@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            )}
            <div>
              <label htmlFor="account-name" className="label">Name</label>
              <input id="account-name" required className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="account-password" className="label">Password</label>
              <div className="relative">
                <input id="account-password" type={showPassword ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password" className="input pr-10" placeholder="Minimum 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                </button>
              </div>
            </div>
            {form.role === "office_admin" && (
              <div>
                <label htmlFor="account-office" className="label">Assign Office</label>
                <select id="account-office" required className="input" value={form.office_id} onChange={(e) => setForm({ ...form, office_id: e.target.value })}>
                  <option value="">Select an office</option>
                  {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}
          </form>
        </ModalShell>
      )}

      {/* Edit account modal */}
      <ModalShell open={Boolean(editingAccount)} title="Edit Account" subtitle={editingAccount?.email} onClose={() => setEditingAccount(null)} maxWidthClass="max-w-xl"
        footer={
          <>
            <button type="submit" form="edit-account-form" disabled={editSaving} className="btn-primary flex-1 btn-sm disabled:opacity-50">
              {editSaving ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={() => setEditingAccount(null)} className="btn-secondary btn-sm">Cancel</button>
          </>
        }>
        <form id="edit-account-form" onSubmit={handleEdit} className="space-y-4">
          {editError && <StatusMessage message={{ type: "error", text: editError }} />}
          {editingAccount?.role === "gate_user" ? (
            <p className="text-xs text-gray-500">Gate accounts keep the Gate User role. Employee ID: <span className="font-medium text-gray-700">{editingAccount.employee_id || "—"}</span></p>
          ) : (
            <div>
              <span id="edit-role-label" className="label">Role</span>
              <div className="flex gap-2" role="group" aria-labelledby="edit-role-label">
                {([{ v: "office_admin", l: "Office Admin" }, { v: "super_admin", l: "Super Admin" }] as const).map((r) => (
                  <button key={r.v} type="button" aria-pressed={editForm.role === r.v}
                    disabled={editingAccount?.id === admin.id}
                    onClick={() => setEditForm({ ...editForm, role: r.v })}
                    className={`flex-1 text-center py-2 rounded-lg text-sm font-medium border-2 transition-all disabled:cursor-not-allowed disabled:opacity-60 ${editForm.role === r.v ? "border-primary bg-primary/5 text-primary" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}>
                    {r.l}
                  </button>
                ))}
              </div>
              {editingAccount?.id === admin.id && <p className="text-[11px] text-gray-400 mt-1">You can&apos;t change your own role.</p>}
            </div>
          )}
          <div>
            <label htmlFor="edit-name" className="label">Name</label>
            <input id="edit-name" required maxLength={100} className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          {editForm.role === "office_admin" && (
            <div>
              <label htmlFor="edit-office" className="label">Assigned Office</label>
              <select id="edit-office" required className="input" value={editForm.office_id} onChange={(e) => setEditForm({ ...editForm, office_id: e.target.value })}>
                <option value="">Select an office</option>
                {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
        </form>
      </ModalShell>

      {/* Reset password modal */}
      <ModalShell open={Boolean(resettingAccount)} title="Reset Password" subtitle={resettingAccount ? resettingAccount.name || resettingAccount.email : undefined} onClose={closeResetModal} maxWidthClass="max-w-md"
        footer={
          <>
            <button onClick={handleResetPassword} disabled={resetLoading || !resetNewPassword || !resetConfirmPassword || !resetSuperPassword} className="btn-primary flex-1 btn-sm disabled:opacity-50">
              {resetLoading ? "Resetting..." : "Reset Password"}
            </button>
            <button onClick={closeResetModal} className="btn-secondary btn-sm">Cancel</button>
          </>
        }>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Set a new password for <strong>{resettingAccount?.name || resettingAccount?.email}</strong>. Enter your own password to confirm.
          </p>
          <div>
            <label htmlFor="reset-new-password" className="label">New Password</label>
            <input id="reset-new-password" type="password" autoComplete="new-password" className="input" placeholder="Minimum 8 characters" value={resetNewPassword} onChange={(e) => { setResetNewPassword(e.target.value); setResetError(null); }} autoFocus />
          </div>
          <div>
            <label htmlFor="reset-confirm-password" className="label">Confirm New Password</label>
            <input id="reset-confirm-password" type="password" autoComplete="new-password" className="input" placeholder="Re-enter new password" value={resetConfirmPassword} onChange={(e) => { setResetConfirmPassword(e.target.value); setResetError(null); }} onKeyDown={(e) => { if (e.key === "Enter") handleResetPassword(); }} />
          </div>
          <div>
            <label htmlFor="reset-own-password" className="label">Your Password</label>
            <input id="reset-own-password" type="password" autoComplete="current-password" className="input" placeholder="Enter your password" value={resetSuperPassword} onChange={(e) => { setResetSuperPassword(e.target.value); setResetError(null); }} onKeyDown={(e) => { if (e.key === "Enter") handleResetPassword(); }} />
          </div>
          {resetError && <p className="text-xs text-red-600" role="alert">{resetError}</p>}
        </div>
      </ModalShell>

      {/* Delete confirmation modal */}
      <ModalShell open={Boolean(deletingAccount)} title="Remove Account" subtitle={deletingAccount ? deletingAccount.name || deletingAccount.email : undefined} onClose={() => { setDeletingAccount(null); setDeletePassword(""); setDeleteError(null); }} maxWidthClass="max-w-md"
        footer={
          <>
            <button onClick={handleDelete} disabled={deleteLoading || !deletePassword} className="btn-danger flex-1 btn-sm disabled:opacity-50">
              {deleteLoading ? "Removing..." : "Confirm Remove"}
            </button>
            <button onClick={() => { setDeletingAccount(null); setDeletePassword(""); setDeleteError(null); }} className="btn-secondary btn-sm">Cancel</button>
          </>
        }>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            You are about to remove <strong>{deletingAccount?.name || deletingAccount?.email}</strong>. Enter your password to confirm.
          </p>
          <div>
            <label htmlFor="delete-own-password" className="label">Your Password</label>
            <input id="delete-own-password" type="password" autoComplete="current-password" className="input" placeholder="Enter your password" value={deletePassword} onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(null); }} autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); }} />
          </div>
          {deleteError && <p className="text-xs text-red-600" role="alert">{deleteError}</p>}
        </div>
      </ModalShell>
    </div>
  );
}
