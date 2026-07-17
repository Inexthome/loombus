import type { Metadata } from "next";
import EventDetailPage from "@/components/event-detail-page";
import { createRoomServiceSupabase } from "@/lib/room-operations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const siteUrl = "https://loombus.com";

async function loadEvent(slug: string) {
  try {
    const service = createRoomServiceSupabase();
    const { data } = await service
      .from("public_events")
      .select(
        "id, slug, title, description, category, event_format, venue_name, city, region, country_code, online_url, starts_at, ends_at, timezone, is_free, price_text, registration_url, status"
      )
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) {
    return {
      title: "Event unavailable",
      description: "This Loombus Event is unavailable.",
      robots: { index: false, follow: false },
    };
  }
  const description = String(event.description ?? "").slice(0, 160);
  const url = `${siteUrl}/events/${event.slug}`;
  return {
    title: String(event.title),
    description,
    alternates: { canonical: url },
    openGraph: {
      title: String(event.title),
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: String(event.title),
      description,
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  const structuredData = event
    ? {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        description: event.description,
        startDate: event.starts_at,
        endDate: event.ends_at ?? undefined,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode:
          event.event_format === "online"
            ? "https://schema.org/OnlineEventAttendanceMode"
            : event.event_format === "hybrid"
              ? "https://schema.org/MixedEventAttendanceMode"
              : "https://schema.org/OfflineEventAttendanceMode",
        location:
          event.event_format === "online"
            ? {
                "@type": "VirtualLocation",
                url: event.online_url,
              }
            : {
                "@type": "Place",
                name: event.venue_name || undefined,
                address: {
                  "@type": "PostalAddress",
                  addressLocality: event.city || undefined,
                  addressRegion: event.region || undefined,
                  addressCountry: event.country_code || undefined,
                },
              },
        offers: {
          "@type": "Offer",
          url: event.registration_url || `${siteUrl}/events/${event.slug}`,
          price: event.is_free ? "0" : undefined,
          description: event.is_free ? "Free" : event.price_text || undefined,
          availability: "https://schema.org/InStock",
        },
      }
    : null;

  return (
    <>
      <EventDetailPage />
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
