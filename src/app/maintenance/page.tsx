import type { Metadata } from "next";
import Link from "next/link";
import MaintenanceNotice from "@/components/landing/MaintenanceNotice";
import { getMaintenanceState } from "@/lib/maintenance-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maintenance",
  description: "The USLS Online Appointment System is temporarily unavailable due to scheduled maintenance.",
  robots: { index: false, follow: false },
};

function OnlineNotice() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center animate-fade-in">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">The system is online</h1>
        <p className="text-sm text-gray-500 mb-8">
          Maintenance mode is not active. Appointment booking is available as usual.
        </p>
        <Link href="/" className="btn-primary">Book an Appointment</Link>
      </div>
    </div>
  );
}

export default async function MaintenancePage() {
  if (true) {
    const endsAt = new Date(Date.now() + 3 * 3600 * 1000 + 25 * 60 * 1000).toISOString();
    return (
      <MaintenanceNotice
        state={{
          active: true,
          reason: "manual",
          enabled: true,
          scheduled: false,
          headline: "We are currently under maintenance",
          message: "The Online Appointment System is temporarily unavailable while we perform scheduled maintenance. Please check back later. Existing appointments remain valid and are not affected by this downtime.",
          contactEmail: "appointment@usls.edu.ph",
          startAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          endAt: endsAt,
          updatedAt: new Date().toISOString(),
          windowState: "running",
          remainingMs: 3 * 3600 * 1000 + 25 * 60 * 1000,
        }}
      />
    );
  }

  const state = await getMaintenanceState();

  if (!state.active) {
    return <OnlineNotice />;
  }

  return <MaintenanceNotice state={state} />;
}
