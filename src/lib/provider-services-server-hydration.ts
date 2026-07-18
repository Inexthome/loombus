import "server-only";

import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import type {
  ProviderServiceInquiry,
  PublicProviderService,
} from "@/lib/provider-services";
import {
  ProviderServicesError,
  cleanText,
  type Row,
  type Service,
} from "@/lib/provider-services-server-core";

function displayName(profile: Row | undefined) {
  return (
    cleanText(profile?.full_name, 200) ||
    cleanText(profile?.username, 100) ||
    "Loombus member"
  );
}

function enforcementAllowed(profile: Row | undefined) {
  if (!profile) return false;
  return getAccountEnforcementResult({
    account_status:
      typeof profile.account_status === "string"
        ? profile.account_status
        : null,
    enforcement_reason:
      typeof profile.enforcement_reason === "string"
        ? profile.enforcement_reason
        : null,
    suspended_until:
      typeof profile.suspended_until === "string"
        ? profile.suspended_until
        : null,
  }).allowed;
}

export async function hydrateProviderServices(
  service: Service,
  rows: Row[],
  viewerId: string | null,
  isAdmin: boolean,
  includeUnavailable = false,
): Promise<PublicProviderService[]> {
  if (!rows.length) return [];
  const serviceIds = rows.map((row) => String(row.id));
  const providerIds = [
    ...new Set(rows.map((row) => String(row.provider_id))),
  ];
  const businessIds = [
    ...new Set(
      rows
        .map((row) => String(row.business_id ?? ""))
        .filter(Boolean),
    ),
  ];
  const appointmentIds = [
    ...new Set(
      rows
        .map((row) => String(row.appointment_service_id ?? ""))
        .filter(Boolean),
    ),
  ];

  const [
    profilesResult,
    sensitiveResult,
    businessesResult,
    appointmentsResult,
    inquiryResult,
    saveResult,
    viewerSaveResult,
    viewerInquiryResult,
  ] = await Promise.all([
    service
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, account_status, enforcement_reason, suspended_until",
      )
      .in("id", providerIds),
    service
      .from("profile_sensitive")
      .select("id, age_band, guardian_required")
      .in("id", providerIds),
    businessIds.length
      ? service
          .from("businesses")
          .select("id, name, slug, owner_id, status")
          .in("id", businessIds)
      : Promise.resolve({ data: [], error: null }),
    appointmentIds.length
      ? service
          .from("business_appointment_services")
          .select("id, name, business_id, owner_id, status")
          .in("id", appointmentIds)
      : Promise.resolve({ data: [], error: null }),
    service
      .from("provider_service_inquiries")
      .select("service_id, status")
      .in("service_id", serviceIds)
      .neq("status", "cancelled"),
    service
      .from("provider_service_saves")
      .select("service_id")
      .in("service_id", serviceIds),
    viewerId
      ? service
          .from("provider_service_saves")
          .select("service_id")
          .eq("user_id", viewerId)
          .in("service_id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    viewerId
      ? service
          .from("provider_service_inquiries")
          .select("service_id")
          .eq("requester_id", viewerId)
          .in("service_id", serviceIds)
          .in("status", ["submitted", "accepted"])
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError =
    profilesResult.error ||
    sensitiveResult.error ||
    businessesResult.error ||
    appointmentsResult.error ||
    inquiryResult.error ||
    saveResult.error ||
    viewerSaveResult.error ||
    viewerInquiryResult.error;
  if (firstError) {
    throw new ProviderServicesError(
      "Unable to load Service details.",
      503,
      "service_hydration_failed",
    );
  }

  const profiles = new Map<string, Row>(
    ((profilesResult.data ?? []) as Row[]).map((row) => [
      String(row.id),
      row,
    ]),
  );
  const sensitive = new Map<string, Row>(
    ((sensitiveResult.data ?? []) as Row[]).map((row) => [
      String(row.id),
      row,
    ]),
  );
  const businesses = new Map<string, Row>(
    ((businessesResult.data ?? []) as Row[]).map((row) => [
      String(row.id),
      row,
    ]),
  );
  const appointments = new Map<string, Row>(
    ((appointmentsResult.data ?? []) as Row[]).map((row) => [
      String(row.id),
      row,
    ]),
  );
  const inquiryCounts = new Map<string, number>();
  for (const row of (inquiryResult.data ?? []) as Row[]) {
    inquiryCounts.set(
      String(row.service_id),
      (inquiryCounts.get(String(row.service_id)) ?? 0) + 1,
    );
  }
  const saveCounts = new Map<string, number>();
  for (const row of (saveResult.data ?? []) as Row[]) {
    saveCounts.set(
      String(row.service_id),
      (saveCounts.get(String(row.service_id)) ?? 0) + 1,
    );
  }
  const viewerSaves = new Set(
    ((viewerSaveResult.data ?? []) as Row[]).map((row) =>
      String(row.service_id),
    ),
  );
  const viewerInquiries = new Set(
    ((viewerInquiryResult.data ?? []) as Row[]).map((row) =>
      String(row.service_id),
    ),
  );

  return rows.flatMap((row) => {
    const id = String(row.id);
    const providerId = String(row.provider_id);
    const profile = profiles.get(providerId);
    const safety = sensitive.get(providerId);
    const ageBand = String(safety?.age_band ?? "unknown");
    const businessId = row.business_id ? String(row.business_id) : null;
    const business = businessId ? businesses.get(businessId) : undefined;
    const appointmentId = row.appointment_service_id
      ? String(row.appointment_service_id)
      : null;
    const appointment = appointmentId
      ? appointments.get(appointmentId)
      : undefined;
    const eligible =
      enforcementAllowed(profile) &&
      ageBand !== "unknown" &&
      ageBand !== "under_13" &&
      safety?.guardian_required !== true &&
      (!businessId ||
        (business?.status === "published" &&
          business?.owner_id === providerId)) &&
      (!appointmentId ||
        (appointment?.status === "active" &&
          appointment?.owner_id === providerId &&
          (!businessId || appointment?.business_id === businessId)));
    if (!eligible && !includeUnavailable) return [];

    return [
      {
        id,
        slug: cleanText(row.slug, 120),
        providerId,
        providerName: displayName(profile),
        providerUsername: cleanText(profile?.username, 100) || null,
        providerAvatarUrl: cleanText(profile?.avatar_url, 1000) || null,
        businessId,
        businessName: cleanText(business?.name, 200) || null,
        businessSlug: cleanText(business?.slug, 120) || null,
        appointmentServiceId: appointmentId,
        appointmentServiceName: cleanText(appointment?.name, 200) || null,
        title: cleanText(row.title, 200),
        description: cleanText(row.description, 16000),
        category: cleanText(row.category, 120),
        specialties: Array.isArray(row.specialties)
          ? row.specialties.map(String)
          : [],
        serviceMode: row.service_mode,
        city: cleanText(row.city, 100) || null,
        region: cleanText(row.region, 100) || null,
        postalCode: cleanText(row.postal_code, 30) || null,
        countryCode: cleanText(row.country_code, 2) || "US",
        priceType: row.price_type,
        priceMin: row.price_min === null ? null : Number(row.price_min),
        priceMax: row.price_max === null ? null : Number(row.price_max),
        currency: cleanText(row.currency, 3) || "USD",
        typicalDurationMinutes:
          row.typical_duration_minutes === null
            ? null
            : Number(row.typical_duration_minutes),
        responseExpectation:
          cleanText(row.response_expectation, 500) || null,
        availabilityText: cleanText(row.availability_text, 1000) || null,
        attachmentUrls: Array.isArray(row.attachment_urls)
          ? row.attachment_urls.map(String)
          : [],
        attachmentPaths: Array.isArray(row.attachment_paths)
          ? row.attachment_paths.map(String)
          : [],
        attachmentTypes: Array.isArray(row.attachment_types)
          ? row.attachment_types.map(String)
          : [],
        attachmentNames: Array.isArray(row.attachment_names)
          ? row.attachment_names.map(String)
          : [],
        status: row.status,
        moderationReason: cleanText(row.moderation_reason, 2000) || null,
        inquiryCount: inquiryCounts.get(id) ?? 0,
        savedCount: saveCounts.get(id) ?? 0,
        viewerSaved: viewerSaves.has(id),
        viewerCanManage: Boolean(
          viewerId && (viewerId === providerId || isAdmin),
        ),
        viewerHasInquiry: viewerInquiries.has(id),
        publishedAt: row.published_at ? String(row.published_at) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      } as PublicProviderService,
    ];
  });
}

export async function hydrateProviderServiceInquiries(
  service: Service,
  rows: Row[],
): Promise<ProviderServiceInquiry[]> {
  if (!rows.length) return [];
  const serviceIds = [
    ...new Set(rows.map((row) => String(row.service_id))),
  ];
  const requesterIds = [
    ...new Set(rows.map((row) => String(row.requester_id))),
  ];
  const requestIds = [
    ...new Set(
      rows
        .map((row) => String(row.linked_request_id ?? ""))
        .filter(Boolean),
    ),
  ];
  const [servicesResult, profilesResult, requestsResult] = await Promise.all([
    service
      .from("provider_services")
      .select("id, title, slug, provider_id")
      .in("id", serviceIds),
    service
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", requesterIds),
    requestIds.length
      ? service
          .from("service_requests")
          .select("id, title, slug")
          .in("id", requestIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (servicesResult.error || profilesResult.error || requestsResult.error) {
    throw new ProviderServicesError(
      "Unable to load Service inquiries.",
      503,
      "service_inquiries_unavailable",
    );
  }
  const services = new Map<string, Row>(
    ((servicesResult.data ?? []) as Row[]).map((row) => [
      String(row.id),
      row,
    ]),
  );
  const profiles = new Map<string, Row>(
    ((profilesResult.data ?? []) as Row[]).map((row) => [
      String(row.id),
      row,
    ]),
  );
  const requests = new Map<string, Row>(
    ((requestsResult.data ?? []) as Row[]).map((row) => [
      String(row.id),
      row,
    ]),
  );

  return rows.map((row) => {
    const listing = services.get(String(row.service_id));
    const requester = profiles.get(String(row.requester_id));
    const linkedRequest = row.linked_request_id
      ? requests.get(String(row.linked_request_id))
      : undefined;
    return {
      id: String(row.id),
      serviceId: String(row.service_id),
      serviceTitle: cleanText(listing?.title, 200) || "Service",
      serviceSlug: cleanText(listing?.slug, 120) || null,
      providerId: String(row.provider_id),
      requesterId: String(row.requester_id),
      requesterName: displayName(requester),
      requesterUsername: cleanText(requester?.username, 100) || null,
      requesterAvatarUrl: cleanText(requester?.avatar_url, 1000) || null,
      linkedRequestId: row.linked_request_id
        ? String(row.linked_request_id)
        : null,
      linkedRequestTitle: cleanText(linkedRequest?.title, 200) || null,
      linkedRequestSlug: cleanText(linkedRequest?.slug, 120) || null,
      message: cleanText(row.message, 8000),
      preferredStart: row.preferred_start
        ? String(row.preferred_start)
        : null,
      preferredEnd: row.preferred_end ? String(row.preferred_end) : null,
      budgetMin: row.budget_min === null ? null : Number(row.budget_min),
      budgetMax: row.budget_max === null ? null : Number(row.budget_max),
      currency: cleanText(row.currency, 3) || "USD",
      status: row.status,
      conversationId: row.conversation_id
        ? String(row.conversation_id)
        : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    } as ProviderServiceInquiry;
  });
}
