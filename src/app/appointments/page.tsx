import type { Metadata } from "next";
import AppointmentsManagerPage from "@/components/appointments-manager-page";
import V2FeatureRouteShell from "@/components/v2-feature-route-shell";

export const metadata: Metadata = {
  title: "Appointments",
  description: "Manage business appointment services and appointment requests on Loombus.",
  robots: { index: false, follow: false },
};

export default function AppointmentsPage() {
  return (
    <V2FeatureRouteShell>
      <AppointmentsManagerPage />
    </V2FeatureRouteShell>
  );
}
