import type { Metadata } from "next";
import EventsManagerPage from "@/components/events-manager-page";
import V2FeatureRouteShell from "@/components/v2-feature-route-shell";

export const metadata: Metadata = {
  title: "Manage Events",
  description: "Create and manage attributable Loombus Events.",
  robots: { index: false, follow: false },
};

export default function ManageEventsPage() {
  return (
    <V2FeatureRouteShell>
      <EventsManagerPage />
    </V2FeatureRouteShell>
  );
}
