import type { Metadata } from "next";
import BusinessProfilePage from "@/components/business-profile-page";
import MarketplacePublicListingsSection from "@/components/marketplace-public-listings-section";
import BusinessEventsSection from "@/components/business-events-section";
import BusinessSchedulingSection from "@/components/business-scheduling-section";
import PublicRequestsSection from "@/components/public-requests-section";

export const metadata: Metadata = {
  title: "Business Profile | Loombus",
  description: "Review a local business profile, service area, open requests, current offerings, events, appointments, and accountability information on Loombus.",
};

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <>
    <BusinessProfilePage />
    <PublicRequestsSection businessSlug={slug} heading="Open Requests from this business" />
    <BusinessEventsSection businessSlug={slug} />
    <BusinessSchedulingSection businessSlug={slug} />
    <MarketplacePublicListingsSection businessSlug={slug} heading="Marketplace items from this business" />
  </>;
}
