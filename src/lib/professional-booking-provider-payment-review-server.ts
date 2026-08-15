import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFESSIONAL_BOOKING_PROVIDER_PAYMENT_REVIEW_POLICY_VERSION =
  "professional-booking-provider-payment-review-2026-08-v1" as const;

type Row = Record<string, unknown>;

type CommerceTarget = {
  module: string;
  recordType: string;
  recordId: string;
};

export type ProfessionalBookingProviderPaymentReviewScope = {
  providerId: string;
  serviceIds: string[];
  businessIds: string[];
  fingerprint: string;
  blockers: string[];
  unsupportedSourceTypes: string[];
  services: Array<{
    id: string;
    businessId: string;
    name: string;
    description: string;
    durationMinutes: number | null;
    locationMode: string;
    locationText: string | null;
    priceText: string | null;
    instructions: string | null;
    sourceType: string;
    sourceId: string | null;
  }>;
  businesses: Array<{
    id: string;
    ownerId: string | null;
    name: string;
    description: string;
    category: string;
    phone: string | null;
    contactEmail: string | null;
    websiteUrl: string | null;
    bookingUrl: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    countryCode: string;
    showExactAddress: boolean;
    serviceAreaMode: string;
    serviceRadiusMiles: number | null;
    serviceAreas: string[];
    verificationStatus: string;
    status: string;
    moderationReason: string | null;
  }>;
  businessServices: Array<{
    businessId: string;
    name: string;
    description: string;
    category: string | null;
    priceText: string | null;
    bookingUrl: string | null;
    serviceArea: string | null;
  }>;
  pricing: Array<{
    serviceId: string;
    providerId: string;
    amountCents: number | null;
    currency: string;
  }>;
  marketplaceListings: Array<{
    id: string;
    sellerId: string;
    businessId: string | null;
    title: string;
    description: string;
    category: string;
    itemCondition: string;
    price: number | null;
    currency: string;
    isFree: boolean;
    isNegotiable: boolean;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    countryCode: string;
    pickupAvailable: boolean;
    localDeliveryAvailable: boolean;
    shippingAvailable: boolean;
    tags: string[];
    attributes: unknown;
    photoPaths: string[];
    expiresAt: string | null;
    status: string;
  }>;
  commerceIntegrityHeads: Array<{
    id: string;
    taxonomyVersion: string;
    sourceModule: string;
    sourceRecordType: string;
    sourceRecordId: string;
    categoryId: string;
    primarySafetyReasonCode: string;
    secondarySafetyReasonCodes: string[];
    contextModifiers: string[];
    policySeverityCode: string | null;
    triageSeverityCode: string | null;
    trustSafetyCaseId: string | null;
    recordState: string;
    classificationSource: string;
    basisNote: string;
    classifiedAt: string;
  }>;
};

export type ProfessionalBookingProviderPaymentReviewState = {
  scope: ProfessionalBookingProviderPaymentReviewScope;
  review: {
    id: string;
    decision: "approved" | "rejected";
    policyVersion: string;
    scopeFingerprint: string;
    reviewedBusinessIds: string[];
    reviewedServiceIds: string[];
    basisNote: string;
    reviewedBy: string;
    reviewedAt: string;
  } | null;
  matchesCurrentScope: boolean;
  paymentEligible: boolean;
};

export class ProfessionalBookingProviderPaymentReviewError extends Error {
  constructor(
    message: string,
    public status = 503,
    public code = "professional_booking_provider_payment_review_unavailable",
  ) {
    super(message);
  }
}

function text(value: unknown, maximum = 16_000) {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

function nullableText(value: unknown, maximum = 16_000) {
  return text(value, maximum) || null;
}

function boolean(value: unknown) {
  return value === true;
}

function finiteNumber(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort(compareText);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }

  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function sameStringSet(left: string[], right: string[]) {
  const a = sortedUnique(left);
  const b = sortedUnique(right);
  return (
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  );
}

function schemaUnavailable(message: string | null | undefined) {
  return /professional_booking_provider_payment_reviews|business_appointment_services|professional_booking_service_pricing|commerce_integrity_classifications|schema cache|relation .* does not exist/i.test(
    message ?? "",
  );
}

function sourceCommerceTarget(
  sourceType: string,
  sourceId: string | null,
): CommerceTarget | null {
  if (!sourceId) return null;

  switch (sourceType) {
    case "marketplace_listing":
      return {
        module: "marketplace",
        recordType: "marketplace_listing",
        recordId: sourceId,
      };
    case "provider_service":
      return {
        module: "services",
        recordType: "provider_service",
        recordId: sourceId,
      };
    case "service_request":
      return {
        module: "requests",
        recordType: "service_request",
        recordId: sourceId,
      };
    case "public_event":
      return {
        module: "events",
        recordType: "public_event",
        recordId: sourceId,
      };
    default:
      return null;
  }
}

function commerceTargetKey(target: CommerceTarget) {
  return `${target.module}:${target.recordType}:${target.recordId}`;
}

export async function loadProfessionalBookingProviderPaymentReviewScope(
  service: SupabaseClient,
  providerId: string,
): Promise<ProfessionalBookingProviderPaymentReviewScope> {
  const servicesResult = await service
    .from("business_appointment_services")
    .select(
      "id,business_id,owner_id,name,description,duration_minutes,location_mode,location_text,price_text,instructions,status,source_type,source_id",
    )
    .eq("owner_id", providerId)
    .in("status", ["active", "paused"])
    .order("id", { ascending: true });

  if (servicesResult.error) {
    throw new ProfessionalBookingProviderPaymentReviewError(
      schemaUnavailable(servicesResult.error.message)
        ? "Professional Booking payment-review storage is not available yet."
        : "Unable to load the provider's Professional Booking services.",
      503,
      schemaUnavailable(servicesResult.error.message)
        ? "professional_booking_provider_payment_review_schema_unavailable"
        : "professional_booking_provider_payment_review_scope_unavailable",
    );
  }

  const serviceRows = (servicesResult.data ?? []) as unknown as Row[];
  const serviceIds = sortedUnique(
    serviceRows.map((row) => text(row.id, 60)).filter(Boolean),
  );
  const businessIds = sortedUnique(
    serviceRows.map((row) => text(row.business_id, 60)).filter(Boolean),
  );
  const marketplaceIds = sortedUnique(
    serviceRows
      .filter((row) => text(row.source_type, 80) === "marketplace_listing")
      .map((row) => text(row.source_id, 60))
      .filter(Boolean),
  );

  const emptyResult = {
    data: [] as Row[],
    error: null,
  };

  const [
    businessesResult,
    businessServicesResult,
    pricingResult,
    marketplaceResult,
  ] = await Promise.all([
    businessIds.length
      ? service
          .from("businesses")
          .select(
            "id,owner_id,name,description,category,phone,contact_email,website_url,booking_url,logo_url,cover_image_url,address_line_1,address_line_2,city,region,postal_code,country_code,service_area_mode,service_radius_miles,service_areas,show_exact_address,verification_status,status,moderation_reason",
          )
          .in("id", businessIds)
      : Promise.resolve(emptyResult),
    businessIds.length
      ? service
          .from("business_services")
          .select(
            "business_id,name,description,category,price_text,booking_url,service_area,status",
          )
          .in("business_id", businessIds)
          .neq("status", "archived")
      : Promise.resolve(emptyResult),
    serviceIds.length
      ? service
          .from("professional_booking_service_pricing")
          .select("service_id,provider_id,amount_cents,currency")
          .eq("provider_id", providerId)
          .in("service_id", serviceIds)
      : Promise.resolve(emptyResult),
    marketplaceIds.length
      ? service
          .from("marketplace_listings")
          .select(
            "id,seller_id,business_id,title,description,category,item_condition,price,currency,is_free,is_negotiable,city,region,postal_code,country_code,pickup_available,local_delivery_available,shipping_available,tags,attributes,photo_paths,expires_at,status",
          )
          .in("id", marketplaceIds)
      : Promise.resolve(emptyResult),
  ]);

  const hydrationError =
    businessesResult.error ||
    businessServicesResult.error ||
    pricingResult.error ||
    marketplaceResult.error;

  if (hydrationError) {
    throw new ProfessionalBookingProviderPaymentReviewError(
      schemaUnavailable(hydrationError.message)
        ? "Professional Booking payment-review dependencies are not available yet."
        : "Unable to load the provider's payment-review scope.",
      503,
      schemaUnavailable(hydrationError.message)
        ? "professional_booking_provider_payment_review_schema_unavailable"
        : "professional_booking_provider_payment_review_scope_unavailable",
    );
  }

  const businessRows = (businessesResult.data ?? []) as unknown as Row[];
  const businessServiceRows =
    (businessServicesResult.data ?? []) as unknown as Row[];
  const pricingRows = (pricingResult.data ?? []) as unknown as Row[];
  const marketplaceRows =
    (marketplaceResult.data ?? []) as unknown as Row[];

  const businesses = businessRows
    .map((row) => ({
      id: text(row.id, 60),
      ownerId: nullableText(row.owner_id, 60),
      name: text(row.name, 200),
      description: text(row.description, 5000),
      category: text(row.category, 100),
      phone: nullableText(row.phone, 100),
      contactEmail: nullableText(row.contact_email, 320),
      websiteUrl: nullableText(row.website_url, 2000),
      bookingUrl: nullableText(row.booking_url, 2000),
      logoUrl: nullableText(row.logo_url, 2000),
      coverImageUrl: nullableText(row.cover_image_url, 2000),
      addressLine1: nullableText(row.address_line_1, 300),
      addressLine2: nullableText(row.address_line_2, 300),
      city: nullableText(row.city, 100),
      region: nullableText(row.region, 100),
      postalCode: nullableText(row.postal_code, 30),
      countryCode: text(row.country_code, 2).toUpperCase(),
      showExactAddress: boolean(row.show_exact_address),
      serviceAreaMode: text(row.service_area_mode, 30),
      serviceRadiusMiles: finiteNumber(row.service_radius_miles),
      serviceAreas: sortedUnique(stringArray(row.service_areas)),
      verificationStatus: text(row.verification_status, 40),
      status: text(row.status, 40),
      moderationReason: nullableText(row.moderation_reason, 2000),
    }))
    .sort((left, right) => compareText(left.id, right.id));

  const businessServices = businessServiceRows
    .map((row) => ({
      businessId: text(row.business_id, 60),
      name: text(row.name, 160),
      description: text(row.description, 3000),
      category: nullableText(row.category, 100),
      priceText: nullableText(row.price_text, 120),
      bookingUrl: nullableText(row.booking_url, 2000),
      serviceArea: nullableText(row.service_area, 300),
    }))
    .sort((left, right) =>
      compareText(stableStringify(left), stableStringify(right)),
    );

  const pricing = pricingRows
    .map((row) => ({
      serviceId: text(row.service_id, 60),
      providerId: text(row.provider_id, 60),
      amountCents: finiteNumber(row.amount_cents),
      currency: text(row.currency, 10).toLowerCase(),
    }))
    .sort((left, right) => compareText(left.serviceId, right.serviceId));

  const marketplaceListings = marketplaceRows
    .map((row) => ({
      id: text(row.id, 60),
      sellerId: text(row.seller_id, 60),
      businessId: nullableText(row.business_id, 60),
      title: text(row.title, 200),
      description: text(row.description, 16_000),
      category: text(row.category, 120),
      itemCondition: text(row.item_condition, 30),
      price: finiteNumber(row.price),
      currency: text(row.currency, 3).toUpperCase(),
      isFree: boolean(row.is_free),
      isNegotiable: boolean(row.is_negotiable),
      city: nullableText(row.city, 100),
      region: nullableText(row.region, 100),
      postalCode: nullableText(row.postal_code, 30),
      countryCode: text(row.country_code, 2).toUpperCase(),
      pickupAvailable: boolean(row.pickup_available),
      localDeliveryAvailable: boolean(row.local_delivery_available),
      shippingAvailable: boolean(row.shipping_available),
      tags: sortedUnique(stringArray(row.tags)),
      attributes: stableValue(row.attributes ?? {}),
      photoPaths: sortedUnique(stringArray(row.photo_paths)),
      expiresAt: nullableText(row.expires_at, 100),
      status: text(row.status, 40),
    }))
    .sort((left, right) => compareText(left.id, right.id));

  const services = serviceRows
    .map((row) => ({
      id: text(row.id, 60),
      businessId: text(row.business_id, 60),
      name: text(row.name, 200),
      description: text(row.description, 5000),
      durationMinutes: finiteNumber(row.duration_minutes),
      locationMode: text(row.location_mode, 40),
      locationText: nullableText(row.location_text, 300),
      priceText: nullableText(row.price_text, 200),
      instructions: nullableText(row.instructions, 3000),
      sourceType: text(row.source_type, 80) || "business",
      sourceId: nullableText(row.source_id, 60),
    }))
    .sort((left, right) => compareText(left.id, right.id));

  const blockers: string[] = [];
  const unsupportedSourceTypes = sortedUnique(
    services
      .map((item) => item.sourceType)
      .filter(
        (sourceType) =>
          sourceType !== "business" &&
          sourceType !== "marketplace_listing",
      ),
  );

  if (services.length === 0) {
    blockers.push("no_reviewable_services");
  }

  const businessMap = new Map(
    businesses.map((business) => [business.id, business]),
  );
  for (const businessId of businessIds) {
    const business = businessMap.get(businessId);
    if (!business) {
      blockers.push(`business_missing:${businessId}`);
      continue;
    }
    if (business.ownerId !== providerId) {
      blockers.push(`business_owner_mismatch:${businessId}`);
    }
    if (business.status !== "published") {
      blockers.push(`business_not_published:${businessId}`);
    }
    if (business.verificationStatus === "denied") {
      blockers.push(`business_verification_denied:${businessId}`);
    }
  }

  const marketplaceMap = new Map(
    marketplaceListings.map((listing) => [listing.id, listing]),
  );

  for (const appointmentService of services) {
    if (appointmentService.sourceType === "business") {
      if (
        !appointmentService.sourceId ||
        appointmentService.sourceId !== appointmentService.businessId
      ) {
        blockers.push(
          `business_source_mismatch:${appointmentService.id}`,
        );
      }
      continue;
    }

    if (appointmentService.sourceType === "marketplace_listing") {
      if (!appointmentService.sourceId) {
        blockers.push(
          `marketplace_source_missing:${appointmentService.id}`,
        );
        continue;
      }

      const listing = marketplaceMap.get(appointmentService.sourceId);
      if (!listing) {
        blockers.push(
          `marketplace_source_missing:${appointmentService.sourceId}`,
        );
        continue;
      }

      if (listing.sellerId !== providerId) {
        blockers.push(
          `marketplace_source_seller_mismatch:${listing.id}`,
        );
      }

      if (listing.status !== "published") {
        blockers.push(
          `marketplace_source_not_published:${listing.id}`,
        );
      }
      continue;
    }

    blockers.push(
      `unsupported_source_type:${appointmentService.sourceType}`,
    );
  }

  const commerceTargets = new Map<string, CommerceTarget>();

  for (const businessId of businessIds) {
    const target = {
      module: "businesses",
      recordType: "business",
      recordId: businessId,
    };
    commerceTargets.set(commerceTargetKey(target), target);
  }

  for (const appointmentService of services) {
    const target = sourceCommerceTarget(
      appointmentService.sourceType,
      appointmentService.sourceId,
    );
    if (target) {
      commerceTargets.set(commerceTargetKey(target), target);
    }
  }

  const commerceRecordIds = sortedUnique(
    [...commerceTargets.values()].map((target) => target.recordId),
  );

  const commerceResult = commerceRecordIds.length
    ? await service
        .from("commerce_integrity_classifications")
        .select(
          "id,taxonomy_version,source_module,source_record_type,source_record_id,commerce_category_id,primary_safety_reason_code,secondary_safety_reason_codes,context_modifiers,policy_severity_code,triage_severity_code,record_state,classification_source,basis_note,classified_at,supersedes_classification_id,trust_safety_case_id",
        )
        .eq("taxonomy_family", "commerce_integrity")
        .in("source_record_id", commerceRecordIds)
    : emptyResult;

  if (commerceResult.error) {
    throw new ProfessionalBookingProviderPaymentReviewError(
      schemaUnavailable(commerceResult.error.message)
        ? "Commerce Integrity review storage is not available yet."
        : "Unable to load current Commerce Integrity review state.",
      503,
      schemaUnavailable(commerceResult.error.message)
        ? "professional_booking_provider_payment_review_schema_unavailable"
        : "professional_booking_provider_payment_review_commerce_unavailable",
    );
  }

  const commerceRows = (commerceResult.data ?? []) as unknown as Row[];
  const supersededIds = new Set(
    commerceRows
      .map((row) => text(row.supersedes_classification_id, 60))
      .filter(Boolean),
  );

  const headsByTarget = new Map<string, Row[]>();
  for (const row of commerceRows) {
    const rowId = text(row.id, 60);
    if (!rowId || supersededIds.has(rowId)) continue;

    const target: CommerceTarget = {
      module: text(row.source_module, 80),
      recordType: text(row.source_record_type, 120),
      recordId: text(row.source_record_id, 60),
    };
    const key = commerceTargetKey(target);
    if (!commerceTargets.has(key)) continue;

    const existing = headsByTarget.get(key) ?? [];
    existing.push(row);
    headsByTarget.set(key, existing);
  }

  for (const [key, heads] of headsByTarget) {
    if (heads.length > 1) {
      blockers.push(`commerce_integrity_parallel_head:${key}`);
    }
  }

  const commerceIntegrityHeads = [...headsByTarget.values()]
    .flat()
    .map((row) => ({
      id: text(row.id, 60),
      taxonomyVersion: text(row.taxonomy_version, 120),
      sourceModule: text(row.source_module, 80),
      sourceRecordType: text(row.source_record_type, 120),
      sourceRecordId: text(row.source_record_id, 60),
      categoryId: text(row.commerce_category_id, 80),
      primarySafetyReasonCode: text(
        row.primary_safety_reason_code,
        160,
      ),
      secondarySafetyReasonCodes: sortedUnique(
        stringArray(row.secondary_safety_reason_codes),
      ),
      contextModifiers: sortedUnique(
        stringArray(row.context_modifiers),
      ),
      policySeverityCode: nullableText(
        row.policy_severity_code,
        40,
      ),
      triageSeverityCode: nullableText(
        row.triage_severity_code,
        40,
      ),
      trustSafetyCaseId: nullableText(
        row.trust_safety_case_id,
        60,
      ),
      recordState: text(row.record_state, 30),
      classificationSource: text(row.classification_source, 40),
      basisNote: text(row.basis_note, 6000),
      classifiedAt: text(row.classified_at, 100),
    }))
    .sort((left, right) =>
      compareText(stableStringify(left), stableStringify(right)),
    );

  const fingerprintBusinesses = businesses.map((business) => ({
    id: business.id,
    ownerId: business.ownerId,
    name: business.name,
    description: business.description,
    category: business.category,
    phone: business.phone,
    contactEmail: business.contactEmail,
    websiteUrl: business.websiteUrl,
    bookingUrl: business.bookingUrl,
    addressLine1: business.addressLine1,
    addressLine2: business.addressLine2,
    city: business.city,
    region: business.region,
    postalCode: business.postalCode,
    countryCode: business.countryCode,
    showExactAddress: business.showExactAddress,
    serviceAreaMode: business.serviceAreaMode,
    serviceRadiusMiles: business.serviceRadiusMiles,
    serviceAreas: business.serviceAreas,
    verificationStatus: business.verificationStatus,
    status: business.status,
  }));

  const fingerprintMarketplaceListings = marketplaceListings.map(
    (listing) => ({
      id: listing.id,
      sellerId: listing.sellerId,
      businessId: listing.businessId,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      itemCondition: listing.itemCondition,
      price: listing.price,
      currency: listing.currency,
      isFree: listing.isFree,
      isNegotiable: listing.isNegotiable,
      city: listing.city,
      region: listing.region,
      postalCode: listing.postalCode,
      countryCode: listing.countryCode,
      pickupAvailable: listing.pickupAvailable,
      localDeliveryAvailable: listing.localDeliveryAvailable,
      shippingAvailable: listing.shippingAvailable,
      tags: listing.tags,
      attributes: listing.attributes,
      photoPaths: listing.photoPaths,
      status: listing.status,
    }),
  );

  const fingerprintPayload = {
    scopeVersion: 1,
    providerId,
    serviceIds,
    businessIds,
    services,
    businesses: fingerprintBusinesses,
    businessServices,
    pricing,
    marketplaceListings: fingerprintMarketplaceListings,
    commerceIntegrityHeads,
  };

  const fingerprint = createHash("sha256")
    .update(stableStringify(fingerprintPayload), "utf8")
    .digest("hex");

  return {
    providerId,
    serviceIds,
    businessIds,
    fingerprint,
    blockers: sortedUnique(blockers),
    unsupportedSourceTypes,
    services,
    businesses,
    businessServices,
    pricing,
    marketplaceListings,
    commerceIntegrityHeads,
  };
}

export async function getProfessionalBookingProviderPaymentReviewState(
  service: SupabaseClient,
  providerId: string,
): Promise<ProfessionalBookingProviderPaymentReviewState> {
  const scope =
    await loadProfessionalBookingProviderPaymentReviewScope(
      service,
      providerId,
    );

  const reviewResult = await service
    .from("professional_booking_provider_payment_reviews")
    .select(
      "id,decision,policy_version,reviewed_business_ids,reviewed_service_ids,scope_fingerprint,basis_note,reviewed_by,reviewed_at",
    )
    .eq("provider_id", providerId)
    .order("reviewed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reviewResult.error) {
    throw new ProfessionalBookingProviderPaymentReviewError(
      schemaUnavailable(reviewResult.error.message)
        ? "Professional Booking provider payment-review storage is not available yet."
        : "Unable to load the provider's current payment review.",
      503,
      schemaUnavailable(reviewResult.error.message)
        ? "professional_booking_provider_payment_review_schema_unavailable"
        : "professional_booking_provider_payment_review_unavailable",
    );
  }

  const row = reviewResult.data as Row | null;

  const decision = text(row?.decision, 20);
  const review =
    row && (decision === "approved" || decision === "rejected")
      ? {
          id: text(row.id, 60),
          decision: decision as "approved" | "rejected",
          policyVersion: text(row.policy_version, 120),
          scopeFingerprint: text(row.scope_fingerprint, 64),
          reviewedBusinessIds: sortedUnique(
            stringArray(row.reviewed_business_ids),
          ),
          reviewedServiceIds: sortedUnique(
            stringArray(row.reviewed_service_ids),
          ),
          basisNote: text(row.basis_note, 4000),
          reviewedBy: text(row.reviewed_by, 60),
          reviewedAt: text(row.reviewed_at, 100),
        }
      : null;

  const matchesCurrentScope =
    review !== null &&
    review.policyVersion ===
      PROFESSIONAL_BOOKING_PROVIDER_PAYMENT_REVIEW_POLICY_VERSION &&
    review.scopeFingerprint === scope.fingerprint &&
    sameStringSet(review.reviewedBusinessIds, scope.businessIds) &&
    sameStringSet(review.reviewedServiceIds, scope.serviceIds);

  return {
    scope,
    review,
    matchesCurrentScope,
    paymentEligible:
      scope.blockers.length === 0 &&
      matchesCurrentScope &&
      review?.decision === "approved",
  };
}
