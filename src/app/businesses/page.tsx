import type { Metadata } from "next";
import BusinessDirectoryPage from "@/components/business-directory-page";
import V2FeatureRouteShell from "@/components/v2-feature-route-shell";

export const metadata: Metadata = {
  title: "Local Business and Services | Loombus",
  description:
    "Discover approved local businesses, service areas, and current offerings through the Loombus signal-first directory.",
};

export default function BusinessesPage() {
  return (
    <V2FeatureRouteShell>
      <BusinessDirectoryPage />
    </V2FeatureRouteShell>
  );
}
