import type { Metadata } from "next";
import MarketplaceManageWorkspace from "@/components/marketplace-manage-workspace";

export const metadata: Metadata = {
  title: "Manage Marketplace | Loombus",
  description:
    "Create and manage attributable Loombus Marketplace listings.",
  robots: { index: false, follow: false },
};

export default function ManageMarketplacePage() {
  return <MarketplaceManageWorkspace />;
}
