import type { Metadata } from "next";
import MarketplaceAdminMetrics from "@/components/marketplace-admin-metrics";
import MarketplaceManagerPage from "@/components/marketplace-manager-page";
import "../marketplace-editorial.css";

export const metadata: Metadata = {
  title: "Manage Marketplace | Loombus",
  description:
    "Create and manage attributable Loombus Marketplace listings.",
  robots: { index: false, follow: false },
};

export default function ManageMarketplacePage() {
  return (
    <div data-marketplace-editorial="manage">
      <MarketplaceManagerPage />
      <MarketplaceAdminMetrics />
    </div>
  );
}
