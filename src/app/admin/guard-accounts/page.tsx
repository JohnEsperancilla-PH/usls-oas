"use client";

import { useAdmin } from "@/app/admin/layout";
import { GuardAccounts } from "@/components/admin/GuardAccounts";

export default function GuardAccountsPage() {
  const { admin } = useAdmin();

  if (admin.role !== "gate_admin" && admin.role !== "super_admin") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-500">Only guard admins can manage guard accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Guard Accounts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Guard logins for the Gate Entry page.</p>
      </div>
      <GuardAccounts />
    </div>
  );
}
