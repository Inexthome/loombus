import type { Metadata } from "next";
import MarketplaceDirectoryPage from "@/components/marketplace-directory-page";
import MarketplaceQuickLinks from "@/components/marketplace-quick-links";
import V2FeatureRouteShell from "@/components/v2-feature-route-shell";

export const metadata: Metadata = {
  title: "Marketplace | Loombus",
  description:
    "Browse approved items from attributable Loombus sellers without sponsored placement or pay-to-rank.",
};

export default function MarketplacePage() {
  return (
    <V2FeatureRouteShell>
      <MarketplaceQuickLinks />
      <MarketplaceDirectoryPage />
    </V2FeatureRouteShell>
  );
}
