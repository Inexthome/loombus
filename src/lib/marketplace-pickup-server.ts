import "server-only";

import type { NextRequest } from "next/server";
import { createNotification } from "@/lib/notifications";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase, createRoomServiceSupabase } from "@/lib/room-operations";

type Input = Record<string, unknown>;
type Row = Record<string, any>;

export class MarketplacePickupError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "marketplace_pickup_error"
  ) {
    super(message);
  }
}

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function uuid(value: unknown, label: string) {
  const result = text(value, 60);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) {
    throw new MarketplacePickupError(`Invalid ${label}.`, 400, `invalid_${label.replaceAll(" ", "_")}`);
  }
  return result;
}

function isoDate(value: unknown) {
  const raw = text(value, 100);
  const date = new Date(raw);
  if (!raw || !Number.isFinite(date.getTime())) {
    throw new MarketplacePickupError("Choose a valid pickup time.", 400, "invalid_pickup_time");
  }
  return date.toISOString();
}

async function requireAdult(service: ReturnType<typeof createRoomServiceSupabase>, userId: string) {
  const { data } = await service
    .from("profile_sensitive")
    .select("age_band, guardian_required")
    .eq("id", userId)
    .maybeSingle();
  const ageBand = text(data?.age_band, 30) || "unknown";
  if (ageBand !== "adult" || data?.guardian_required) {
    throw new MarketplacePickupError(
      "Marketplace pickup scheduling is available only to age-verified adults.",
      403,
      "adult_required"
    );
  }
}

async function ensureNotBlocked(
  service: ReturnType<typeof createRoomServiceSupabase>,
  leftId: string,
  rightId: string
) {
  const { data } = await service
    .from("user_blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${leftId},blocked_id.eq.${rightId}),and(blocker_id.eq.${rightId},blocked_id.eq.${leftId})`
    )
    .limit(1);
  if ((data ?? []).length) {
    throw new MarketplacePickupError("Pickup scheduling is not available for this listing.", 403, "pickup_blocked");
  }
}

export async function requestMarketplacePickup(request: NextRequest, input: Input) {
  const requestClient = createRequestSupabase(request);
  const access = await verifyRequestAccountAccess(requestClient);
  if (!access.ok) {
    throw new MarketplacePickupError(access.error, access.status, access.code ?? "account_access_denied");
  }

  const service = createRoomServiceSupabase();
  const requesterId = access.user.id;
  const listingId = uuid(input.listingId, "listing id");
  const requestedStart = isoDate(input.requestedStart);
  if (new Date(requestedStart).getTime() < Date.now() + 30 * 60_000) {
    throw new MarketplacePickupError(
      "Choose a pickup time at least 30 minutes in the future.",
      400,
      "pickup_too_soon"
    );
  }

  const timezone = text(input.timezone, 100) || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
  } catch {
    throw new MarketplacePickupError("Choose a valid time zone.", 400, "invalid_pickup_timezone");
  }
  const note = text(input.note, 3000) || null;

  const { data: listing, error: listingError } = await service
    .from("marketplace_listings")
    .select("id, slug, title, seller_id, business_id, status, pickup_available")
    .eq("id", listingId)
    .eq("status", "published")
    .maybeSingle();
  if (listingError) {
    throw new MarketplacePickupError("Unable to verify this listing.", 503, "listing_unavailable");
  }
  if (!listing || !listing.pickup_available || !listing.business_id) {
    throw new MarketplacePickupError(
      "Pickup scheduling is not available for this listing.",
      409,
      "pickup_not_available"
    );
  }
  if (listing.seller_id === requesterId) {
    throw new MarketplacePickupError("You cannot schedule pickup for your own listing.", 400, "self_pickup_not_allowed");
  }

  const { data: business, error: businessError } = await service
    .from("businesses")
    .select("id, name, slug, owner_id, status")
    .eq("id", listing.business_id)
    .eq("owner_id", listing.seller_id)
    .eq("status", "published")
    .maybeSingle();
  if (businessError || !business) {
    throw new MarketplacePickupError(
      "The listing business is not currently eligible for pickup scheduling.",
      409,
      "pickup_business_unavailable"
    );
  }

  await Promise.all([
    requireAdult(service, requesterId),
    requireAdult(service, listing.seller_id),
    ensureNotBlocked(service, requesterId, listing.seller_id),
  ]);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from("business_appointment_requests")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", requesterId)
    .gte("created_at", since);
  if ((count ?? 0) >= 10) {
    throw new MarketplacePickupError(
      "You have reached the pickup request limit for this hour.",
      429,
      "pickup_rate_limited"
    );
  }

  let appointmentService: Row | null = null;
  const { data: existingService, error: serviceLookupError } = await service
    .from("business_appointment_services")
    .select("*")
    .eq("source_type", "marketplace_listing")
    .eq("source_id", listing.id)
    .eq("owner_id", listing.seller_id)
    .neq("status", "archived")
    .maybeSingle();
  if (serviceLookupError) {
    throw new MarketplacePickupError("Unable to prepare pickup scheduling.", 503, "pickup_service_unavailable");
  }
  appointmentService = existingService as Row | null;

  if (!appointmentService) {
    const { data: createdService, error: createError } = await service
      .from("business_appointment_services")
      .insert({
        business_id: business.id,
        owner_id: listing.seller_id,
        name: `Pickup: ${text(listing.title, 180)}`,
        description: `Schedule an in-person pickup for the Marketplace listing “${text(listing.title, 180)}”.`,
        duration_minutes: 30,
        location_mode: "in_person",
        location_text: "Confirm the exact pickup location with the seller.",
        instructions: "Confirm item condition, final price, identity, and safe meeting details directly with the seller.",
        status: "active",
        source_type: "marketplace_listing",
        source_id: listing.id,
        source_label: text(listing.title, 200),
        source_href: `/marketplace/${listing.slug}`,
      })
      .select("*")
      .single();
    if (createError || !createdService) {
      throw new MarketplacePickupError("Unable to prepare pickup scheduling.", 503, "pickup_service_create_failed");
    }
    appointmentService = createdService as Row;
  } else if (appointmentService.status !== "active") {
    const { data: reactivated, error: reactivateError } = await service
      .from("business_appointment_services")
      .update({ status: "active" })
      .eq("id", appointmentService.id)
      .eq("owner_id", listing.seller_id)
      .select("*")
      .single();
    if (reactivateError || !reactivated) {
      throw new MarketplacePickupError("Unable to prepare pickup scheduling.", 503, "pickup_service_reactivate_failed");
    }
    appointmentService = reactivated as Row;
  }

  const requestedEnd = new Date(new Date(requestedStart).getTime() + 30 * 60_000).toISOString();
  const { data: created, error: requestError } = await service
    .from("business_appointment_requests")
    .insert({
      service_id: appointmentService.id,
      business_id: business.id,
      provider_id: listing.seller_id,
      requester_id: requesterId,
      requested_start: requestedStart,
      requested_end: requestedEnd,
      timezone,
      note,
      status: "pending",
    })
    .select("id")
    .single();
  if (requestError || !created) {
    throw new MarketplacePickupError("Unable to send the pickup request.", 503, "pickup_request_failed");
  }

  await createNotification({
    user_id: listing.seller_id,
    actor_id: requesterId,
    type: "appointment_requested",
    target_type: "appointment_request",
    target_id: created.id,
    message: `New pickup request for ${text(listing.title, 160)}.`,
  });

  return { id: created.id, status: "pending", href: "/appointments" };
}
