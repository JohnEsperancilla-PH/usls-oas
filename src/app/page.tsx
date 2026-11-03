import BookingLanding from "@/components/landing/BookingLanding";
import MaintenanceNotice from "@/components/landing/MaintenanceNotice";
import { getMaintenanceState } from "@/lib/maintenance-server";
import { getEntryTimingNote } from "@/lib/entry-window";
import { getEntryWindow } from "@/lib/entry-window-server";
import { getActiveSystemAlert } from "@/lib/system-alert-server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const maintenance = await getMaintenanceState();

  if (maintenance.active) {
    return <MaintenanceNotice state={maintenance} />;
  }

  return <BookingLanding entryTimingNote={getEntryTimingNote(await getEntryWindow())} systemAlert={await getActiveSystemAlert("landing")} />;
}
