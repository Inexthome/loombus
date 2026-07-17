import "server-only";

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BusinessDirectoryError,
  type BusinessInput,
  type BusinessViewer,
  asBoolean,
  asNumber,
  cleanEmail,
  cleanLongText,
  cleanStringArray,
  cleanText,
  cleanUrl,
  cleanUuid,
  MAX_SERVICES,
  resolveViewer,
  slugify,
} from "@/lib/business-directory-server-shared";

function normalizeServices(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SERVICES).map((raw, index) => {
    const service = (raw ?? {}) as Record<string, unknown>;
    const name = cleanText(service.name, 160);
    if (!name) {
      throw new BusinessDirectoryError(`Service ${index + 1} needs a name.`, 400, "service_name_required");
    }
    return {
      name,
      description: cleanLongText(service.description, 3000),
      category: cleanText(service.category, 100),
      price_text: cleanText(service.priceText, 100),
      booking_url: cleanUrl(service.bookingUrl),
      service_area: cleanText(service.serviceArea, 300),
      status: "active",
      sort_order: index,
    };
  });
}

function normalizeBusinessInput(input: BusinessInput) {
  const name = cleanText(input.name, 200);
  const description = cleanLongText(input.description, 5000);
  const category = cleanText(input.category, 100);
  const serviceAreaMode = cleanText(input.serviceAreaMode, 20) || "storefront";
  if (!name) throw new BusinessDirectoryError("Business name is required.", 400, "business_name_required");
  if (description.length < 20) {
    throw new BusinessDirectoryError("Add at least 20 characters describing the business.", 400, "business_description_required");
  }
  if (!category) throw new BusinessDirectoryError("Choose a business category.", 400, "business_category_required");
  if (!["storefront", "mobile", "online", "hybrid"].includes(serviceAreaMode)) {
    throw new BusinessDirectoryError("Choose a valid service-area type.", 400, "invalid_service_area_mode");
  }

  const city = cleanText(input.city, 100);
  const serviceAreas = cleanStringArray(input.serviceAreas, 20, 100);
  if (serviceAreaMode !== "online" && !city && serviceAreas.length === 0) {
    throw new BusinessDirectoryError("Add a city or at least one service area.", 400, "business_location_required");
  }

  const radiusValue = asNumber(input.serviceRadiusMiles);
  return {
    row: {
      name,
      description,
      category,
      phone: cleanText(input.phone, 60),
      contact_email: cleanEmail(input.contactEmail),
      website_url: cleanUrl(input.websiteUrl),
      booking_url: cleanUrl(input.bookingUrl),
      logo_url: cleanUrl(input.logoUrl),
      cover_image_url: cleanUrl(input.coverImageUrl),
      address_line_1: cleanText(input.addressLine1, 200),
      address_line_2: cleanText(input.addressLine2, 200),
      city,
      region: cleanText(input.region, 100),
      postal_code: cleanText(input.postalCode, 30),
      country_code: (cleanText(input.countryCode, 2) || "US").toUpperCase(),
      service_area_mode: serviceAreaMode,
      service_radius_miles: radiusValue > 0 ? Math.min(Math.round(radiusValue), 1000) : null,
      service_areas: serviceAreas,
      show_exact_address: asBoolean(input.showExactAddress),
    },
    services: normalizeServices(input.services),
  };
}

async function uniqueSlug(service: SupabaseClient, name: string) {
  const base = slugify(name);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = attempt === 0
      ? base
      : `${base.slice(0, 63)}-${crypto.randomUUID().slice(0, 7)}`;
    const { data } = await service
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
  }
  return `${base.slice(0, 58)}-${crypto.randomUUID().slice(0, 12)}`;
}

async function replaceServices(
  service: SupabaseClient,
  businessId: string,
  services: ReturnType<typeof normalizeServices>,
  userId: string
) {
  const { error } = await service.rpc("replace_local_business_services", {
    target_business_id: businessId,
    actor_user_id: userId,
    services_payload: services,
  });

  if (error) {
    throw new BusinessDirectoryError(
      error.message || "Unable to update business services.",
      503,
      "service_update_failed"
    );
  }
}

export async function createBusiness(request: NextRequest, input: BusinessInput) {
  const viewer = await resolveViewer(request, true);
  const normalized = normalizeBusinessInput(input);
  const unclaimed = viewer.isAdmin && asBoolean(input.unclaimed);
  const publishNow = viewer.isAdmin && asBoolean(input.publishNow);
  const slug = await uniqueSlug(viewer.service, normalized.row.name);

  const { data, error } = await viewer.service
    .from("businesses")
    .insert({
      ...normalized.row,
      slug,
      owner_id: unclaimed ? null : viewer.user!.id,
      created_by: viewer.user!.id,
      status: publishNow ? "published" : "pending",
      published_at: publishNow ? new Date().toISOString() : null,
      verification_status: publishNow && asBoolean(input.verified)
        ? "verified"
        : "unverified",
      claimed_at: unclaimed ? null : new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    const duplicate = error?.code === "23505";
    throw new BusinessDirectoryError(
      duplicate ? "A business with this web address already exists." : "Unable to create the business listing.",
      duplicate ? 409 : 503,
      duplicate ? "business_exists" : "business_create_failed"
    );
  }

  try {
    await replaceServices(viewer.service, cleanText(data.id, 60), normalized.services, viewer.user!.id);
  } catch (serviceError) {
    await viewer.service.from("businesses").delete().eq("id", data.id);
    throw serviceError;
  }

  return { id: data.id, slug, status: publishNow ? "published" : "pending" };
}

async function requireBusinessControl(
  viewer: BusinessViewer,
  businessId: string
) {
  const { data, error } = await viewer.service
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new BusinessDirectoryError("Unable to verify the business listing.", 503, "business_access_unavailable");
  if (!data) throw new BusinessDirectoryError("Business not found.", 404, "business_not_found");
  if (!viewer.isAdmin && cleanText(data.owner_id, 60) !== viewer.user!.id) {
    throw new BusinessDirectoryError("You do not control this business listing.", 403, "business_forbidden");
  }
  return data as Record<string, unknown>;
}

export async function updateBusiness(request: NextRequest, input: BusinessInput) {
  const viewer = await resolveViewer(request, true);
  const businessId = cleanUuid(input.businessId, "business id");
  const current = await requireBusinessControl(viewer, businessId);
  const normalized = normalizeBusinessInput(input);
  const publishNow = viewer.isAdmin && asBoolean(input.publishNow);
  const nextStatus = publishNow
    ? "published"
    : viewer.isAdmin
      ? cleanText(input.status, 20) || cleanText(current.status, 20) || "pending"
      : "pending";

  if (!["draft", "pending", "published", "rejected", "suspended"].includes(nextStatus)) {
    throw new BusinessDirectoryError("Invalid listing status.", 400, "invalid_business_status");
  }

  const { error } = await viewer.service
    .from("businesses")
    .update({
      ...normalized.row,
      status: nextStatus,
      moderation_reason: viewer.isAdmin ? cleanLongText(input.moderationReason, 2000) || null : null,
      published_at:
        nextStatus === "published"
          ? cleanText(current.published_at, 60) || new Date().toISOString()
          : cleanText(current.published_at, 60) || null,
      ...(viewer.isAdmin && asBoolean(input.verified)
        ? { verification_status: "verified" }
        : {}),
    })
    .eq("id", businessId);

  if (error) throw new BusinessDirectoryError("Unable to update the business listing.", 503, "business_update_failed");
  await replaceServices(viewer.service, businessId, normalized.services, viewer.user!.id);
  return { id: businessId, status: nextStatus };
}

export async function claimBusiness(request: NextRequest, input: BusinessInput) {
  const viewer = await resolveViewer(request, true);
  const businessId = cleanUuid(input.businessId, "business id");
  const contactEmail = cleanEmail(input.contactEmail);
  const evidence = cleanLongText(input.evidence, 5000);
  if (!contactEmail || evidence.length < 20) {
    throw new BusinessDirectoryError(
      "Provide a business email and at least 20 characters explaining your connection.",
      400,
      "claim_evidence_required"
    );
  }

  const { data: business } = await viewer.service
    .from("businesses")
    .select("id, owner_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) throw new BusinessDirectoryError("Business not found.", 404, "business_not_found");
  const currentOwnerId = cleanText(business.owner_id, 60);
  if (currentOwnerId === viewer.user!.id) {
    throw new BusinessDirectoryError("You already control this listing.", 409, "already_owner");
  }
  if (currentOwnerId) {
    throw new BusinessDirectoryError(
      "This listing is already claimed. Report an ownership problem for administrator review.",
      409,
      "business_already_claimed"
    );
  }

  const { data: existing } = await viewer.service
    .from("business_claims")
    .select("id")
    .eq("business_id", businessId)
    .eq("claimant_id", viewer.user!.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) throw new BusinessDirectoryError("Your claim is already under review.", 409, "claim_pending");

  const { error } = await viewer.service.from("business_claims").insert({
    business_id: businessId,
    claimant_id: viewer.user!.id,
    contact_email: contactEmail,
    evidence,
    status: "pending",
  });
  if (error) throw new BusinessDirectoryError("Unable to submit the claim.", 503, "claim_failed");
  return { submitted: true };
}

export async function reportBusiness(request: NextRequest, input: BusinessInput) {
  const viewer = await resolveViewer(request, true);
  const businessId = cleanUuid(input.businessId, "business id");
  const reason = cleanText(input.reason, 120);
  const details = cleanLongText(input.details, 3000);
  if (!reason || details.length < 10) {
    throw new BusinessDirectoryError("Choose a reason and explain the concern.", 400, "report_details_required");
  }

  const { data: business } = await viewer.service
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("status", "published")
    .maybeSingle();
  if (!business) throw new BusinessDirectoryError("Business not found.", 404, "business_not_found");

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await viewer.service
    .from("business_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", viewer.user!.id)
    .gte("created_at", oneHourAgo);
  if ((count ?? 0) >= 10) {
    throw new BusinessDirectoryError("You have reached the directory report limit for this hour.", 429, "report_rate_limited");
  }

  const { error } = await viewer.service.from("business_reports").insert({
    business_id: businessId,
    reporter_id: viewer.user!.id,
    reason,
    details,
    status: "open",
  });
  if (error) throw new BusinessDirectoryError("Unable to submit the report.", 503, "report_failed");
  return { submitted: true };
}

async function requireAdmin(request: NextRequest) {
  const viewer = await resolveViewer(request, true);
  if (!viewer.isAdmin) {
    throw new BusinessDirectoryError("Administrator access is required.", 403, "admin_required");
  }
  return viewer;
}

export async function moderateBusiness(request: NextRequest, input: BusinessInput) {
  const viewer = await requireAdmin(request);
  const businessId = cleanUuid(input.businessId, "business id");
  const decision = cleanText(input.decision, 30);
  const note = cleanLongText(input.note, 2000);
  await requireBusinessControl(viewer, businessId);

  const updates: Record<string, unknown> = {
    moderation_reason: note || null,
  };
  if (decision === "approve") {
    updates.status = "published";
    updates.published_at = new Date().toISOString();
  } else if (decision === "reject") {
    updates.status = "rejected";
  } else if (decision === "suspend") {
    updates.status = "suspended";
  } else if (decision === "verify") {
    updates.verification_status = "verified";
    updates.status = "published";
    updates.published_at = new Date().toISOString();
  } else if (decision === "unverify") {
    updates.verification_status = "unverified";
  } else {
    throw new BusinessDirectoryError("Invalid moderation decision.", 400, "invalid_moderation_decision");
  }

  const { error } = await viewer.service.from("businesses").update(updates).eq("id", businessId);
  if (error) throw new BusinessDirectoryError("Unable to moderate the business.", 503, "moderation_failed");
  return { updated: true };
}

export async function reviewBusinessClaim(request: NextRequest, input: BusinessInput) {
  const viewer = await requireAdmin(request);
  const claimId = cleanUuid(input.claimId, "claim id");
  const decision = cleanText(input.decision, 20);
  if (!["approve", "reject"].includes(decision)) {
    throw new BusinessDirectoryError("Invalid claim decision.", 400, "invalid_claim_decision");
  }

  const { data, error } = await viewer.service.rpc("review_local_business_claim", {
    target_claim_id: claimId,
    reviewer_user_id: viewer.user!.id,
    approve_claim: decision === "approve",
    review_note: cleanLongText(input.note, 2000) || null,
  });
  if (error) throw new BusinessDirectoryError(error.message || "Unable to review the claim.", 503, "claim_review_failed");
  return data ?? { updated: true };
}

export async function reviewBusinessReport(request: NextRequest, input: BusinessInput) {
  const viewer = await requireAdmin(request);
  const reportId = cleanUuid(input.reportId, "report id");
  const decision = cleanText(input.decision, 20);
  if (!["resolve", "dismiss"].includes(decision)) {
    throw new BusinessDirectoryError("Invalid report decision.", 400, "invalid_report_decision");
  }

  const { error } = await viewer.service
    .from("business_reports")
    .update({
      status: decision === "resolve" ? "resolved" : "dismissed",
      reviewed_by: viewer.user!.id,
      reviewed_at: new Date().toISOString(),
      decision_note: cleanLongText(input.note, 2000) || null,
    })
    .eq("id", reportId)
    .eq("status", "open");

  if (error) throw new BusinessDirectoryError("Unable to review the report.", 503, "report_review_failed");
  return { updated: true };
}
