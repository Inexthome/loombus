import PublicProfileV2Client from "./public-profile-v2-client";
import MarketplacePublicListingsSection from "@/components/marketplace-public-listings-section";

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
      <PublicProfileV2Client />
      <MarketplacePublicListingsSection
        sellerUsername={username}
        heading="Marketplace listings"
      />
    </>
  );
}
