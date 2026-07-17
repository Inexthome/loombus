import "server-only";

import type { NextRequest } from "next/server";
import { createAdminNotifications, createNotification, createNotifications } from "@/lib/notifications";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase, createRoomServiceSupabase } from "@/lib/room-operations";
import type {
  EventFormat,
  EventResponse,
  EventsDirectoryResponse,
  EventsManageResponse,
  PublicEvent,
} from "@/lib/events";

export type EventInput = Record<string, unknown>;
type Row = Record<string, any>;
type Service = ReturnType<typeof createRoomServiceSupabase>;

const PUBLIC_EVENT_SELECT = "*";
const VALID_FORMATS = new Set<EventFormat>(["in_person", "online", "hybrid"]);
const VALID_RESPONSES = new Set(["going", "interested", "none"]);

export class EventsError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "events_error"
  ) {
    super(message);
  }
}

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function longText(value: unknown, max = 16000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function uuid(value: unknown, label: string) {
  const result = text(value, 60);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) {
    throw new EventsError(`Invalid ${label}.`, 400, `invalid_${label.replaceAll(" ", "_")}`);
  }
  return result;
}

function optionalUuid(value: unknown, label: string) {
  const result = text(value, 60);
  return result ? uuid(result, label) : null;
}

function isoDate(value: unknown, label: string) {
  const raw = text(value, 100);
  const date = new Date(raw);
  if (!raw || !Number.isFinite(date.getTime())) {
    throw new EventsError(`Choose a valid ${label}.`, 400, `invalid_${label.replaceAll(" ", "_")}`);
  }
  return date.toISOString();
}

function optionalIsoDate(value: unknown, label: string) {
  const raw = text(value, 100);
  return raw ? isoDate(raw, label) : null;
}

function httpsUrl(value: unknown, label: string) {
  const raw = text(value, 1000);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") throw new Error("protocol");
    return parsed.toString();
  } catch {
    throw new EventsError(`Use a valid HTTPS ${label}.`, 400, `invalid_${label.replaceAll(" ", "_")}`);
  }
}

function slugBase(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "event";
}

async function uniqueSlug(service: Service, title: string, ignoreId?: string) {
  const base = slugBase(title);
  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    let query = service.from("public_events").select("id").eq("slug", candidate).limit(1);
    if (ignoreId) query = query.neq("id", ignoreId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new EventsError("Unable to prepare the event URL.", 503, "event_slug_unavailable");
    if (!data) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function resolveViewer(request: NextRequest, required: boolean) {
  const requestClient = createRequestSupabase(request);
  if (required) {
    const access = await verifyRequestAccountAccess(requestClient);
    if (!access.ok) throw new EventsError(access.error, access.status, access.code ?? "account_access_denied");
    return {
      user: access.user,
      profile: access.profile,
      isAdmin: access.profile.is_admin === true,
      service: createRoomServiceSupabase(),
    };
  }

  const { data } = await requestClient.auth.getUser();
  if (!data.user) {
    return { user: null, profile: null, isAdmin: false, service: createRoomServiceSupabase() };
  }
  const { data: profile } = await requestClient
    .from("profiles")
    .select("id, is_admin, account_status, enforcement_reason, suspended_until")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    user: data.user,
    profile: profile ?? null,
    isAdmin: profile?.is_admin === true,
    service: createRoomServiceSupabase(),
  };
}

async function ensureOrganizerEligible(service: Service, organizerId: string) {
  const [{ data: profile }, { data: sensitive }] = await Promise.all([
    service
      .from("profiles")
      .select("id, account_status, enforcement_reason, suspended_until")
      .eq("id", organizerId)
      .maybeSingle(),
    service
      .from("profile_sensitive")
      .select("age_band, guardian_required")
      .eq("id", organizerId)
      .maybeSingle(),
  ]);
  if (!profile || ["suspended", "banned", "deleted"].includes(text(profile.account_status, 30).toLowerCase())) {
    throw new EventsError("This account cannot organize an event.", 403, "organizer_not_eligible");
  }
  const ageBand = text(sensitive?.age_band, 30) || "unknown";
  if (ageBand === "under_13" || sensitive?.guardian_required) {
    throw new EventsError("Loombus is not available to children under 13.", 403, "under_13_not_allowed");
  }
  if (ageBand === "unknown") {
    throw new EventsError("Complete age safety before organizing an event.", 403, "age_gate_required");
  }
}

async function requireOwnedBusiness(service: Service, businessId: string, ownerId: string) {
  const { data, error } = await service
    .from("businesses")
    .select("id, name, slug, owner_id, status")
    .eq("id", businessId)
    .eq("owner_id", ownerId)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new EventsError("Unable to verify the business profile.", 503, "business_unavailable");
  if (!data) throw new EventsError("Choose a published business profile you control.", 403, "business_not_owned");
  return data as Row;
}

function normalizeInput(input: EventInput) {
  const title = text(input.title, 200);
  const description = longText(input.description, 16000);
  const category = text(input.category, 120);
  const format = (text(input.format, 30) || "in_person") as EventFormat;
  const startsAt = isoDate(input.startsAt, "event start time");
  const endsAt = optionalIsoDate(input.endsAt, "event end time");
  const timezone = text(input.timezone, 100) || "UTC";
  const venueName = text(input.venueName, 200) || null;
  const addressLine1 = text(input.addressLine1, 200) || null;
  const addressLine2 = text(input.addressLine2, 200) || null;
  const city = text(input.city, 100) || null;
  const region = text(input.region, 100) || null;
  const postalCode = text(input.postalCode, 30) || null;
  const countryCode = (text(input.countryCode, 2) || "US").toUpperCase();
  const onlineUrl = httpsUrl(input.onlineUrl, "online-event URL");
  const registrationUrl = httpsUrl(input.registrationUrl, "registration URL");
  const capacityRaw = text(input.capacity, 20);
  const capacity = capacityRaw ? Math.floor(Number(capacityRaw)) : null;
  const isFree = input.isFree === true || input.isFree === "true";
  const priceText = isFree ? null : text(input.priceText, 200) || null;

  if (title.length < 3) throw new EventsError("Add a clear event title.", 400, "event_title_required");
  if (description.length < 30) {
    throw new EventsError("Describe the event in at least 30 characters.", 400, "event_description_required");
  }
  if (!category) throw new EventsError("Choose an event category.", 400, "event_category_required");
  if (!VALID_FORMATS.has(format)) throw new EventsError("Choose a valid event format.", 400, "invalid_event_format");
  if (new Date(startsAt).getTime() < Date.now() - 5 * 60_000) {
    throw new EventsError("The event must start in the future.", 400, "event_start_past");
  }
  if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new EventsError("The event end time must be after the start time.", 400, "event_end_before_start");
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
  } catch {
    throw new EventsError("Choose a valid event time zone.", 400, "invalid_event_timezone");
  }
  if ((format === "in_person" || format === "hybrid") && !venueName && !city && !region) {
    throw new EventsError("Add a venue, city, or region for an in-person event.", 400, "event_location_required");
  }
  if ((format === "online" || format === "hybrid") && !onlineUrl) {
    throw new EventsError("Add an HTTPS URL for an online or hybrid event.", 400, "event_online_url_required");
  }
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new EventsError("Use a two-letter country code.", 400, "invalid_country_code");
  if (capacity !== null && (!Number.isFinite(capacity) || capacity < 1 || capacity > 1_000_000)) {
    throw new EventsError("Capacity must be between 1 and 1,000,000.", 400, "invalid_event_capacity");
  }

  return {
    title,
    description,
    category,
    event_format: format,
    venue_name: venueName,
    address_line1: addressLine1,
    address_line2: addressLine2,
    city,
    region,
    postal_code: postalCode,
    country_code: countryCode,
    online_url: onlineUrl,
    starts_at: startsAt,
    ends_at: endsAt,
    timezone,
    capacity,
    is_free: isFree,
    price_text: priceText,
    registration_url: registrationUrl,
  };
}

function organizerName(profile: Row | undefined) {
  return text(profile?.full_name, 200) || text(profile?.username, 100) || "Loombus member";
}

function normalizeEvent(
  row: Row,
  profiles: Map<string, Row>,
  businesses: Map<string, Row>,
  counts: Map<string, { going: number; interested: number }>,
  viewerResponses: Map<string, EventResponse>,
  viewerId: string | null,
  isAdmin: boolean
): PublicEvent {
  const organizerId = text(row.organizer_id, 60);
  const businessId = text(row.business_id, 60) || null;
  const profile = profiles.get(organizerId);
  const business = businessId ? businesses.get(businessId) : undefined;
  const eventCounts = counts.get(text(row.id, 60)) ?? { going: 0, interested: 0 };
  return {
    id: text(row.id, 60),
    slug: text(row.slug, 120),
    organizerId,
    organizerName: organizerName(profile),
    organizerUsername: text(profile?.username, 100) || null,
    businessId,
    businessName: text(business?.name, 200) || null,
    businessSlug: text(business?.slug, 120) || null,
    title: text(row.title, 200),
    description: longText(row.description, 16000),
    category: text(row.category, 120),
    format: (text(row.event_format, 30) || "in_person") as EventFormat,
    venueName: text(row.venue_name, 200) || null,
    addressLine1: text(row.address_line1, 200) || null,
    addressLine2: text(row.address_line2, 200) || null,
    city: text(row.city, 100) || null,
    region: text(row.region, 100) || null,
    postalCode: text(row.postal_code, 30) || null,
    countryCode: text(row.country_code, 2) || "US",
    onlineUrl: text(row.online_url, 1000) || null,
    startsAt: String(row.starts_at),
    endsAt: row.ends_at ? String(row.ends_at) : null,
    timezone: text(row.timezone, 100) || "UTC",
    capacity: row.capacity === null || row.capacity === undefined ? null : Number(row.capacity),
    isFree: row.is_free === true,
    priceText: text(row.price_text, 200) || null,
    registrationUrl: text(row.registration_url, 1000) || null,
    status: text(row.status, 30) as PublicEvent["status"],
    moderationReason: text(row.moderation_reason, 2000) || null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    goingCount: eventCounts.going,
    interestedCount: eventCounts.interested,
    viewerResponse: viewerResponses.get(text(row.id, 60)) ?? null,
    viewerCanManage: Boolean(viewerId && (viewerId === organizerId || isAdmin)),
  };
}

async function hydrateEvents(
  service: Service,
  rows: Row[],
  viewerId: string | null,
  isAdmin: boolean
) {
  const eventIds = rows.map((row) => text(row.id, 60)).filter(Boolean);
  const organizerIds = [...new Set(rows.map((row) => text(row.organizer_id, 60)).filter(Boolean))];
  const businessIds = [...new Set(rows.map((row) => text(row.business_id, 60)).filter(Boolean))];

  const [profileResult, businessResult, rsvpResult, viewerRsvpResult] = await Promise.all([
    organizerIds.length
      ? service.from("profiles").select("id, username, full_name").in("id", organizerIds)
      : Promise.resolve({ data: [], error: null }),
    businessIds.length
      ? service.from("businesses").select("id, name, slug").in("id", businessIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? service.from("public_event_rsvps").select("event_id, response").in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    viewerId && eventIds.length
      ? service
          .from("public_event_rsvps")
          .select("event_id, response")
          .eq("user_id", viewerId)
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError = profileResult.error || businessResult.error || rsvpResult.error || viewerRsvpResult.error;
  if (firstError) throw new EventsError("Unable to load event details.", 503, "event_hydration_failed");

  const profiles = new Map<string, Row>((profileResult.data ?? []).map((row: Row) => [text(row.id, 60), row]));
  const businesses = new Map<string, Row>((businessResult.data ?? []).map((row: Row) => [text(row.id, 60), row]));
  const counts = new Map<string, { going: number; interested: number }>();
  for (const rsvp of (rsvpResult.data ?? []) as Row[]) {
    const eventId = text(rsvp.event_id, 60);
    const current = counts.get(eventId) ?? { going: 0, interested: 0 };
    if (rsvp.response === "going") current.going += 1;
    if (rsvp.response === "interested") current.interested += 1;
    counts.set(eventId, current);
  }
  const viewerResponses = new Map<string, EventResponse>(
    ((viewerRsvpResult.data ?? []) as Row[]).map((row) => [text(row.event_id, 60), row.response as EventResponse])
  );
  return rows.map((row) => normalizeEvent(row, profiles, businesses, counts, viewerResponses, viewerId, isAdmin));
}

export async function listPublicEvents(request: NextRequest): Promise<EventsDirectoryResponse> {
  const viewer = await resolveViewer(request, false);
  const params = request.nextUrl.searchParams;
  const queryText = text(params.get("q"), 200).toLowerCase();
  const category = text(params.get("category"), 120);
  const format = text(params.get("format"), 30);
  const businessSlug = text(params.get("businessSlug"), 120);
  const organizerUsername = text(params.get("organizerUsername"), 100);
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 60) || 60, 1), 200);

  let businessId: string | null = null;
  if (businessSlug) {
    const { data } = await viewer.service
      .from("businesses")
      .select("id")
      .eq("slug", businessSlug)
      .eq("status", "published")
      .maybeSingle();
    businessId = data?.id ?? null;
    if (!businessId) return { events: [], authenticated: Boolean(viewer.user), isAdmin: viewer.isAdmin };
  }

  let organizerId: string | null = null;
  if (organizerUsername) {
    const { data } = await viewer.service
      .from("profiles")
      .select("id")
      .eq("username", organizerUsername)
      .maybeSingle();
    organizerId = data?.id ?? null;
    if (!organizerId) return { events: [], authenticated: Boolean(viewer.user), isAdmin: viewer.isAdmin };
  }

  let query = viewer.service
    .from("public_events")
    .select(PUBLIC_EVENT_SELECT)
    .eq("status", "published")
    .gte("starts_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (category) query = query.eq("category", category);
  if (format) query = query.eq("event_format", format);
  if (businessId) query = query.eq("business_id", businessId);
  if (organizerId) query = query.eq("organizer_id", organizerId);

  const { data, error } = await query;
  if (error) {
    if (/public_events|schema cache/i.test(error.message ?? "")) return { events: [], authenticated: Boolean(viewer.user), isAdmin: viewer.isAdmin };
    throw new EventsError("Unable to load public events.", 503, "events_unavailable");
  }
  let rows = (data ?? []) as Row[];
  if (queryText) {
    rows = rows.filter((row) =>
      [row.title, row.description, row.category, row.city, row.region, row.venue_name]
        .map((value) => text(value, 16000).toLowerCase())
        .some((value) => value.includes(queryText))
    );
  }
  return {
    events: await hydrateEvents(viewer.service, rows, viewer.user?.id ?? null, viewer.isAdmin),
    authenticated: Boolean(viewer.user),
    isAdmin: viewer.isAdmin,
  };
}

export async function getPublicEvent(request: NextRequest, slugValue: unknown) {
  const viewer = await resolveViewer(request, false);
  const slug = text(slugValue, 120);
  const { data, error } = await viewer.service
    .from("public_events")
    .select(PUBLIC_EVENT_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new EventsError("Unable to load the event.", 503, "event_unavailable");
  if (!data) throw new EventsError("Event not found.", 404, "event_not_found");
  const [event] = await hydrateEvents(viewer.service, [data as Row], viewer.user?.id ?? null, viewer.isAdmin);
  return { event, authenticated: Boolean(viewer.user), isAdmin: viewer.isAdmin };
}

export async function getEventsManageData(request: NextRequest): Promise<EventsManageResponse> {
  const viewer = await resolveViewer(request, true);
  let query = viewer.service
    .from("public_events")
    .select(PUBLIC_EVENT_SELECT)
    .order("updated_at", { ascending: false })
    .limit(250);
  if (!viewer.isAdmin) query = query.eq("organizer_id", viewer.user!.id);
  const { data, error } = await query;
  if (error) {
    if (/public_events|schema cache/i.test(error.message ?? "")) {
      throw new EventsError("The Events migrations have not been applied.", 503, "events_schema_unavailable");
    }
    throw new EventsError("Unable to load event management.", 503, "events_manage_unavailable");
  }

  let reports: EventsManageResponse["reports"] = [];
  if (viewer.isAdmin) {
    const { data: reportRows, error: reportError } = await viewer.service
      .from("public_event_reports")
      .select("id, event_id, reason, details, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(250);
    if (reportError) throw new EventsError("Unable to load event reports.", 503, "event_reports_unavailable");
    const eventTitleMap = new Map<string, string>(((data ?? []) as Row[]).map((row) => [text(row.id, 60), text(row.title, 200)]));
    reports = ((reportRows ?? []) as Row[]).map((row) => ({
      id: text(row.id, 60),
      eventId: text(row.event_id, 60),
      reason: text(row.reason, 120),
      details: longText(row.details, 3000),
      status: text(row.status, 30),
      createdAt: String(row.created_at),
      eventTitle: eventTitleMap.get(text(row.event_id, 60)) ?? "Event",
    }));
  }
  const { data: businessRows, error: businessError } = await viewer.service
    .from("businesses")
    .select("id, name, slug")
    .eq("owner_id", viewer.user!.id)
    .eq("status", "published")
    .order("name", { ascending: true });
  if (businessError) {
    throw new EventsError("Unable to load organizer businesses.", 503, "event_businesses_unavailable");
  }
  return {
    businesses: ((businessRows ?? []) as Row[]).map((row) => ({
      id: text(row.id, 60),
      name: text(row.name, 200),
      slug: text(row.slug, 120),
    })),
    events: await hydrateEvents(viewer.service, (data ?? []) as Row[], viewer.user!.id, viewer.isAdmin),
    reports,
    isAdmin: viewer.isAdmin,
  };
}

export async function createEvent(request: NextRequest, input: EventInput) {
  const viewer = await resolveViewer(request, true);
  await ensureOrganizerEligible(viewer.service, viewer.user!.id);
  const businessId = optionalUuid(input.businessId, "business id");
  if (businessId) await requireOwnedBusiness(viewer.service, businessId, viewer.user!.id);
  const values = normalizeInput(input);
  const slug = await uniqueSlug(viewer.service, values.title);
  const { data, error } = await viewer.service
    .from("public_events")
    .insert({
      ...values,
      slug,
      organizer_id: viewer.user!.id,
      business_id: businessId,
      status: "pending",
      moderation_reason: null,
      published_at: null,
      cancelled_at: null,
    })
    .select("id")
    .single();
  if (error || !data) throw new EventsError("Unable to create the event.", 503, "event_create_failed");
  await createAdminNotifications({
    actor_id: viewer.user!.id,
    type: "event_review_requested",
    target_type: "public_event",
    target_id: data.id,
    message: `A public event is ready for review: ${values.title}`,
  });
  return { id: data.id, slug, status: "pending" };
}

async function requireEventControl(viewer: Awaited<ReturnType<typeof resolveViewer>>, eventId: string) {
  const { data, error } = await viewer.service
    .from("public_events")
    .select(PUBLIC_EVENT_SELECT)
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new EventsError("Unable to verify the event.", 503, "event_access_unavailable");
  if (!data) throw new EventsError("Event not found.", 404, "event_not_found");
  if (!viewer.isAdmin && data.organizer_id !== viewer.user?.id) {
    throw new EventsError("Only the organizer may change this event.", 403, "event_forbidden");
  }
  return data as Row;
}

export async function updateEvent(request: NextRequest, input: EventInput) {
  const viewer = await resolveViewer(request, true);
  const eventId = uuid(input.eventId, "event id");
  const existing = await requireEventControl(viewer, eventId);
  if (["removed", "completed"].includes(text(existing.status, 30))) {
    throw new EventsError("This event can no longer be edited.", 409, "event_edit_closed");
  }
  const businessId = optionalUuid(input.businessId, "business id");
  if (businessId) await requireOwnedBusiness(viewer.service, businessId, existing.organizer_id);
  const values = normalizeInput(input);
  const slug = await uniqueSlug(viewer.service, values.title, eventId);
  const { error } = await viewer.service
    .from("public_events")
    .update({
      ...values,
      business_id: businessId,
      slug,
      status: "pending",
      moderation_reason: null,
      cancelled_at: null,
    })
    .eq("id", eventId);
  if (error) throw new EventsError("Unable to update the event.", 503, "event_update_failed");
  await createAdminNotifications({
    actor_id: viewer.user!.id,
    type: "event_review_requested",
    target_type: "public_event",
    target_id: eventId,
    message: `An updated public event is ready for review: ${values.title}`,
  });
  return { id: eventId, slug, status: "pending" };
}

export async function setEventLifecycle(request: NextRequest, input: EventInput) {
  const viewer = await resolveViewer(request, true);
  const eventId = uuid(input.eventId, "event id");
  const action = text(input.action, 40);
  const event = await requireEventControl(viewer, eventId);
  const current = text(event.status, 30);
  const now = new Date().toISOString();
  const updates: Row = {};
  let responderMessage: string | null = null;

  if (action === "cancel") {
    if (current !== "published") throw new EventsError("Only a published event can be cancelled.", 409, "event_published_required");
    updates.status = "cancelled";
    updates.cancelled_at = now;
    responderMessage = `An event you saved was cancelled: ${event.title}`;
  } else if (action === "reopen") {
    if (current !== "cancelled") throw new EventsError("Only a cancelled event can be reopened.", 409, "event_cancelled_required");
    if (new Date(event.starts_at).getTime() <= Date.now()) {
      throw new EventsError("Move the event to a future date before reopening it.", 409, "event_future_date_required");
    }
    updates.status = "pending";
    updates.cancelled_at = null;
    updates.moderation_reason = null;
    await createAdminNotifications({
      actor_id: viewer.user!.id,
      type: "event_review_requested",
      target_type: "public_event",
      target_id: eventId,
      message: `A reopened public event is ready for review: ${event.title}`,
    });
  } else if (action === "complete") {
    if (current !== "published") throw new EventsError("Only a published event can be completed.", 409, "event_published_required");
    if (new Date(event.starts_at).getTime() > Date.now()) {
      throw new EventsError("The event cannot be completed before it starts.", 409, "event_not_started");
    }
    updates.status = "completed";
  } else if (action === "remove") {
    updates.status = "removed";
    responderMessage = `An event you saved was removed: ${event.title}`;
  } else {
    throw new EventsError("Choose a valid event action.", 400, "invalid_event_action");
  }

  const { error } = await viewer.service.from("public_events").update(updates).eq("id", eventId);
  if (error) throw new EventsError("Unable to update the event status.", 503, "event_lifecycle_failed");
  if (responderMessage) await notifyResponders(viewer.service, eventId, viewer.user!.id, responderMessage);
  return { updated: true, status: updates.status };
}

async function notifyResponders(service: Service, eventId: string, actorId: string, message: string) {
  const pageSize = 500;
  let offset = 0;
  while (true) {
    const { data, error } = await service
      .from("public_event_rsvps")
      .select("user_id")
      .eq("event_id", eventId)
      .neq("user_id", actorId)
      .range(offset, offset + pageSize - 1);
    if (error) return;
    const rows = (data ?? []) as Row[];
    if (rows.length) {
      await createNotifications(
        rows.map((row) => ({
          user_id: row.user_id,
          actor_id: actorId,
          type: "event_status",
          target_type: "public_event",
          target_id: eventId,
          message,
        }))
      );
    }
    if (rows.length < pageSize) return;
    offset += pageSize;
  }
}

export async function respondToEvent(request: NextRequest, input: EventInput) {
  const viewer = await resolveViewer(request, true);
  const eventId = uuid(input.eventId, "event id");
  const response = text(input.response, 30);
  if (!VALID_RESPONSES.has(response)) throw new EventsError("Choose Going, Interested, or remove your response.", 400, "invalid_event_response");
  const { data: event, error } = await viewer.service
    .from("public_events")
    .select("id, title, organizer_id, starts_at, capacity, status")
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new EventsError("Unable to verify the event.", 503, "event_unavailable");
  if (!event || new Date(event.starts_at).getTime() <= Date.now()) {
    throw new EventsError("This event is no longer accepting responses.", 409, "event_response_closed");
  }
  const { error: responseError } = await viewer.service.rpc(
    "set_public_event_rsvp",
    {
      target_event_id: eventId,
      target_user_id: viewer.user!.id,
      target_response: response,
    }
  );
  if (responseError) {
    const message = String(responseError.message ?? "");
    if (message.includes("EVENT_CAPACITY_REACHED")) {
      throw new EventsError(
        "This event has reached its stated capacity.",
        409,
        "event_capacity_reached"
      );
    }
    if (message.includes("EVENT_RESPONSE_CLOSED")) {
      throw new EventsError(
        "This event is no longer accepting responses.",
        409,
        "event_response_closed"
      );
    }
    throw new EventsError(
      response === "none" ? "Unable to remove your response." : "Unable to save your response.",
      503,
      response === "none" ? "event_response_remove_failed" : "event_response_failed"
    );
  }
  if (response === "none") return { response: null };
  if (event.organizer_id !== viewer.user!.id) {
    await createNotification({
      user_id: event.organizer_id,
      actor_id: viewer.user!.id,
      type: "event_response",
      target_type: "public_event",
      target_id: eventId,
      message: response === "going" ? `Someone is going to ${event.title}.` : `Someone is interested in ${event.title}.`,
    });
  }
  return { response };
}

export async function reportEvent(request: NextRequest, input: EventInput) {
  const viewer = await resolveViewer(request, true);
  const eventId = uuid(input.eventId, "event id");
  const reason = text(input.reason, 120);
  const details = longText(input.details, 3000);
  if (!reason || details.length < 10) throw new EventsError("Choose a reason and explain the concern.", 400, "event_report_details_required");
  const { data: event } = await viewer.service
    .from("public_events")
    .select("id, title")
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();
  if (!event) throw new EventsError("Event not found.", 404, "event_not_found");
  const { data: existingOpenReport } = await viewer.service
    .from("public_event_reports")
    .select("id")
    .eq("event_id", eventId)
    .eq("reporter_id", viewer.user!.id)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();
  if (existingOpenReport) {
    throw new EventsError(
      "You already have an open report for this event.",
      409,
      "event_report_already_open"
    );
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await viewer.service
    .from("public_event_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", viewer.user!.id)
    .gte("created_at", since);
  if ((count ?? 0) >= 10) throw new EventsError("You have reached the event report limit for this hour.", 429, "event_report_rate_limited");
  const { data, error } = await viewer.service
    .from("public_event_reports")
    .insert({ event_id: eventId, reporter_id: viewer.user!.id, reason, details, status: "open" })
    .select("id")
    .single();
  if (error || !data) throw new EventsError("Unable to submit the event report.", 503, "event_report_failed");
  await createAdminNotifications({
    actor_id: viewer.user!.id,
    type: "event_report_received",
    target_type: "public_event",
    target_id: eventId,
    message: `A public event was reported: ${event.title}`,
  });
  return { submitted: true };
}

export async function moderateEvent(request: NextRequest, input: EventInput) {
  const viewer = await resolveViewer(request, true);
  if (!viewer.isAdmin) throw new EventsError("Administrator access is required.", 403, "admin_required");
  const eventId = uuid(input.eventId, "event id");
  const decision = text(input.decision, 30);
  const note = longText(input.note, 2000);
  const { data: event } = await viewer.service
    .from("public_events")
    .select(PUBLIC_EVENT_SELECT)
    .eq("id", eventId)
    .maybeSingle();
  if (!event) throw new EventsError("Event not found.", 404, "event_not_found");

  const updates: Row = { moderation_reason: note || null };
  if (decision === "approve") {
    await ensureOrganizerEligible(viewer.service, event.organizer_id);
    if (event.business_id) await requireOwnedBusiness(viewer.service, event.business_id, event.organizer_id);
    if (new Date(event.starts_at).getTime() <= Date.now()) {
      throw new EventsError("Move the event to a future date before approval.", 409, "event_future_date_required");
    }
    updates.status = "published";
    updates.published_at = event.published_at || new Date().toISOString();
    updates.cancelled_at = null;
  } else if (decision === "reject") {
    updates.status = "rejected";
  } else if (decision === "remove") {
    updates.status = "removed";
  } else {
    throw new EventsError("Choose a valid moderation decision.", 400, "invalid_event_decision");
  }
  const { error } = await viewer.service.from("public_events").update(updates).eq("id", eventId);
  if (error) throw new EventsError("Unable to moderate the event.", 503, "event_moderation_failed");
  if (decision === "remove") await notifyResponders(viewer.service, eventId, viewer.user!.id, `An event you saved was removed: ${event.title}`);
  await createNotification({
    user_id: event.organizer_id,
    actor_id: viewer.user!.id,
    type: "event_status",
    target_type: "public_event",
    target_id: eventId,
    message:
      decision === "approve"
        ? `Your event is now public: ${event.title}`
        : decision === "reject"
          ? `Your event needs changes: ${event.title}`
          : `Your event was removed: ${event.title}`,
  });
  return { updated: true, status: updates.status };
}

export async function reviewEventReport(request: NextRequest, input: EventInput) {
  const viewer = await resolveViewer(request, true);
  if (!viewer.isAdmin) throw new EventsError("Administrator access is required.", 403, "admin_required");
  const reportId = uuid(input.reportId, "report id");
  const decision = text(input.decision, 30);
  if (!new Set(["resolve", "dismiss"]).has(decision)) {
    throw new EventsError("Choose a valid report decision.", 400, "invalid_report_decision");
  }
  const { error } = await viewer.service
    .from("public_event_reports")
    .update({
      status: decision === "resolve" ? "resolved" : "dismissed",
      reviewed_by: viewer.user!.id,
      reviewed_at: new Date().toISOString(),
      decision_note: longText(input.note, 2000) || null,
    })
    .eq("id", reportId)
    .eq("status", "open");
  if (error) throw new EventsError("Unable to review the event report.", 503, "event_report_review_failed");
  return { updated: true };
}
