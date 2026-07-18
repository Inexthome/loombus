import type { Metadata } from "next";
import RequestDetailPage from "@/components/request-detail-page";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { createRoomServiceSupabase } from "@/lib/room-operations";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const siteUrl = "https://loombus.com";

async function loadRequest(slug: string) {
  try {
    const service = createRoomServiceSupabase();
    await service.rpc("expire_service_requests");
    const { data } = await service
      .from("service_requests")
      .select("id, requester_id, business_id, slug, title, description, request_type, category, urgency, service_mode, city, region, country_code, deadline, status")
      .eq("slug", slug)
      .eq("status", "open")
      .maybeSingle();
    if (!data) return null;
    const [profileResult, sensitiveResult, businessResult] = await Promise.all([
      service.from("profiles").select("account_status, enforcement_reason, suspended_until").eq("id", data.requester_id).maybeSingle(),
      service.from("profile_sensitive").select("age_band, guardian_required").eq("id", data.requester_id).maybeSingle(),
      data.business_id ? service.from("businesses").select("owner_id, status").eq("id", data.business_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    const ageBand = String(sensitiveResult.data?.age_band ?? "unknown");
    if (!profileResult.data || !getAccountEnforcementResult(profileResult.data).allowed || ageBand === "unknown" || ageBand === "under_13" || sensitiveResult.data?.guardian_required === true) return null;
    if (data.business_id && (!businessResult.data || businessResult.data.status !== "published" || businessResult.data.owner_id !== data.requester_id)) return null;
    if (data.deadline && new Date(data.deadline).getTime() <= Date.now()) return null;
    return data;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await loadRequest(slug);
  if (!item) return { title: "Request unavailable", description: "This Loombus Request is unavailable.", robots: { index: false, follow: false } };
  const description = String(item.description ?? "").slice(0, 160);
  const url = `${siteUrl}/requests/${item.slug}`;
  return { title: String(item.title), description, alternates: { canonical: url }, openGraph: { title: String(item.title), description, url, type: "website" }, twitter: { card: "summary", title: String(item.title), description } };
}

export default async function RequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await loadRequest(slug);
  const structuredData = item ? {
    "@context": "https://schema.org",
    "@type": "Demand",
    name: item.title,
    description: item.description,
    category: item.category,
    areaServed: item.service_mode === "remote" ? "Remote" : [item.city, item.region, item.country_code].filter(Boolean).join(", "),
    availabilityEnds: item.deadline || undefined,
    url: `${siteUrl}/requests/${item.slug}`,
  } : null;
  return <><RequestDetailPage />{structuredData ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /> : null}</>;
}
