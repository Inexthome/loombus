import { redirect } from "next/navigation";
import { findPublicMarketplaceListingById } from "@/lib/marketplace-public-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MarketplaceListingRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await findPublicMarketplaceListingById(id);
  redirect(listing ? `/marketplace/${listing.slug}` : "/marketplace");
}
