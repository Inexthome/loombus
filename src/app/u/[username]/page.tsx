import PublicProfileV2Client from "./public-profile-v2-client";
import MarketplacePublicListingsSection from "@/components/marketplace-public-listings-section";
import PublicRequestsSection from "@/components/public-requests-section";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <>
    <PublicProfileV2Client />
    <PublicRequestsSection requesterUsername={username} heading="Open Requests" />
    <MarketplacePublicListingsSection sellerUsername={username} heading="Marketplace listings" />
  </>;
}
