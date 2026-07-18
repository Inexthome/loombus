import type { Metadata } from "next";
import ServiceDetailPage from "@/components/service-detail-page";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { createRoomServiceSupabase } from "@/lib/room-operations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const siteUrl = "https://loombus.com";

type ProviderBusiness = {
  owner_id: string;
  status: string;
};

type AppointmentService = {
  owner_id: string;
  business_id: string;
  status: string;
};

async function loadService(slug: string) {
  try {
    const service = createRoomServiceSupabase();
    const { data } = await service
      .from("provider_services")
      .select(
        "id, provider_id, business_id, appointment_service_id, slug, title, description, category, specialties, service_mode, city, region, country_code, price_type, price_min, price_max, currency, typical_duration_minutes, status",
      )
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (!data) return null;

    const [profileResult, sensitiveResult] = await Promise.all([
      service
        .from("profiles")
        .select("account_status, enforcement_reason, suspended_until")
        .eq("id", data.provider_id)
        .maybeSingle(),
      service
        .from("profile_sensitive")
        .select("age_band, guardian_required")
        .eq("id", data.provider_id)
        .maybeSingle(),
    ]);

    let business: ProviderBusiness | null = null;
    if (data.business_id) {
      const result = await service
        .from("businesses")
        .select("owner_id, status")
        .eq("id", data.business_id)
        .maybeSingle();
      if (result.error) return null;
      business = result.data as ProviderBusiness | null;
    }

    let appointment: AppointmentService | null = null;
    if (data.appointment_service_id) {
      const result = await service
        .from("business_appointment_services")
        .select("owner_id, business_id, status")
        .eq("id", data.appointment_service_id)
        .maybeSingle();
      if (result.error) return null;
      appointment = result.data as AppointmentService | null;
    }

    const ageBand = String(sensitiveResult.data?.age_band ?? "unknown");
    if (
      profileResult.error ||
      sensitiveResult.error ||
      !profileResult.data ||
      !getAccountEnforcementResult(profileResult.data).allowed ||
      ageBand === "unknown" ||
      ageBand === "under_13" ||
      sensitiveResult.data?.guardian_required === true
    ) {
      return null;
    }
    if (
      data.business_id &&
      (!business ||
        business.status !== "published" ||
        business.owner_id !== data.provider_id)
    ) {
      return null;
    }
    if (
      data.appointment_service_id &&
      (!appointment ||
        appointment.status !== "active" ||
        appointment.owner_id !== data.provider_id ||
        !data.business_id ||
        appointment.business_id !== data.business_id)
    ) {
      return null;
    }
    return data;
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
  const item = await loadService(slug);
  if (!item) {
    return {
      title: "Service unavailable",
      description: "This Loombus Service is unavailable.",
      robots: { index: false, follow: false },
    };
  }
  const description = String(item.description ?? "").slice(0, 160);
  const url = `${siteUrl}/services/${item.slug}`;
  return {
    title: String(item.title),
    description,
    alternates: { canonical: url },
    openGraph: {
      title: String(item.title),
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: String(item.title),
      description,
    },
  };
}

export default async function ProviderServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await loadService(slug);
  const structuredData = item
    ? {
        "@context": "https://schema.org",
        "@type": "Service",
        name: item.title,
        description: item.description,
        category: item.category,
        serviceType: Array.isArray(item.specialties)
          ? item.specialties.join(", ")
          : item.category,
        areaServed:
          item.service_mode === "remote"
            ? "Remote"
            : [item.city, item.region, item.country_code]
                .filter(Boolean)
                .join(", "),
        offers:
          item.price_type !== "contact" && item.price_min !== null
            ? {
                "@type": "Offer",
                priceCurrency: item.currency,
                price: item.price_min,
              }
            : undefined,
        url: `${siteUrl}/services/${item.slug}`,
      }
    : null;

  return (
    <>
      <ServiceDetailPage />
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
