import type { Metadata } from "next";
import AppointmentsManagerPage from "@/components/appointments-manager-page";
import UnifiedAppointmentsOverview from "@/components/unified-appointments-overview";

export const metadata: Metadata = {
  title: "Appointments",
  description:
    "Manage your Loombus appointments, Marketplace pickups, Room reservations, and business appointment services.",
  robots: { index: false, follow: false },
};

export default function AppointmentsPage() {
  return (
    <>
      <div className="bg-[color:var(--loombus-page-bg)] px-4 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[78rem]">
          <UnifiedAppointmentsOverview />
        </div>
      </div>
      <AppointmentsManagerPage />
    </>
  );
}
