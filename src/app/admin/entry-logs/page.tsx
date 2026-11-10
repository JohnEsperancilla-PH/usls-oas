"use client";

import { useAdmin } from "@/app/admin/layout";
import { EntryLogs } from "@/components/admin/EntryLogs";

export default function EntryLogsPage() {
  const { admin } = useAdmin();

  if (admin.role !== "gate_admin" && admin.role !== "super_admin") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-500">Only guard admins and super admins can view the entry log.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Entry Logs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Every check-in, checkout, denial, and rejected scan at the gate. Times are Philippine Time.</p>
      </div>
      <EntryLogs />
    </div>
  );
}
