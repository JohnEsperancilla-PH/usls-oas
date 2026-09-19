"use client";

import { useAdmin } from "@/app/admin/layout";
import { OfficeContactsPanel } from "@/components/admin/OfficeContactsModal";
import Link from "next/link";

export default function ContactsPage() {
  const { admin } = useAdmin();

  if (admin.role === "gate_user") return null;

  if (admin.role === "super_admin") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Office Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Contacts are managed per office.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">As a super admin, open the Offices page and use the Contacts button on any office to manage its contacts.</p>
          <Link href="/admin/offices" className="text-sm font-medium text-primary hover:text-primary-light">
            Go to Offices →
          </Link>
        </div>
      </div>
    );
  }

  const officeId = admin.office_id || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Office Contacts</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Tagged contacts are added to invitations, calendar invites, and notification emails (no ticket PDF).
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <OfficeContactsPanel officeId={officeId} />
      </div>
    </div>
  );
}