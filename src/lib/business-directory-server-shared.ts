import "server-only";

import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  asBoolean,
  asNumber,
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

export { asBoolean, asNumber, asString };
import type {
  BusinessClaim,
  BusinessManageResponse,
  BusinessProfile,
  BusinessReport,
  BusinessService,
} from "@/lib/business-directory";

export const MAX_DIRECTORY_ROWS = 240;
// There is no product-level cap on the number of legitimate services a business may publish.
export const MAX_SERVICES = Number.POSITIVE_INFINITY;

export type BusinessViewer = {
  user: User | null;
  isAdmin: boolean;
  service: SupabaseClient;
};

export type BusinessInput = Record<string, unknown>;

export class BusinessDirectoryError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "business_directory_error") {
    super(message);
    this.name = "BusinessDirectoryError";
    this.status = status;
    this.code = code;
  }
}

export function cleanText(value: unknown, max = 500) {
  return asString(value).replace(/\s+/g, " ").slice(0, max);
}

export function cleanLongText(value: unknown, max = 5000) {
  return asString(value).replace(/\r\n/g, "\n").slice(0, max);
}

export function cleanEmail(value: unknown) {
  const email = cleanText(value, 254).toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BusinessDirectoryError("Enter a valid business email address.", 400, "invalid_email");
  }
  return email;
}

export function cleanUrl(value: unknown) {
  const url = cleanText(value, 2048);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
    return parsed.toString();
  } catch {
    throw new BusinessDirectoryError("Use a complete http or https web address.", 400, "invalid_url");
  }
}

export function cleanUuid(value: unknown, label = "id") {
  const id = cleanText(value, 60);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new BusinessDirectoryError(`Invalid ${label}.`, 400, "invalid_id");
  }
  return id;
}

export function cleanStringArray(value: unknown, _maxItems = 20, maxLength = 100) {
  if (!Array.isArray(value)) return [];
  void _maxItems;
  return [...new Set(
    value
      .map((item) => cleanText(item, maxLength))
      .filter(Boolean)
  )];
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "business";
}

export function normalizeService(row: Record<string, unknown>): BusinessService {
  const status = cleanText(row.status, 20);
  return {
    id: cleanText(row.id, 60),
    businessId: cleanText(row.business_id, 60),
    name: cleanText(row.name, 160),
    description: cleanLongText(row.description, 3000),
    category: cleanText(row.category, 100),
    priceText: cleanText(row.price_text, 100),
    bookingUrl: cleanText(row.booking_url, 2048),
    serviceArea: cleanText(row.service_area, 300),
    status: ["active", "paused", "archived"].includes(status)
      ? (status as BusinessService["status"])
      : "active",
    sortOrder: asNumber(row.sort_order),
  };
}

export function normalizeBusiness(row: Record<string, unknown>): BusinessProfile {
  const nested = Array.isArray(row.business_services)
    ? row.business_services
    : [];
  const mode = cleanText(row.service_area_mode, 20);
  const verification = cleanText(row.verification_status, 20);
  const status = cleanText(row.status, 20);

  return {
    id: cleanText(row.id, 60),
    ownerId: cleanText(row.owner_id, 60) || null,
    slug: cleanText(row.slug, 100),
    name: cleanText(row.name, 200),
    description: cleanLongText(row.description, 5000),
    category: cleanText(row.category, 100),
    phone: cleanText(row.phone, 60),
    contactEmail: cleanText(row.contact_email, 254),
    websiteUrl: cleanText(row.website_url, 2048),
    bookingUrl: cleanText(row.booking_url, 2048),
    logoUrl: cleanText(row.logo_url, 2048),
    coverImageUrl: cleanText(row.cover_image_url, 2048),
    addressLine1: cleanText(row.address_line_1, 200),
    addressLine2: cleanText(row.address_line_2, 200),
    city: cleanText(row.city, 100),
    region: cleanText(row.region, 100),
    postalCode: cleanText(row.postal_code, 30),
    countryCode: cleanText(row.country_code, 2) || "US",
    serviceAreaMode: ["storefront", "mobile", "online", "hybrid"].includes(mode)
      ? (mode as BusinessProfile["serviceAreaMode"])
      : "storefront",
    serviceRadiusMiles:
      row.service_radius_miles === null || row.service_radius_miles === undefined
        ? null
        : Math.max(0, asNumber(row.service_radius_miles)),
    serviceAreas: Array.isArray(row.service_areas)
      ? row.service_areas.map((item) => cleanText(item, 100)).filter(Boolean)
      : [],
    showExactAddress: asBoolean(row.show_exact_address),
    verificationStatus: ["unverified", "pending", "verified", "denied"].includes(verification)
      ? (verification as BusinessProfile["verificationStatus"])
      : "unverified",
    status: ["draft", "pending", "published", "rejected", "suspended"].includes(status)
      ? (status as BusinessProfile["status"])
      : "pending",
    moderationReason: cleanLongText(row.moderation_reason, 2000),
    claimedAt: cleanText(row.claimed_at, 60) || null,
    publishedAt: cleanText(row.published_at, 60) || null,
    createdAt: cleanText(row.created_at, 60) || null,
    updatedAt: cleanText(row.updated_at, 60) || null,
    services: nested
      .map((service) => normalizeService(service as Record<string, unknown>))
      .sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

export const BUSINESS_SELECT = `
  id,
  owner_id,
  created_by,
  slug,
  name,
  description,
  category,
  phone,
  contact_email,
  website_url,
  booking_url,
  logo_url,
  cover_image_url,
  address_line_1,
  address_line_2,
  city,
  region,
  postal_code,
  country_code,
  service_area_mode,
  service_radius_miles,
  service_areas,
  show_exact_address,
  verification_status,
  status,
  moderation_reason,
  claimed_at,
  published_at,
  created_at,
  updated_at,
  business_services (
    id,
    business_id,
    name,
    description,
    category,
    price_text,
    booking_url,
    service_area,
    status,
    sort_order
  )
`;

export async function resolveViewer(request: NextRequest, requireUser = false): Promise<BusinessViewer> {
  const requestClient = createRequestSupabase(request);
  const service = createRoomServiceSupabase();
  const {
    data: { user },
  } = await requestClient.auth.getUser();

  if (!user) {
    if (requireUser) {
      throw new BusinessDirectoryError("Sign in to manage a business listing.", 401, "authentication_required");
    }
    return { user: null, isAdmin: false, service };
  }

  const { data: profile, error } = await service
    .from("profiles")
    .select("is_admin, account_status, enforcement_reason, suspended_until")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    throw new BusinessDirectoryError("Unable to verify directory access.", 503, "directory_access_unavailable");
  }

  const enforcement = getAccountEnforcementResult(profile);
  if (!enforcement.allowed) {
    throw new BusinessDirectoryError(
      enforcement.errorMessage ?? "Account access is restricted.",
      403,
      enforcement.code ?? "account_restricted"
    );
  }

  return { user, isAdmin: Boolean(profile.is_admin), service };
}

export function publicBusinessScore(business: BusinessProfile, query: string) {
  if (!query) return business.verificationStatus === "verified" ? 1 : 0;
  const needle = query.toLowerCase();
  const searchable = [
    business.name,
    business.description,
    business.category,
    business.city,
    business.region,
    business.postalCode,
    ...business.serviceAreas,
    ...business.services.reduce<string[]>((values, service) => {
      values.push(
        service.name,
        service.description,
        service.category,
        service.serviceArea
      );
      return values;
    }, []),
  ].map((value) => value.toLowerCase());

  let score = 0;
  for (const value of searchable) {
    if (value === needle) score = Math.max(score, 4);
    else if (value.startsWith(needle)) score = Math.max(score, 3);
    else if (value.includes(needle)) score = Math.max(score, 1);
  }
  if (business.verificationStatus === "verified") score += 0.35;
  return score;
}
