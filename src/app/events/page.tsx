import type { Metadata } from "next";
import EventsDirectoryPage from "@/components/events-directory-page";
import V2FeatureRouteShell from "@/components/v2-feature-route-shell";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Browse accountable public events on Loombus and keep real-world dates connected to their organizers.",
  alternates: { canonical: "https://loombus.com/events" },
};

export default function EventsPage() {
  return (
    <V2FeatureRouteShell>
      <EventsDirectoryPage />
    </V2FeatureRouteShell>
  );
}
