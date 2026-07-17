import "server-only";

import type { NextRequest } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  MarketplaceError,
  type MarketplaceInput,
  cleanLongText,
  cleanMarketplaceText,
  cleanUuid,
} from "@/lib/marketplace-server-core";
import {
  normalizeInput,
  refreshExpiredListings,
  requireMarketplacePhotoOrigins,
  requireBusinessAttribution,
  requireListingControl,
  resolveMarketplaceViewer,
  uniqueListingSlug,
} from "@/lib/marketplace-server-access";

export async function createMarketplaceListing(
  request: NextRequest,
  input: MarketplaceInput
) {
  const viewer = await resolveMarketplaceViewer(request, true);
  await refreshExpiredListings(viewer.service);
  const normalized = normalizeInput(input, viewer.user!.id);
  requireMarketplacePhotoOrigins(
    viewer.service,
    normalized.row.photo_urls,
    normalized.row.photo_paths
  );
  await requireBusinessAttribution(viewer, normalized.businessId);
  const slug = await uniqueListingSlug(
    viewer.service,
    normalized.row.title as string
  );

  const { data, error } = await viewer.service
    .from("marketplace_listings")
    .insert({
      ...normalized.row,
      seller_id: viewer.user!.id,
      business_id: normalized.businessId,
      slug,
      status: "pending",
      moderation_reason: null,
      published_at: null,
      sold_at: null,
      removed_at: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new MarketplaceError(
      "Unable to create the Marketplace listing.",
      503,
      "listing_create_failed"
    );
  }
  return { id: data.id, slug, status: "pending" };
}

export async function updateMarketplaceListing(
  request: NextRequest,
  input: MarketplaceInput
) {
  const viewer = await resolveMarketplaceViewer(request, true);
  await refreshExpiredListings(viewer.service);
  const listingId = cleanUuid(input.listingId, "listing id");
  const current = await requireListingControl(viewer, listingId);
  const normalized = normalizeInput(input, viewer.user!.id);
  requireMarketplacePhotoOrigins(
    viewer.service,
    normalized.row.photo_urls,
    normalized.row.photo_paths
  );
  await requireBusinessAttribution(viewer, normalized.businessId);

  const currentStatus = cleanMarketplaceText(current.status, 20);
  if (["sold", "removed"].includes(currentStatus)) {
    throw new MarketplaceError(
      "Reopen the listing before editing it.",
      409,
      "listing_reopen_required"
    );
  }

  const { error } = await viewer.service
    .from("marketplace_listings")
    .update({
      ...normalized.row,
      business_id: normalized.businessId,
      status: "pending",
      moderation_reason: null,
      sold_at: null,
      removed_at: null,
    })
    .eq("id", listingId);

  if (error) {
    throw new MarketplaceError(
      "Unable to update the Marketplace listing.",
      503,
      "listing_update_failed"
    );
  }
  return { id: listingId, status: "pending" };
}

export async function markMarketplaceListingSold(
  request: NextRequest,
  input: MarketplaceInput
) {
  const viewer = await resolveMarketplaceViewer(request, true);
  const listingId = cleanUuid(input.listingId, "listing id");
  await requireListingControl(viewer, listingId);
  const { error } = await viewer.service
    .from("marketplace_listings")
    .update({
      status: "sold",
      sold_at: new Date().toISOString(),
      moderation_reason: null,
    })
    .eq("id", listingId);
  if (error) {
    throw new MarketplaceError(
      "Unable to mark the listing sold.",
      503,
      "listing_sold_failed"
    );
  }
  return { updated: true, status: "sold" };
}

export async function reopenMarketplaceListing(
  request: NextRequest,
  input: MarketplaceInput
) {
  const viewer = await resolveMarketplaceViewer(request, true);
  const listingId = cleanUuid(input.listingId, "listing id");
  await requireListingControl(viewer, listingId);
  const { error } = await viewer.service
    .from("marketplace_listings")
    .update({
      status: "pending",
      sold_at: null,
      removed_at: null,
      moderation_reason: null,
    })
    .eq("id", listingId);
  if (error) {
    throw new MarketplaceError(
      "Unable to reopen the listing.",
      503,
      "listing_reopen_failed"
    );
  }
  return { updated: true, status: "pending" };
}

export async function removeMarketplaceListing(
  request: NextRequest,
  input: MarketplaceInput
) {
  const viewer = await resolveMarketplaceViewer(request, true);
  const listingId = cleanUuid(input.listingId, "listing id");
  await requireListingControl(viewer, listingId);
  const { error } = await viewer.service
    .from("marketplace_listings")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
      moderation_reason: null,
    })
    .eq("id", listingId);
  if (error) {
    throw new MarketplaceError(
      "Unable to remove the listing.",
      503,
      "listing_remove_failed"
    );
  }
  return { updated: true, status: "removed" };
}

export async function reportMarketplaceListing(
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
    .eq("status", "published")
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

async function requireAdmin(request: NextRequest) {
  const viewer = await resolveMarketplaceViewer(request, true);
  if (!viewer.isAdmin) {
    throw new MarketplaceError(
      "Administrator access is required.",
      403,
      "admin_required"
    );
  }
  return viewer;
}

export async function moderateMarketplaceListing(
  request: NextRequest,
  input: MarketplaceInput
) {
  const viewer = await requireAdmin(request);
  const listingId = cleanUuid(input.listingId, "listing id");
  const decision = cleanMarketplaceText(input.decision, 30);
  const note = cleanLongText(input.note, 2000);
  const { data: listing, error: listingError } = await viewer.service
    .from("marketplace_listings")
    .select("id, seller_id, business_id, published_at")
    .eq("id", listingId)
    .maybeSingle();
  if (listingError || !listing) {
    throw new MarketplaceError("Listing not found.", 404, "listing_not_found");
  }
  if (decision === "approve") {
    const { data: seller } = await viewer.service
      .from("profiles")
      .select("account_status, enforcement_reason, suspended_until")
      .eq("id", listing.seller_id)
      .maybeSingle();
    const sellerAccess = getAccountEnforcementResult(seller);
    if (!sellerAccess.allowed) {
      throw new MarketplaceError(
        "The seller account is not eligible for a public Marketplace listing.",
        409,
        "seller_not_eligible"
      );
    }

    if (listing.business_id) {
      const { data: business } = await viewer.service
        .from("businesses")
        .select("owner_id, status")
        .eq("id", listing.business_id)
        .maybeSingle();
      if (
        !business ||
        cleanMarketplaceText(business.status, 20) !== "published" ||
        cleanMarketplaceText(business.owner_id, 60) !==
          cleanMarketplaceText(listing.seller_id, 60)
      ) {
        throw new MarketplaceError(
          "The attributed business must remain published and controlled by the seller before approval.",
          409,
          "business_not_approved"
        );
      }
    }
  }

  const updates: Record<string, unknown> = {
    moderation_reason: note || null,
  };
  if (decision === "approve") {
    updates.status = "published";
    updates.published_at =
      cleanMarketplaceText(listing.published_at, 60) || new Date().toISOString();
    updates.sold_at = null;
    updates.removed_at = null;
  } else if (decision === "reject") {
    updates.status = "rejected";
  } else if (decision === "suspend") {
    updates.status = "suspended";
  } else if (decision === "remove") {
    updates.status = "removed";
    updates.removed_at = new Date().toISOString();
  } else {
    throw new MarketplaceError(
      "Invalid moderation decision.",
      400,
      "invalid_moderation_decision"
    );
  }

  const { error } = await viewer.service
    .from("marketplace_listings")
    .update(updates)
    .eq("id", listingId);
  if (error) {
    throw new MarketplaceError(
      "Unable to moderate the Marketplace listing.",
      503,
      "moderation_failed"
    );
  }
  return { updated: true };
}

export async function reviewMarketplaceReport(
  request: NextRequest,
  input: MarketplaceInput
) {
  const viewer = await requireAdmin(request);
  const reportId = cleanUuid(input.reportId, "report id");
  const decision = cleanMarketplaceText(input.decision, 20);
  const note = cleanLongText(input.note, 2000);
  if (!["resolve", "dismiss"].includes(decision)) {
    throw new MarketplaceError(
      "Invalid report decision.",
      400,
      "invalid_report_decision"
    );
  }
  const { error } = await viewer.service
    .from("marketplace_reports")
    .update({
      status: decision === "resolve" ? "resolved" : "dismissed",
      reviewed_by: viewer.user!.id,
      reviewed_at: new Date().toISOString(),
      decision_note: note || null,
    })
    .eq("id", reportId)
    .eq("status", "open");
  if (error) {
    throw new MarketplaceError(
      "Unable to review the Marketplace report.",
      503,
      "report_review_failed"
    );
  }
  return { updated: true };
}
