import "server-only";
import type { NextRequest } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase, createRoomServiceSupabase } from "@/lib/room-operations";

export type ServiceRequestInput = Record<string, unknown>;
export type Row = Record<string, any>;
export type Service = ReturnType<typeof createRoomServiceSupabase>;
export type Viewer = { user: { id: string } | null; profile: Row | null; isAdmin: boolean; service: Service };

const REQUEST_TYPES = new Set(["service_needed", "recommendation", "quote_request", "community_help", "volunteer_help", "consultation", "local_problem"]);
const URGENCY = new Set(["normal", "soon", "urgent"]);
const MODES = new Set(["remote", "requester_location", "provider_location", "flexible"]);
const BUDGET_TYPES = new Set(["total", "hourly", "flexible"]);

export class ServiceRequestsError extends Error {
  constructor(message: string, public status = 400, public code = "service_requests_error") { super(message); }
}

export function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function cleanUuid(value: unknown, label: string) {
  const result = cleanText(value, 60);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) {
    throw new ServiceRequestsError(`Invalid ${label}.`, 400, `invalid_${label.replaceAll(" ", "_")}`);
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
    throw new ServiceRequestsError(`Choose a valid ${label}.`, 400, `invalid_${label.replaceAll(" ", "_")}`);
  }
  return Math.round(result * 100) / 100;
}

function optionalIso(value: unknown, label: string) {
  const raw = cleanText(value, 100);
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new ServiceRequestsError(`Choose a valid ${label}.`, 400, `invalid_${label.replaceAll(" ", "_")}`);
  return date.toISOString();
}

function stringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function slugBase(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "request";
}

export async function uniqueSlug(service: Service, title: string, ignoreId?: string) {
  const base = slugBase(title);
  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    let query = service.from("service_requests").select("id").eq("slug", candidate).limit(1);
    if (ignoreId) query = query.neq("id", ignoreId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new ServiceRequestsError("Unable to prepare the Request URL.", 503, "request_slug_unavailable");
    if (!data) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function resolveViewer(request: NextRequest, required: boolean): Promise<Viewer> {
  const client = createRequestSupabase(request);
  if (required) {
    const access = await verifyRequestAccountAccess(client);
    if (!access.ok) throw new ServiceRequestsError(access.error, access.status, access.code ?? "account_access_denied");
    return { user: access.user, profile: access.profile as Row, isAdmin: access.profile.is_admin === true, service: createRoomServiceSupabase() };
  }
  const { data } = await client.auth.getUser();
  if (!data.user) return { user: null, profile: null, isAdmin: false, service: createRoomServiceSupabase() };
  const { data: profile } = await client.from("profiles").select("id, is_admin, account_status, enforcement_reason, suspended_until").eq("id", data.user.id).maybeSingle();
  return { user: data.user, profile: (profile ?? null) as Row | null, isAdmin: profile?.is_admin === true, service: createRoomServiceSupabase() };
}

export async function requireEligibility(service: Service, userId: string, action: string) {
  const [profileResult, sensitiveResult] = await Promise.all([
    service.from("profiles").select("id, account_status, enforcement_reason, suspended_until").eq("id", userId).maybeSingle(),
    service.from("profile_sensitive").select("age_band, guardian_required").eq("id", userId).maybeSingle(),
  ]);
  if (!profileResult.data || !getAccountEnforcementResult(profileResult.data).allowed) {
    throw new ServiceRequestsError(`This account cannot ${action}.`, 403, "account_not_eligible");
  }
  const ageBand = String(sensitiveResult.data?.age_band ?? "unknown");
  if (ageBand === "under_13" || sensitiveResult.data?.guardian_required === true) {
    throw new ServiceRequestsError("Loombus is not available to children under 13.", 403, "under_13_not_allowed");
  }
  if (sensitiveResult.error || ageBand === "unknown") {
    throw new ServiceRequestsError(`Complete age safety before you ${action}.`, 403, "age_gate_required");
  }
}

export async function ensureNotBlocked(service: Service, leftId: string, rightId: string) {
  const { data } = await service.from("user_blocks").select("id")
    .or(`and(blocker_id.eq.${leftId},blocked_id.eq.${rightId}),and(blocker_id.eq.${rightId},blocked_id.eq.${leftId})`).limit(1);
  if ((data ?? []).length) throw new ServiceRequestsError("This Request interaction is not available.", 403, "request_interaction_blocked");
}

export async function requireOwnedPublishedBusiness(service: Service, businessId: string, ownerId: string) {
  const { data, error } = await service.from("businesses").select("id, name, slug, owner_id, status")
    .eq("id", businessId).eq("owner_id", ownerId).eq("status", "published").maybeSingle();
  if (error) throw new ServiceRequestsError("Unable to verify the business profile.", 503, "business_unavailable");
  if (!data) throw new ServiceRequestsError("Choose a published business profile you control.", 403, "business_not_owned");
  return data as Row;
}

async function validateAttachments(service: Service, userId: string, input: ServiceRequestInput) {
  const paths = stringArray(input.attachmentPaths, 8, 600);
  const urls = stringArray(input.attachmentUrls, 8, 1200);
  const types = stringArray(input.attachmentTypes, 8, 120);
  const names = stringArray(input.attachmentNames, 8, 200);
  if (!(paths.length === urls.length && urls.length === types.length && types.length === names.length)) {
    throw new ServiceRequestsError("Request attachment metadata is incomplete.", 400, "invalid_request_attachments");
  }
  for (let index = 0; index < paths.length; index += 1) {
    if (!paths[index].startsWith(`${userId}/`)) throw new ServiceRequestsError("A Request attachment is not owned by this account.", 403, "request_attachment_forbidden");
    const expected = service.storage.from("service-request-attachments").getPublicUrl(paths[index]).data.publicUrl;
    if (urls[index] !== expected) throw new ServiceRequestsError("A Request attachment URL is invalid.", 400, "invalid_request_attachment_url");
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(types[index])) {
      throw new ServiceRequestsError("A Request attachment type is invalid.", 400, "invalid_request_attachment_type");
    }
  }
  return { attachment_paths: paths, attachment_urls: urls, attachment_types: types, attachment_names: names };
}

export async function normalizeRequestInput(service: Service, userId: string, input: ServiceRequestInput) {
  const title = cleanText(input.title, 200);
  const description = cleanText(input.description, 16000);
  const requestType = cleanText(input.requestType, 40) || "service_needed";
  const category = cleanText(input.category, 120);
  const urgency = cleanText(input.urgency, 30) || "normal";
  const serviceMode = cleanText(input.serviceMode, 40) || "flexible";
  const city = cleanText(input.city, 100) || null;
  const region = cleanText(input.region, 100) || null;
  const postalCode = cleanText(input.postalCode, 30) || null;
  const countryCode = (cleanText(input.countryCode, 2) || "US").toUpperCase();
  const budgetMin = optionalNumber(input.budgetMin, "minimum budget");
  const budgetMax = optionalNumber(input.budgetMax, "maximum budget");
  const budgetType = cleanText(input.budgetType, 30) || "flexible";
  const currency = (cleanText(input.currency, 3) || "USD").toUpperCase();
  const deadline = optionalIso(input.deadline, "deadline");
  const preferredStart = optionalIso(input.preferredStart, "preferred start");
  const preferredEnd = optionalIso(input.preferredEnd, "preferred end");
  const tags = stringArray(input.tags, 12, 60);
  if (title.length < 5) throw new ServiceRequestsError("Add a clear Request title.", 400, "request_title_required");
  if (description.length < 30) throw new ServiceRequestsError("Describe the need in at least 30 characters.", 400, "request_description_required");
  if (!REQUEST_TYPES.has(requestType) || !URGENCY.has(urgency) || !MODES.has(serviceMode) || !BUDGET_TYPES.has(budgetType)) {
    throw new ServiceRequestsError("Choose valid Request settings.", 400, "invalid_request_settings");
  }
  if (!category) throw new ServiceRequestsError("Choose a Request category.", 400, "request_category_required");
  if (!/^[A-Z]{3}$/.test(currency) || !/^[A-Z]{2}$/.test(countryCode)) throw new ServiceRequestsError("Choose valid currency and country codes.", 400, "invalid_request_codes");
  if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) throw new ServiceRequestsError("The maximum budget cannot be lower than the minimum budget.", 400, "invalid_budget_range");
  if (deadline && new Date(deadline).getTime() <= Date.now()) throw new ServiceRequestsError("The Request deadline must be in the future.", 400, "request_deadline_past");
  if (preferredStart && preferredEnd && new Date(preferredEnd).getTime() <= new Date(preferredStart).getTime()) throw new ServiceRequestsError("The preferred end must be after the preferred start.", 400, "invalid_preferred_time_range");
  if (serviceMode !== "remote" && !city && !region && !postalCode) throw new ServiceRequestsError("Add a city, region, or postal code for a local Request.", 400, "request_location_required");
  return {
    title, description, request_type: requestType, category, urgency, service_mode: serviceMode,
    city, region, postal_code: postalCode, country_code: countryCode,
    budget_min: budgetMin, budget_max: budgetMax, currency, budget_type: budgetType,
    deadline, preferred_start: preferredStart, preferred_end: preferredEnd, tags,
    ...(await validateAttachments(service, userId, input)),
  };
}

export async function requireRequestControl(viewer: Viewer, requestId: string) {
  const { data, error } = await viewer.service.from("service_requests").select("*").eq("id", requestId).maybeSingle();
  if (error) throw new ServiceRequestsError("Unable to verify the Request.", 503, "request_access_unavailable");
  if (!data) throw new ServiceRequestsError("Request not found.", 404, "request_not_found");
  if (!viewer.isAdmin && data.requester_id !== viewer.user?.id) throw new ServiceRequestsError("Only the requester may change this Request.", 403, "request_forbidden");
  return data as Row;
}

export async function findExistingConversation(service: Service, firstId: string, secondId: string) {
  const { data: first, error } = await service.from("private_conversation_members").select("conversation_id").eq("user_id", firstId).is("deleted_at", null);
  if (error) throw error;
  const ids = [...new Set(((first ?? []) as Row[]).map((row) => String(row.conversation_id)).filter(Boolean))];
  if (!ids.length) return null;
  const { data } = await service.from("private_conversation_members").select("conversation_id").eq("user_id", secondId).in("conversation_id", ids).is("deleted_at", null).limit(1).maybeSingle();
  return data?.conversation_id ? String(data.conversation_id) : null;
}
