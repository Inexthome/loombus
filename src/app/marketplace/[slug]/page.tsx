import type { Metadata } from "next";
import MarketplaceListingPage from "@/components/marketplace-listing-page";
import MarketplaceTrustActions from "@/components/marketplace-trust-actions";
import { findPublicMarketplaceListingBySlug } from "@/lib/marketplace-public-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const siteUrl = "https://loombus.com";

function conditionUrl(condition: string) {
  const conditions: Record<string, string> = {
    new: "https://schema.org/NewCondition",
    like_new: "https://schema.org/UsedCondition",
    good: "https://schema.org/UsedCondition",
    fair: "https://schema.org/UsedCondition",
    for_parts: "https://schema.org/DamagedCondition",
    not_applicable: "https://schema.org/UsedCondition",
  };
  return conditions[condition] ?? "https://schema.org/UsedCondition";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await findPublicMarketplaceListingBySlug(slug);
  if (!listing) {
    return {
      title: "Marketplace Listing | Loombus",
      description: "This Loombus Marketplace listing is unavailable.",
      robots: { index: false, follow: false },
    };
  }

  const description = listing.description.slice(0, 160);
  const url = `${siteUrl}/marketplace/${listing.slug}`;
  const image = listing.photos[0]?.url;

  return {
    title: `${listing.title} | Loombus Marketplace`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: listing.title,
      description,
      url,
      type: "website",
      images: image ? [{ url: image, alt: listing.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: listing.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await findPublicMarketplaceListingBySlug(slug);
  const structuredData = listing
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: listing.title,
        description: listing.description,
        image: listing.photos.map((photo) => photo.url),
        category: listing.category,
        itemCondition: conditionUrl(listing.condition),
        offers: {
          "@type": "Offer",
          url: `${siteUrl}/marketplace/${listing.slug}`,
          priceCurrency: listing.currency,
          price: listing.price,
          availability: "https://schema.org/InStock",
          seller: listing.businessName
            ? {
                "@type": "Organization",
                name: listing.businessName,
              }
            : {
                "@type": "Person",
                name: listing.sellerName,
              },
        },
      }
    : null;

  return (
    <>
      <MarketplaceListingPage />
      <MarketplaceTrustActions slug={slug} />
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
    </>
  );
}
