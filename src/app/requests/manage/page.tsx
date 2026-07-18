import type { Metadata } from "next";
import RequestsManagerPage from "@/components/requests-manager-page";
import V2FeatureRouteShell from "@/components/v2-feature-route-shell";

export const metadata: Metadata = {
  title: "Manage Requests",
  description: "Create and manage public Loombus Requests and responses.",
  robots: { index: false, follow: false },
};

export default function ManageRequestsPage() {
  return (
    <V2FeatureRouteShell>
      <RequestsManagerPage />
    </V2FeatureRouteShell>
  );
}
