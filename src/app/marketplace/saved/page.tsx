import type { Metadata } from "next";
import MarketplaceSavedPage from "@/components/marketplace-saved-page";

export const metadata: Metadata = {
  title: "Saved Marketplace Items | Loombus",
  description: "Review your private Loombus Marketplace watchlist.",
  robots: { index: false, follow: false },
};

export default function SavedMarketplacePage() {
  return <MarketplaceSavedPage />;
}
