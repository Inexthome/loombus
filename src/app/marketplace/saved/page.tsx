import type { Metadata } from "next";
import MarketplaceSavedPage from "@/components/marketplace-saved-page";
import V2FeatureRouteShell from "@/components/v2-feature-route-shell";

export const metadata: Metadata = {
  title: "Saved Marketplace Items | Loombus",
  description: "Review your private Loombus Marketplace watchlist.",
  robots: { index: false, follow: false },
};

export default function SavedMarketplacePage() {
  return (
    <V2FeatureRouteShell>
      <MarketplaceSavedPage />
    </V2FeatureRouteShell>
  );
}
