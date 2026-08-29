import "server-only";

import type { NextRequest } from "next/server";
import {
  MarketplaceError,
  type MarketplaceInput,
  cleanLongText,
  cleanMarketplaceText,
  cleanUuid,
} from "@/lib/marketplace-server-core";
import {
  refreshExpiredListings,
  requireListingControl,
  resolveMarketplaceViewer,
} from "@/lib/marketplace-server-access";

async function requireOwnedListingStatus(
  request: NextRequest,
  input: MarketplaceInput,
  allowedStatuses: string[],
  message: string
) {
  const viewer = await resolveMarketplaceViewer(request, true);
  await refreshExpiredListings(viewer.service);
  const listingId = cleanUuid(input.listingId, "listing id");
  const listing = await requireListingControl(viewer, listingId);
  const status = cleanMarketplaceText(listing.status, 20);

  if (!allowedStatuses.includes(status)) {
    throw new MarketplaceError(message, 409, "invalid_listing_status");
  }

  return { viewer, listingId, status };
}

async function updateListingStatus(options: {
  request: NextRequest;
  input: MarketplaceInput;
  allowedStatuses: string[];
  nextStatus: string;
  invalidStatusMessage: string;
  failureMessage: string;
  failureCode: string;
  updates?: Record<string, unknown>;
}) {
  const { viewer, listingId, status } = await requireOwnedListingStatus(
    options.request,
    options.input,
    options.allowedStatuses,
    options.invalidStatusMessage
  );

  const { data, error } = await viewer.service
    .from("marketplace_listings")
    .update({ status: options.nextStatus, ...options.updates })
    .eq("id", listingId)
    .eq("status", status)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new MarketplaceError(
      options.failureMessage,
      503,
      options.failureCode
    );
  }
  if (!data) {
    throw new MarketplaceError(
      "The listing changed while this action was being completed. Refresh and try again.",
      409,
      "listing_status_changed"
    );
  }

  return { updated: true, status: options.nextStatus };
}

export async function reserveMarketplaceListing(
  request: NextRequest,
  input: MarketplaceInput
) {
  return updateListingStatus({
    request,
    input,
    allowedStatuses: ["published"],
    nextStatus: "reserved",
    invalidStatusMessage: "Only a published listing can be reserved.",
    failureMessage: "Unable to reserve the listing.",
    failureCode: "listing_reserve_failed",
    updates: { moderation_reason: null },
  });
}

export async function releaseMarketplaceListing(
  request: NextRequest,
  input: MarketplaceInput
) {
  return updateListingStatus({
    request,
    input,
    allowedStatuses: ["reserved"],
    nextStatus: "published",
    invalidStatusMessage: "Only a reserved listing can be released.",
    failureMessage: "Unable to release the reservation.",
    failureCode: "listing_release_failed",
    updates: { moderation_reason: null },
  });
}

export async function markMarketplaceListingSoldSafely(
  request: NextRequest,
  input: MarketplaceInput
) {
  return updateListingStatus({
    request,
    input,
    allowedStatuses: ["published", "reserved"],
    nextStatus: "sold",
    invalidStatusMessage: "Only a published or reserved listing can be marked sold.",
    failureMessage: "Unable to mark the listing sold.",
    failureCode: "listing_sold_failed",
    updates: {
      sold_at: new Date().toISOString(),
      moderation_reason: null,
    },
  });
}

export async function reopenMarketplaceListingSafely(
  request: NextRequest,
  input: MarketplaceInput
) {
  return updateListingStatus({
    request,
    input,
    allowedStatuses: ["sold", "expired", "removed"],
    nextStatus: "pending",
    invalidStatusMessage: "Only a sold, expired, or removed listing can be reopened.",
    failureMessage: "Unable to reopen the listing.",
    failureCode: "listing_reopen_failed",
    updates: {
      sold_at: null,
      removed_at: null,
      moderation_reason: null,
    },
  });
}

export async function reportMarketplaceListingWithReserved(
  request: NextRequest,
  input: MarketplaceInput
) {
  const viewer = await resolveMarketplaceViewer(request, true);
  await refreshExpiredListings(viewer.service);
  const listingId = cleanUuid(input.listingId, "listing id");
  const reason = cleanMarketplaceText(input.reason, 120);
  const details = cleanLongText(input.details, 3000);
  if (!reason || details.length < 10) {
    throw new MarketplaceError(
      "Choose a reason and explain the concern.",
      400,
      "report_details_required"
    );
  }

  const { data: listing } = await viewer.service
    .from("marketplace_listings")
    .select("id")
    .eq("id", listingId)
    .in("status", ["published", "reserved"])
    .maybeSingle();
  if (!listing) {
    throw new MarketplaceError("Listing not found.", 404, "listing_not_found");
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await viewer.service
    .from("marketplace_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", viewer.user!.id)
    .gte("created_at", oneHourAgo);
  if ((count ?? 0) >= 10) {
    throw new MarketplaceError(
      "You have reached the Marketplace report limit for this hour.",
      429,
      "report_rate_limited"
    );
  }

  const { error } = await viewer.service.from("marketplace_reports").insert({
    listing_id: listingId,
    reporter_id: viewer.user!.id,
    reason,
    details,
    status: "open",
  });
  if (error) {
    throw new MarketplaceError(
      "Unable to submit the Marketplace report.",
      503,
      "report_failed"
    );
  }
  return { submitted: true };
}
