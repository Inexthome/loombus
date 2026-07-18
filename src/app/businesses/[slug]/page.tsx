import type { Metadata } from "next";
import BusinessProfilePage from "@/components/business-profile-page";
import MarketplacePublicListingsSection from "@/components/marketplace-public-listings-section";
import BusinessEventsSection from "@/components/business-events-section";
import BusinessSchedulingSection from "@/components/business-scheduling-section";
import PublicRequestsSection from "@/components/public-requests-section";
import PublicServicesSection from "@/components/public-services-section";

export const metadata: Metadata = {
  title: "Business Profile | Loombus",
  description:
    "Review a local business profile, Services, service area, open Requests, current offerings, events, appointments, and accountability information on Loombus.",
};

export default async function BusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ appointmentService?: string | string[] }>;
}) {
  const { slug } = await params;
  const resolvedSearch = await searchParams;
  const rawAppointmentService = resolvedSearch.appointmentService;
  const appointmentServiceId = Array.isArray(rawAppointmentService)
    ? rawAppointmentService[0] ?? ""
    : rawAppointmentService ?? "";

  return (
    <>
      <BusinessProfilePage />
      <PublicServicesSection
        businessSlug={slug}
        heading="Services from this business"
      />
      <PublicRequestsSection
        businessSlug={slug}
        heading="Open Requests from this business"
      />
      <BusinessEventsSection businessSlug={slug} />
      <BusinessSchedulingSection
        businessSlug={slug}
        preselectServiceId={appointmentServiceId}
      />
      <MarketplacePublicListingsSection
        businessSlug={slug}
        heading="Marketplace items from this business"
      />
    </>
  );
}
