import { redirect } from "next/navigation";
import { findPublicMarketplaceListingById } from "@/lib/marketplace-public-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// The ID route is a compatibility entry point, not a second listing UI.
// Resolve it into the canonical /marketplace/[slug] Editorial UI surface so
// ID-based links cannot drift into a separate presentation or behavior path.
export default async function MarketplaceListingRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await findPublicMarketplaceListingById(id);
  redirect(listing ? `/marketplace/${listing.slug}` : "/marketplace");
}
