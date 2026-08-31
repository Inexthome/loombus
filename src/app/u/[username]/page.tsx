import MarketplacePublicListingsSection from "@/components/marketplace-public-listings-section";
import { CreatorSupporterPublicPanel } from "@/components/creator-supporter-public-panel";
import { PublicProfilePrivacyBridge } from "@/components/public-profile-privacy-bridge";
import PublicRequestsSection from "@/components/public-requests-section";
import PublicServicesSection from "@/components/public-services-section";
import "./public-profile-privacy.css";
import "./public-profile-original-background.css";
import "@/components/creator-supporter-paid-public.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return (
    <>
      <PublicProfilePrivacyBridge />
      <div data-public-profile-content>
        <CreatorSupporterPublicPanel username={username} />
        <PublicServicesSection providerUsername={username} heading="Services" />
        <PublicRequestsSection requesterUsername={username} heading="Open Requests" />
        <MarketplacePublicListingsSection
          sellerUsername={username}
          heading="Marketplace listings"
        />
      </div>
    </>
  );
}
