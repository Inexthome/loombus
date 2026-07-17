import type { Metadata } from "next";
import BusinessProfilePage from "@/components/business-profile-page";
import MarketplacePublicListingsSection from "@/components/marketplace-public-listings-section";

export const metadata: Metadata = {
  title: "Business Profile | Loombus",
  description:
    "Review a local business profile, service area, current offerings, and accountability information on Loombus.",
};

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <BusinessProfilePage />
      <MarketplacePublicListingsSection
        businessSlug={slug}
        heading="Marketplace items from this business"
      />
    </>
  );
}
