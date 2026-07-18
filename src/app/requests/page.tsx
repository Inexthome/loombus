import type { Metadata } from "next";
import RequestsDirectoryPage from "@/components/requests-directory-page";
import V2FeatureRouteShell from "@/components/v2-feature-route-shell";

export const metadata: Metadata = {
  title: "Requests",
  description: "Find accountable public requests for services, recommendations, quotes, consultations, community help, and local problem solving on Loombus.",
  alternates: { canonical: "https://loombus.com/requests" },
};

export default function RequestsPage() {
  return (
    <V2FeatureRouteShell>
      <RequestsDirectoryPage />
    </V2FeatureRouteShell>
  );
}
