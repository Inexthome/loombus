import "server-only";

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BusinessClaim,
  BusinessManageResponse,
  BusinessProfile,
  BusinessReport,
} from "@/lib/business-directory";
import {
  BUSINESS_SELECT,
  BusinessDirectoryError,
  cleanLongText,
  cleanText,
  MAX_DIRECTORY_ROWS,
  normalizeBusiness,
  publicBusinessScore,
  resolveViewer,
  asNumber,
} from "@/lib/business-directory-server-shared";

export async function listPublicBusinesses(
  request: NextRequest,
  filters: { query?: unknown; category?: unknown; city?: unknown; limit?: unknown }
) {
  const { service } = await resolveViewer(request, false);
  const query = cleanText(filters.query, 160).toLowerCase();
  const category = cleanText(filters.category, 100).toLowerCase();
  const city = cleanText(filters.city, 100).toLowerCase();
  const limit = Math.min(Math.max(asNumber(filters.limit) || 48, 1), 80);

  const { data, error } = await service
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(MAX_DIRECTORY_ROWS);

  if (error) {
    const missing = error.code === "42P01" || /businesses.*does not exist/i.test(error.message ?? "");
    if (missing) return { businesses: [], directoryActive: false };
    throw new BusinessDirectoryError("The business directory could not load.", 503, "directory_unavailable");
  }

  const businesses = (data ?? [])
    .map((row) => normalizeBusiness(row as Record<string, unknown>))
    .map((business) => ({
      ...business,
      addressLine1: business.showExactAddress ? business.addressLine1 : "",
      addressLine2: business.showExactAddress ? business.addressLine2 : "",
      services: business.services.filter((service) => service.status === "active"),
    }))
    .filter((business) => !category || business.category.toLowerCase() === category)
    .filter((business) => {
      if (!city) return true;
      return [
        business.city,
        business.region,
        business.postalCode,
        ...business.serviceAreas,
      ].some((value) => value.toLowerCase().includes(city));
    })
    .map((business) => ({ business, score: publicBusinessScore(business, query) }))
    .filter(({ score }) => !query || score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ business }) => business);

  return { businesses, directoryActive: true };
}

export async function getPublicBusiness(request: NextRequest, rawSlug: unknown) {
  const { service } = await resolveViewer(request, false);
  const slug = cleanText(rawSlug, 100).toLowerCase();
  if (!slug) throw new BusinessDirectoryError("Business not found.", 404, "business_not_found");

  const { data, error } = await service
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    const missing = error.code === "42P01";
    if (missing) throw new BusinessDirectoryError("The directory is not active yet.", 503, "directory_unavailable");
    throw new BusinessDirectoryError("Unable to load this business.", 503, "business_unavailable");
  }
  if (!data) throw new BusinessDirectoryError("Business not found.", 404, "business_not_found");

  const business = normalizeBusiness(data as Record<string, unknown>);
  business.services = business.services.filter((service) => service.status === "active");
  if (!business.showExactAddress) {
    business.addressLine1 = "";
    business.addressLine2 = "";
  }
  return business;
}

async function profileNames(service: SupabaseClient, ids: string[]) {
  const cleanIds = [...new Set(ids.filter(Boolean))];
  const names = new Map<string, string>();
  if (cleanIds.length === 0) return names;
  const { data } = await service
    .from("profiles")
    .select("id, full_name, username")
    .in("id", cleanIds);
  for (const profile of data ?? []) {
    names.set(
      cleanText(profile.id, 60),
      cleanText(profile.full_name, 160) || cleanText(profile.username, 100) || "Loombus member"
    );
  }
  return names;
}

function normalizeClaim(
  row: Record<string, unknown>,
  businessNames: Map<string, string>,
  claimantNames: Map<string, string>
): BusinessClaim {
  const businessId = cleanText(row.business_id, 60);
  const claimantId = cleanText(row.claimant_id, 60);
  const status = cleanText(row.status, 20);
  return {
    id: cleanText(row.id, 60),
    businessId,
    businessName: businessNames.get(businessId) ?? "Business listing",
    claimantId,
    claimantName: claimantNames.get(claimantId) ?? "Loombus member",
    contactEmail: cleanText(row.contact_email, 254),
    evidence: cleanLongText(row.evidence, 5000),
    status: ["pending", "approved", "rejected"].includes(status)
      ? (status as BusinessClaim["status"])
      : "pending",
    decisionNote: cleanLongText(row.decision_note, 2000),
    createdAt: cleanText(row.created_at, 60) || null,
  };
}

function normalizeReport(
  row: Record<string, unknown>,
  businessNames: Map<string, string>
): BusinessReport {
  const businessId = cleanText(row.business_id, 60);
  const status = cleanText(row.status, 20);
  return {
    id: cleanText(row.id, 60),
    businessId,
    businessName: businessNames.get(businessId) ?? "Business listing",
    reporterId: cleanText(row.reporter_id, 60),
    reason: cleanText(row.reason, 120),
    details: cleanLongText(row.details, 3000),
    status: ["open", "resolved", "dismissed"].includes(status)
      ? (status as BusinessReport["status"])
      : "open",
    createdAt: cleanText(row.created_at, 60) || null,
  };
}

export async function getBusinessManageData(request: NextRequest): Promise<BusinessManageResponse> {
  const viewer = await resolveViewer(request, true);
  const userId = viewer.user!.id;

  const businessQuery = viewer.service
    .from("businesses")
    .select(BUSINESS_SELECT)
    .order("updated_at", { ascending: false });

  const [businessResult, claimResult] = await Promise.all([
    viewer.isAdmin
      ? businessQuery.or(`owner_id.eq.${userId},created_by.eq.${userId}`)
      : businessQuery.eq("owner_id", userId),
    viewer.service
      .from("business_claims")
      .select("*")
      .eq("claimant_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (businessResult.error || claimResult.error) {
    const message = businessResult.error?.message ?? claimResult.error?.message ?? "";
    if (/does not exist/i.test(message)) {
      throw new BusinessDirectoryError("The directory migration has not been applied.", 503, "directory_unavailable");
    }
    throw new BusinessDirectoryError("Unable to load business management.", 503, "manage_unavailable");
  }

  const businesses = (businessResult.data ?? []).map((row) =>
    normalizeBusiness(row as Record<string, unknown>)
  );
  const userClaims = (claimResult.data ?? []) as Record<string, unknown>[];

  let pendingBusinesses: BusinessProfile[] = [];
  let pendingClaimsRows: Record<string, unknown>[] = [];
  let openReportRows: Record<string, unknown>[] = [];

  if (viewer.isAdmin) {
    const [pendingResult, claimsResult, reportsResult] = await Promise.all([
      viewer.service
        .from("businesses")
        .select(BUSINESS_SELECT)
        .in("status", ["pending", "rejected", "suspended"])
        .order("updated_at", { ascending: false })
        .limit(100),
      viewer.service
        .from("business_claims")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(100),
      viewer.service
        .from("business_reports")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(100),
    ]);

    if (pendingResult.error || claimsResult.error || reportsResult.error) {
      throw new BusinessDirectoryError("Unable to load the moderation queue.", 503, "moderation_unavailable");
    }

    pendingBusinesses = (pendingResult.data ?? []).map((row) =>
      normalizeBusiness(row as Record<string, unknown>)
    );
    pendingClaimsRows = (claimsResult.data ?? []) as Record<string, unknown>[];
    openReportRows = (reportsResult.data ?? []) as Record<string, unknown>[];
  }

  const allClaimRows = [...userClaims, ...pendingClaimsRows];
  const businessIds = [
    ...new Set([
      ...allClaimRows.map((row) => cleanText(row.business_id, 60)),
      ...openReportRows.map((row) => cleanText(row.business_id, 60)),
    ].filter(Boolean)),
  ];
  const claimantIds = [
    ...new Set(allClaimRows.map((row) => cleanText(row.claimant_id, 60)).filter(Boolean)),
  ];

  const [businessNameResult, claimantNames] = await Promise.all([
    businessIds.length
      ? viewer.service.from("businesses").select("id, name").in("id", businessIds)
      : Promise.resolve({ data: [], error: null }),
    profileNames(viewer.service, claimantIds),
  ]);
  const businessNames = new Map<string, string>();
  for (const row of businessNameResult.data ?? []) {
    businessNames.set(cleanText(row.id, 60), cleanText(row.name, 200));
  }

  return {
    authenticated: true,
    isAdmin: viewer.isAdmin,
    businesses,
    claims: userClaims.map((row) => normalizeClaim(row, businessNames, claimantNames)),
    moderation: {
      pendingBusinesses,
      pendingClaims: pendingClaimsRows.map((row) =>
        normalizeClaim(row, businessNames, claimantNames)
      ),
      openReports: openReportRows.map((row) => normalizeReport(row, businessNames)),
    },
  };
}

