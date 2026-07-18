import "server-only";

import type { NextRequest } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

export type ProviderServiceInput = Record<string, unknown>;
export type Row = Record<string, any>;
export type Service = ReturnType<typeof createRoomServiceSupabase>;
export type Viewer = {
  user: { id: string } | null;
  profile: Row | null;
  isAdmin: boolean;
  service: Service;
};

const MODES = new Set([
  "remote",
  "requester_location",
  "provider_location",
  "flexible",
]);
const PRICE_TYPES = new Set(["fixed", "range", "hourly", "contact"]);

export class ProviderServicesError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "provider_services_error",
  ) {
    super(message);
  }
}

export function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function cleanUuid(value: unknown, label: string) {
  const result = cleanText(value, 60);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      result,
    )
  ) {
    throw new ProviderServicesError(
      `Invalid ${label}.`,
      400,
      `invalid_${label.replaceAll(" ", "_")}`,
    );
  }
  return result;
}

export function optionalUuid(value: unknown, label: string) {
  const result = cleanText(value, 60);
  return result ? cleanUuid(result, label) : null;
}

export function optionalNumber(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > 100_000_000) {
    throw new ProviderServicesError(
      `Choose a valid ${label}.`,
      400,
      `invalid_${label.replaceAll(" ", "_")}`,
    );
  }
  return Math.round(result * 100) / 100;
}

export function optionalIso(value: unknown, label: string) {
  const raw = cleanText(value, 100);
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    throw new ProviderServicesError(
      `Choose a valid ${label}.`,
      400,
      `invalid_${label.replaceAll(" ", "_")}`,
    );
  }
  return date.toISOString();
}

export function stringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function slugBase(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "service"
  );
}

export async function uniqueProviderServiceSlug(
  service: Service,
  title: string,
  ignoreId?: string,
) {
  const base = slugBase(title);
  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    let query = service
      .from("provider_services")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    if (ignoreId) query = query.neq("id", ignoreId);
    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new ProviderServicesError(
        "Unable to prepare the Service URL.",
        503,
        "service_slug_unavailable",
      );
    }
    if (!data) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function resolveViewer(
  request: NextRequest,
  required: boolean,
): Promise<Viewer> {
  const client = createRequestSupabase(request);
  if (required) {
    const access = await verifyRequestAccountAccess(client);
    if (!access.ok) {
      throw new ProviderServicesError(
        access.error,
        access.status,
        access.code ?? "account_access_denied",
      );
    }
    return {
      user: access.user,
      profile: access.profile as Row,
      isAdmin: access.profile.is_admin === true,
      service: createRoomServiceSupabase(),
    };
  }
  const { data } = await client.auth.getUser();
  if (!data.user) {
    return {
      user: null,
      profile: null,
      isAdmin: false,
      service: createRoomServiceSupabase(),
    };
  }
  const { data: profile } = await client
    .from("profiles")
    .select("id, is_admin, account_status, enforcement_reason, suspended_until")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    user: data.user,
    profile: (profile ?? null) as Row | null,
    isAdmin: profile?.is_admin === true,
    service: createRoomServiceSupabase(),
  };
}

export async function requireProviderEligibility(
  service: Service,
  userId: string,
  action: string,
) {
  const [profileResult, sensitiveResult] = await Promise.all([
    service
      .from("profiles")
      .select("id, account_status, enforcement_reason, suspended_until")
      .eq("id", userId)
      .maybeSingle(),
    service
      .from("profile_sensitive")
      .select("age_band, guardian_required")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  if (
    !profileResult.data ||
    !getAccountEnforcementResult(profileResult.data).allowed
  ) {
    throw new ProviderServicesError(
      `This account cannot ${action}.`,
      403,
      "account_not_eligible",
    );
  }
  const ageBand = String(sensitiveResult.data?.age_band ?? "unknown");
  if (
    ageBand === "under_13" ||
    sensitiveResult.data?.guardian_required === true
  ) {
    throw new ProviderServicesError(
      "Loombus is not available to children under 13.",
      403,
      "under_13_not_allowed",
    );
  }
  if (sensitiveResult.error || ageBand === "unknown") {
    throw new ProviderServicesError(
      `Complete age safety before you ${action}.`,
      403,
      "age_gate_required",
    );
  }
}

export async function ensureNotBlocked(
  service: Service,
  leftId: string,
  rightId: string,
) {
  const { data } = await service
    .from("user_blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${leftId},blocked_id.eq.${rightId}),and(blocker_id.eq.${rightId},blocked_id.eq.${leftId})`,
    )
    .limit(1);
  if ((data ?? []).length) {
    throw new ProviderServicesError(
      "This Service interaction is not available.",
      403,
      "service_interaction_blocked",
    );
  }
}

export async function requireOwnedPublishedBusiness(
  service: Service,
  businessId: string,
  ownerId: string,
) {
  const { data, error } = await service
    .from("businesses")
    .select("id, name, slug, owner_id, status")
    .eq("id", businessId)
    .eq("owner_id", ownerId)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    throw new ProviderServicesError(
      "Unable to verify the business profile.",
      503,
      "business_unavailable",
    );
  }
  if (!data) {
    throw new ProviderServicesError(
      "Choose a published business profile you control.",
      403,
      "business_not_owned",
    );
  }
  return data as Row;
}

async function validateAttachments(
  service: Service,
  userId: string,
  input: ProviderServiceInput,
) {
  const paths = stringArray(input.attachmentPaths, 8, 600);
  const urls = stringArray(input.attachmentUrls, 8, 1200);
  const types = stringArray(input.attachmentTypes, 8, 120);
  const names = stringArray(input.attachmentNames, 8, 200);
  if (
    !(
      paths.length === urls.length &&
      urls.length === types.length &&
      types.length === names.length
    )
  ) {
    throw new ProviderServicesError(
      "Service attachment metadata is incomplete.",
      400,
      "invalid_service_attachments",
    );
  }
  for (let index = 0; index < paths.length; index += 1) {
    if (!paths[index].startsWith(`${userId}/`)) {
      throw new ProviderServicesError(
        "A Service attachment is not owned by this account.",
        403,
        "service_attachment_forbidden",
      );
    }
    const expected = service.storage
      .from("provider-service-attachments")
      .getPublicUrl(paths[index]).data.publicUrl;
    if (urls[index] !== expected) {
      throw new ProviderServicesError(
        "A Service attachment URL is invalid.",
        400,
        "invalid_service_attachment_url",
      );
    }
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ].includes(types[index])
    ) {
      throw new ProviderServicesError(
        "A Service attachment type is invalid.",
        400,
        "invalid_service_attachment_type",
      );
    }
  }
  return {
    attachment_paths: paths,
    attachment_urls: urls,
    attachment_types: types,
    attachment_names: names,
  };
}

export async function normalizeProviderServiceInput(
  service: Service,
  userId: string,
  input: ProviderServiceInput,
) {
  const title = cleanText(input.title, 200);
  const description = cleanText(input.description, 16000);
  const category = cleanText(input.category, 120);
  const specialties = stringArray(input.specialties, 12, 80);
  const serviceMode = cleanText(input.serviceMode, 40) || "flexible";
  const city = cleanText(input.city, 100) || null;
  const region = cleanText(input.region, 100) || null;
  const postalCode = cleanText(input.postalCode, 30) || null;
  const countryCode = (cleanText(input.countryCode, 2) || "US").toUpperCase();
  const priceType = cleanText(input.priceType, 30) || "contact";
  let priceMin = optionalNumber(input.priceMin, "minimum price");
  let priceMax = optionalNumber(input.priceMax, "maximum price");
  const currency = (cleanText(input.currency, 3) || "USD").toUpperCase();
  const durationRaw = cleanText(input.typicalDurationMinutes, 20);
  const typicalDurationMinutes = durationRaw
    ? Math.floor(Number(durationRaw))
    : null;
  const responseExpectation =
    cleanText(input.responseExpectation, 500) || null;
  const availabilityText = cleanText(input.availabilityText, 1000) || null;

  if (title.length < 5) {
    throw new ProviderServicesError(
      "Add a clear Service title.",
      400,
      "service_title_required",
    );
  }
  if (description.length < 30) {
    throw new ProviderServicesError(
      "Describe the Service in at least 30 characters.",
      400,
      "service_description_required",
    );
  }
  if (!category) {
    throw new ProviderServicesError(
      "Choose a Service category.",
      400,
      "service_category_required",
    );
  }
  if (!MODES.has(serviceMode) || !PRICE_TYPES.has(priceType)) {
    throw new ProviderServicesError(
      "Choose valid Service settings.",
      400,
      "invalid_service_settings",
    );
  }
  if (!/^[A-Z]{3}$/.test(currency) || !/^[A-Z]{2}$/.test(countryCode)) {
    throw new ProviderServicesError(
      "Choose valid currency and country codes.",
      400,
      "invalid_service_codes",
    );
  }
  if (
    serviceMode !== "remote" &&
    !city &&
    !region &&
    !postalCode
  ) {
    throw new ProviderServicesError(
      "Add a city, region, or postal code for a local Service.",
      400,
      "service_location_required",
    );
  }
  if (priceType === "contact") {
    priceMin = null;
    priceMax = null;
  } else if (priceType === "fixed") {
    if (priceMin === null) {
      throw new ProviderServicesError(
        "Add the fixed Service price.",
        400,
        "service_price_required",
      );
    }
    priceMax = priceMin;
  } else if (priceMin === null && priceMax === null) {
    throw new ProviderServicesError(
      "Add at least one Service price amount.",
      400,
      "service_price_required",
    );
  }
  if (priceMin !== null && priceMax !== null && priceMax < priceMin) {
    throw new ProviderServicesError(
      "The maximum price cannot be lower than the minimum price.",
      400,
      "invalid_service_price_range",
    );
  }
  if (
    typicalDurationMinutes !== null &&
    (!Number.isFinite(typicalDurationMinutes) ||
      typicalDurationMinutes < 15 ||
      typicalDurationMinutes > 10080)
  ) {
    throw new ProviderServicesError(
      "Typical duration must be between 15 minutes and 7 days.",
      400,
      "invalid_service_duration",
    );
  }

  return {
    title,
    description,
    category,
    specialties,
    service_mode: serviceMode,
    city,
    region,
    postal_code: postalCode,
    country_code: countryCode,
    price_type: priceType,
    price_min: priceMin,
    price_max: priceMax,
    currency,
    typical_duration_minutes: typicalDurationMinutes,
    response_expectation: responseExpectation,
    availability_text: availabilityText,
    ...(await validateAttachments(service, userId, input)),
  };
}

export async function requireProviderServiceControl(
  viewer: Viewer,
  serviceId: string,
) {
  const { data, error } = await viewer.service
    .from("provider_services")
    .select("*")
    .eq("id", serviceId)
    .maybeSingle();
  if (error) {
    throw new ProviderServicesError(
      "Unable to verify the Service.",
      503,
      "service_access_unavailable",
    );
  }
  if (!data) {
    throw new ProviderServicesError(
      "Service not found.",
      404,
      "service_not_found",
    );
  }
  if (!viewer.isAdmin && data.provider_id !== viewer.user?.id) {
    throw new ProviderServicesError(
      "Only the provider may change this Service.",
      403,
      "service_forbidden",
    );
  }
  return data as Row;
}

export async function findExistingConversation(
  service: Service,
  firstId: string,
  secondId: string,
) {
  const { data: first, error } = await service
    .from("private_conversation_members")
    .select("conversation_id")
    .eq("user_id", firstId)
    .is("deleted_at", null);
  if (error) throw error;
  const ids = [
    ...new Set(
      ((first ?? []) as Row[])
        .map((row) => String(row.conversation_id))
        .filter(Boolean),
    ),
  ];
  if (!ids.length) return null;
  const { data } = await service
    .from("private_conversation_members")
    .select("conversation_id")
    .eq("user_id", secondId)
    .in("conversation_id", ids)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data?.conversation_id ? String(data.conversation_id) : null;
}
