import type { Metadata } from "next";
import MarketplaceDirectoryPage from "@/components/marketplace-directory-page";
import MarketplaceQuickLinks from "@/components/marketplace-quick-links";

export const metadata: Metadata = {
  title: "Marketplace | Loombus",
  description:
    "Browse approved items from attributable Loombus sellers without sponsored placement or pay-to-rank.",
};

export default function MarketplacePage() {
  return (
    <>
      <MarketplaceQuickLinks />
      <MarketplaceDirectoryPage />
    </>
  );
}
