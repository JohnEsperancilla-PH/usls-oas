import BookingLanding from "@/components/landing/BookingLanding";
import MaintenanceNotice from "@/components/landing/MaintenanceNotice";
import { getMaintenanceState } from "@/lib/maintenance-server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const maintenance = await getMaintenanceState();

  if (maintenance.active) {
    return <MaintenanceNotice state={maintenance} />;
  }

  return <BookingLanding />;
}
