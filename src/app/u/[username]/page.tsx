import MarketplacePublicListingsSection from "@/components/marketplace-public-listings-section";
import { PublicProfilePrivacyBridge } from "@/components/public-profile-privacy-bridge";
import PublicRequestsSection from "@/components/public-requests-section";
import PublicServicesSection from "@/components/public-services-section";
import PublicProfileV2Client from "./public-profile-v2-client";
import "./public-profile-privacy.css";

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
      <div data-public-profile-content>
        <PublicProfileV2Client />
        <PublicServicesSection providerUsername={username} heading="Services" />
        <PublicRequestsSection requesterUsername={username} heading="Open Requests" />
        <MarketplacePublicListingsSection
          sellerUsername={username}
          heading="Marketplace listings"
        />
      </div>
      <PublicProfilePrivacyBridge />
    </>
  );
}
