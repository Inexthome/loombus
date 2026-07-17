import type { Metadata } from "next";
import MarketplaceListingPage from "@/components/marketplace-listing-page";

export const metadata: Metadata = {
  title: "Marketplace Listing | Loombus",
  description:
    "Review an approved Marketplace item, seller identity, condition, price, location, and fulfillment options on Loombus.",
};

export default function ListingPage() {
  return <MarketplaceListingPage />;
}
