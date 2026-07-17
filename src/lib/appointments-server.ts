import "server-only";

import type { NextRequest } from "next/server";
import { createNotification } from "@/lib/notifications";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase, createRoomServiceSupabase } from "@/lib/room-operations";
import type { AppointmentRequest, AppointmentService } from "@/lib/events";

export type AppointmentInput = Record<string, unknown>;
type Row = Record<string, any>;
type Service = ReturnType<typeof createRoomServiceSupabase>;

export class AppointmentsError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "appointments_error"
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
    throw new AppointmentsError(`Invalid ${label}.`, 400, `invalid_${label.replaceAll(" ", "_")}`);
  }
  return result;
}

function isoDate(value: unknown, label: string) {
  const raw = text(value, 100);
  const date = new Date(raw);
  if (!raw || !Number.isFinite(date.getTime())) {
    throw new AppointmentsError(`Choose a valid ${label}.`, 400, `invalid_${label.replaceAll(" ", "_")}`);
  }
  return date.toISOString();
}

async function resolveViewer(request: NextRequest, required: boolean) {
  const requestClient = createRequestSupabase(request);
  if (required) {
    const access = await verifyRequestAccountAccess(requestClient);
    if (!access.ok) {
      throw new AppointmentsError(access.error, access.status, access.code ?? "account_access_denied");
    }
    return {
      user: access.user,
      profile: access.profile,
      isAdmin: access.profile.is_admin === true,
      service: createRoomServiceSupabase(),
    };
  }
  const { data } = await requestClient.auth.getUser();
  return {
    user: data.user ?? null,
    profile: null,
    isAdmin: false,
    service: createRoomServiceSupabase(),
  };
}

async function requireAgeSafety(service: Service, userId: string, role: "requester" | "provider") {
  const { data } = await service
    .from("profile_sensitive")
    .select("age_band, guardian_required")
    .eq("id", userId)
    .maybeSingle();
  const ageBand = text(data?.age_band, 30) || "unknown";
  if (ageBand === "under_13" || data?.guardian_required) {
    throw new AppointmentsError("Loombus is not available to children under 13.", 403, "under_13_not_allowed");
  }
  if (ageBand === "unknown") {
    throw new AppointmentsError(
      role === "requester"
        ? "Complete age safety before requesting an appointment."
        : "The provider must complete age safety before receiving appointment requests.",
      403,
      role === "requester" ? "age_gate_required" : "provider_age_gate_required"
    );
  }
}

async function requirePublishedBusiness(service: Service, businessId: string, ownerId?: string) {
  let query = service
    .from("businesses")
    .select("id, name, slug, owner_id, status")
    .eq("id", businessId)
    .eq("status", "published");
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new AppointmentsError("Unable to verify the business.", 503, "business_unavailable");
  if (!data) {
    throw new AppointmentsError(
      ownerId ? "Choose a published business profile you control." : "Business profile not found.",
      ownerId ? 403 : 404,
      ownerId ? "business_not_owned" : "business_not_found"
    );
  }
  return data as Row;
}

function normalizeService(row: Row, business: Row): AppointmentService {
  return {
    id: text(row.id, 60),
    businessId: text(row.business_id, 60),
    businessName: text(business.name, 200),
    businessSlug: text(business.slug, 120),
    ownerId: text(row.owner_id, 60),
    name: text(row.name, 200),
    description: text(row.description, 5000),
    durationMinutes: Number(row.duration_minutes ?? 30),
    locationMode: (text(row.location_mode, 30) || "flexible") as AppointmentService["locationMode"],
    locationText: text(row.location_text, 300) || null,
    priceText: text(row.price_text, 200) || null,
    instructions: text(row.instructions, 3000) || null,
    status: (text(row.status, 30) || "active") as AppointmentService["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function normalizeRequest(
  row: Row,
  service: Row,
  business: Row,
  requester: Row | undefined
): AppointmentRequest {
  return {
    id: text(row.id, 60),
    serviceId: text(row.service_id, 60),
    serviceName: text(service.name, 200) || "Appointment",
    businessId: text(row.business_id, 60),
    businessName: text(business.name, 200),
    businessSlug: text(business.slug, 120),
    providerId: text(row.provider_id, 60),
    requesterId: text(row.requester_id, 60),
    requesterName:
      text(requester?.full_name, 200) || text(requester?.username, 100) || "Loombus member",
    requestedStart: String(row.requested_start),
    requestedEnd: String(row.requested_end),
    proposedStart: row.proposed_start ? String(row.proposed_start) : null,
    proposedEnd: row.proposed_end ? String(row.proposed_end) : null,
    timezone: text(row.timezone, 100) || "UTC",
    note: text(row.note, 3000) || null,
    providerNote: text(row.provider_note, 3000) || null,
    status: text(row.status, 40) as AppointmentRequest["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    actedAt: row.acted_at ? String(row.acted_at) : null,
  };
}

async function hydrateServices(serviceClient: Service, rows: Row[]) {
  const businessIds = [...new Set(rows.map((row) => text(row.business_id, 60)).filter(Boolean))];
  const { data, error } = businessIds.length
    ? await serviceClient.from("businesses").select("id, name, slug").in("id", businessIds)
    : { data: [], error: null };
  if (error) throw new AppointmentsError("Unable to load appointment businesses.", 503, "appointment_businesses_unavailable");
  const businesses = new Map<string, Row>(((data ?? []) as Row[]).map((row) => [text(row.id, 60), row]));
  return rows
    .map((row) => {
      const business = businesses.get(text(row.business_id, 60));
      return business ? normalizeService(row, business) : null;
    })
    .filter((item): item is AppointmentService => Boolean(item));
}

async function hydrateRequests(serviceClient: Service, rows: Row[]) {
  const serviceIds = [...new Set(rows.map((row) => text(row.service_id, 60)).filter(Boolean))];
  const businessIds = [...new Set(rows.map((row) => text(row.business_id, 60)).filter(Boolean))];
  const requesterIds = [...new Set(rows.map((row) => text(row.requester_id, 60)).filter(Boolean))];
  const [servicesResult, businessesResult, profilesResult] = await Promise.all([
    serviceIds.length
      ? serviceClient.from("business_appointment_services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    businessIds.length
      ? serviceClient.from("businesses").select("id, name, slug").in("id", businessIds)
      : Promise.resolve({ data: [], error: null }),
    requesterIds.length
      ? serviceClient.from("profiles").select("id, full_name, username").in("id", requesterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError = servicesResult.error || businessesResult.error || profilesResult.error;
  if (firstError) throw new AppointmentsError("Unable to load appointment details.", 503, "appointment_hydration_failed");
  const services = new Map<string, Row>(((servicesResult.data ?? []) as Row[]).map((row) => [text(row.id, 60), row]));
  const businesses = new Map<string, Row>(((businessesResult.data ?? []) as Row[]).map((row) => [text(row.id, 60), row]));
  const profiles = new Map<string, Row>(((profilesResult.data ?? []) as Row[]).map((row) => [text(row.id, 60), row]));
  return rows
    .map((row) => {
      const service = services.get(text(row.service_id, 60));
      const business = businesses.get(text(row.business_id, 60));
      if (!service || !business) return null;
      return normalizeRequest(row, service, business, profiles.get(text(row.requester_id, 60)));
    })
    .filter((item): item is AppointmentRequest => Boolean(item));
}

export async function getPublicBusinessScheduling(request: NextRequest, businessSlug: string) {
  const viewer = await resolveViewer(request, false);
  const { data: business, error } = await viewer.service
    .from("businesses")
    .select("id, name, slug, owner_id, status")
    .eq("slug", text(businessSlug, 120))
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new AppointmentsError("Unable to load appointment services.", 503, "appointment_services_unavailable");
  if (!business) return { business: null, services: [], authenticated: Boolean(viewer.user) };
  const publicBusiness = {
    id: String(business.id),
    name: String(business.name),
    slug: String(business.slug),
  };
  const { data, error: serviceError } = await viewer.service
    .from("business_appointment_services")
    .select("*")
    .eq("business_id", business.id)
    .eq("owner_id", business.owner_id)
    .eq("status", "active")
    .order("name", { ascending: true });
  if (serviceError) {
    if (/business_appointment_services|schema cache/i.test(serviceError.message ?? "")) {
      return { business: publicBusiness, services: [], authenticated: Boolean(viewer.user) };
    }
    throw new AppointmentsError("Unable to load appointment services.", 503, "appointment_services_unavailable");
  }
  return {
    business: publicBusiness,
    services: await hydrateServices(viewer.service, (data ?? []) as Row[]),
    authenticated: Boolean(viewer.user),
  };
}

export async function getAppointmentManageData(request: NextRequest) {
  const viewer = await resolveViewer(request, true);
  const userId = viewer.user!.id;
  const [businessResult, serviceResult, receivedResult, sentResult] = await Promise.all([
    viewer.service
      .from("businesses")
      .select("id, name, slug, owner_id, status")
      .eq("owner_id", userId)
      .eq("status", "published")
      .order("name", { ascending: true }),
    viewer.service
      .from("business_appointment_services")
      .select("*")
      .eq("owner_id", userId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false }),
    viewer.service
      .from("business_appointment_requests")
      .select("*")
      .eq("provider_id", userId)
      .order("updated_at", { ascending: false })
      .limit(250),
    viewer.service
      .from("business_appointment_requests")
      .select("*")
      .eq("requester_id", userId)
      .order("updated_at", { ascending: false })
      .limit(250),
  ]);
  const firstError = businessResult.error || serviceResult.error || receivedResult.error || sentResult.error;
  if (firstError) {
    if (/business_appointment|schema cache/i.test(firstError.message ?? "")) {
      throw new AppointmentsError("The Appointments migration has not been applied.", 503, "appointments_schema_unavailable");
    }
    throw new AppointmentsError("Unable to load appointments.", 503, "appointments_unavailable");
  }
  return {
    businesses: businessResult.data ?? [],
    services: await hydrateServices(viewer.service, (serviceResult.data ?? []) as Row[]),
    receivedRequests: await hydrateRequests(viewer.service, (receivedResult.data ?? []) as Row[]),
    sentRequests: await hydrateRequests(viewer.service, (sentResult.data ?? []) as Row[]),
  };
}

function normalizeServiceInput(input: AppointmentInput) {
  const name = text(input.name, 200);
  const description = text(input.description, 5000);
  const durationMinutes = Math.floor(Number(input.durationMinutes));
  const locationMode = text(input.locationMode, 30) || "flexible";
  const locationText = text(input.locationText, 300) || null;
  const priceText = text(input.priceText, 200) || null;
  const instructions = text(input.instructions, 3000) || null;
  if (name.length < 3) throw new AppointmentsError("Add a clear appointment service name.", 400, "service_name_required");
  if (description.length < 20) {
    throw new AppointmentsError("Describe the appointment service in at least 20 characters.", 400, "service_description_required");
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
    throw new AppointmentsError("Appointment duration must be between 15 minutes and 8 hours.", 400, "invalid_service_duration");
  }
  if (!["in_person", "online", "phone", "flexible"].includes(locationMode)) {
    throw new AppointmentsError("Choose a valid appointment location type.", 400, "invalid_service_location");
  }
  return {
    name,
    description,
    duration_minutes: durationMinutes,
    location_mode: locationMode,
    location_text: locationText,
    price_text: priceText,
    instructions,
  };
}

export async function createAppointmentService(request: NextRequest, input: AppointmentInput) {
  const viewer = await resolveViewer(request, true);
  await requireAgeSafety(viewer.service, viewer.user!.id, "provider");
  const businessId = uuid(input.businessId, "business id");
  await requirePublishedBusiness(viewer.service, businessId, viewer.user!.id);
  const values = normalizeServiceInput(input);
  const { data, error } = await viewer.service
    .from("business_appointment_services")
    .insert({
      business_id: businessId,
      owner_id: viewer.user!.id,
      ...values,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) throw new AppointmentsError("Unable to create the appointment service.", 503, "service_create_failed");
  return { id: data.id };
}

async function requireServiceControl(serviceClient: Service, serviceId: string, ownerId: string) {
  const { data, error } = await serviceClient
    .from("business_appointment_services")
    .select("*")
    .eq("id", serviceId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new AppointmentsError("Unable to verify the appointment service.", 503, "service_access_unavailable");
  if (!data) throw new AppointmentsError("Appointment service not found.", 404, "service_not_found");
  return data as Row;
}

export async function updateAppointmentService(request: NextRequest, input: AppointmentInput) {
  const viewer = await resolveViewer(request, true);
  const serviceId = uuid(input.serviceId, "service id");
  const service = await requireServiceControl(viewer.service, serviceId, viewer.user!.id);
  await requirePublishedBusiness(viewer.service, service.business_id, viewer.user!.id);
  const values = normalizeServiceInput(input);
  const { error } = await viewer.service
    .from("business_appointment_services")
    .update(values)
    .eq("id", serviceId)
    .eq("owner_id", viewer.user!.id);
  if (error) throw new AppointmentsError("Unable to update the appointment service.", 503, "service_update_failed");
  return { updated: true };
}

export async function setAppointmentServiceStatus(request: NextRequest, input: AppointmentInput) {
  const viewer = await resolveViewer(request, true);
  const serviceId = uuid(input.serviceId, "service id");
  const status = text(input.status, 30);
  if (!["active", "paused", "archived"].includes(status)) {
    throw new AppointmentsError("Choose a valid service status.", 400, "invalid_service_status");
  }
  const service = await requireServiceControl(viewer.service, serviceId, viewer.user!.id);
  if (status === "active") await requirePublishedBusiness(viewer.service, service.business_id, viewer.user!.id);
  const { error } = await viewer.service
    .from("business_appointment_services")
    .update({ status })
    .eq("id", serviceId)
    .eq("owner_id", viewer.user!.id);
  if (error) throw new AppointmentsError("Unable to update the service status.", 503, "service_status_failed");
  return { updated: true, status };
}

async function ensureNotBlocked(service: Service, leftId: string, rightId: string) {
  const { data } = await service
    .from("user_blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${leftId},blocked_id.eq.${rightId}),and(blocker_id.eq.${rightId},blocked_id.eq.${leftId})`
    )
    .limit(1);
  if ((data ?? []).length) {
    throw new AppointmentsError("This appointment request is not available.", 403, "appointment_blocked");
  }
}

export async function requestAppointment(request: NextRequest, input: AppointmentInput) {
  const viewer = await resolveViewer(request, true);
  const requesterId = viewer.user!.id;
  const serviceId = uuid(input.serviceId, "service id");
  const { data: service, error } = await viewer.service
    .from("business_appointment_services")
    .select("*")
    .eq("id", serviceId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new AppointmentsError("Unable to verify the appointment service.", 503, "service_unavailable");
  if (!service) throw new AppointmentsError("Appointment service not found.", 404, "service_not_found");
  if (service.owner_id === requesterId) {
    throw new AppointmentsError("You cannot request your own appointment service.", 400, "self_appointment_not_allowed");
  }
  await requirePublishedBusiness(viewer.service, service.business_id);
  await Promise.all([
    requireAgeSafety(viewer.service, requesterId, "requester"),
    requireAgeSafety(viewer.service, service.owner_id, "provider"),
    ensureNotBlocked(viewer.service, requesterId, service.owner_id),
  ]);
  const requestedStart = isoDate(input.requestedStart, "appointment start time");
  if (new Date(requestedStart).getTime() < Date.now() + 30 * 60_000) {
    throw new AppointmentsError("Choose an appointment time at least 30 minutes in the future.", 400, "appointment_too_soon");
  }
  const requestedEnd = new Date(
    new Date(requestedStart).getTime() + Number(service.duration_minutes) * 60_000
  ).toISOString();
  const timezone = text(input.timezone, 100) || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
  } catch {
    throw new AppointmentsError("Choose a valid appointment time zone.", 400, "invalid_appointment_timezone");
  }
  const note = text(input.note, 3000) || null;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await viewer.service
    .from("business_appointment_requests")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", requesterId)
    .gte("created_at", since);
  if ((count ?? 0) >= 10) {
    throw new AppointmentsError("You have reached the appointment request limit for this hour.", 429, "appointment_rate_limited");
  }
  const { data, error: insertError } = await viewer.service
    .from("business_appointment_requests")
    .insert({
      service_id: serviceId,
      business_id: service.business_id,
      provider_id: service.owner_id,
      requester_id: requesterId,
      requested_start: requestedStart,
      requested_end: requestedEnd,
      timezone,
      note,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !data) throw new AppointmentsError("Unable to send the appointment request.", 503, "appointment_request_failed");
  await createNotification({
    user_id: service.owner_id,
    actor_id: requesterId,
    type: "appointment_requested",
    target_type: "appointment_request",
    target_id: data.id,
    message: `New appointment request for ${service.name}.`,
  });
  return { id: data.id, status: "pending" };
}

async function requireAppointmentControl(
  service: Service,
  requestId: string,
  userId: string,
  role: "provider" | "requester"
) {
  let query = service.from("business_appointment_requests").select("*").eq("id", requestId);
  query = role === "provider" ? query.eq("provider_id", userId) : query.eq("requester_id", userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new AppointmentsError("Unable to verify the appointment request.", 503, "appointment_access_unavailable");
  if (!data) throw new AppointmentsError("Appointment request not found.", 404, "appointment_not_found");
  return data as Row;
}

async function ensureProviderAvailability(service: Service, providerId: string, requestId: string, startsAt: string, endsAt: string) {
  const { data, error } = await service
    .from("business_appointment_requests")
    .select("id")
    .eq("provider_id", providerId)
    .eq("status", "accepted")
    .neq("id", requestId)
    .lt("requested_start", endsAt)
    .gt("requested_end", startsAt)
    .limit(1);
  if (error) throw new AppointmentsError("Unable to check provider availability.", 503, "appointment_availability_unavailable");
  if ((data ?? []).length) {
    throw new AppointmentsError("This time conflicts with another accepted appointment.", 409, "appointment_time_conflict");
  }
}

export async function respondToAppointment(request: NextRequest, input: AppointmentInput) {
  const viewer = await resolveViewer(request, true);
  const requestId = uuid(input.requestId, "appointment request id");
  const decision = text(input.decision, 40);
  const row = await requireAppointmentControl(viewer.service, requestId, viewer.user!.id, "provider");
  const current = text(row.status, 40);
  const providerNote = text(input.providerNote, 3000) || null;
  const now = new Date().toISOString();
  const updates: Row = { provider_note: providerNote, acted_at: now };
  let message: string;

  if (decision === "cancel") {
    if (current !== "accepted") {
      throw new AppointmentsError(
        "Only an accepted appointment can be cancelled by the provider.",
        409,
        "appointment_accepted_required"
      );
    }
    updates.status = "cancelled";
    message = "The business cancelled your appointment.";
  } else if (current !== "pending") {
    throw new AppointmentsError(
      "This appointment request is no longer awaiting a provider response.",
      409,
      "appointment_response_closed"
    );
  } else if (decision === "accept") {
    const startsAt = row.proposed_start || row.requested_start;
    const endsAt = row.proposed_end || row.requested_end;
    if (new Date(startsAt).getTime() <= Date.now()) {
      throw new AppointmentsError("Choose a future time before accepting this appointment.", 409, "appointment_future_time_required");
    }
    await ensureProviderAvailability(viewer.service, row.provider_id, requestId, startsAt, endsAt);
    updates.status = "accepted";
    updates.requested_start = startsAt;
    updates.requested_end = endsAt;
    updates.proposed_start = null;
    updates.proposed_end = null;
    message = "Your appointment request was accepted.";
  } else if (decision === "decline") {
    updates.status = "declined";
    message = "Your appointment request was declined.";
  } else if (decision === "propose_reschedule") {
    const proposedStart = isoDate(input.proposedStart, "proposed appointment time");
    if (new Date(proposedStart).getTime() < Date.now() + 30 * 60_000) {
      throw new AppointmentsError("Choose a proposed time at least 30 minutes in the future.", 400, "appointment_too_soon");
    }
    const duration = new Date(row.requested_end).getTime() - new Date(row.requested_start).getTime();
    const proposedEnd = new Date(new Date(proposedStart).getTime() + duration).toISOString();
    await ensureProviderAvailability(viewer.service, row.provider_id, requestId, proposedStart, proposedEnd);
    updates.status = "reschedule_proposed";
    updates.proposed_start = proposedStart;
    updates.proposed_end = proposedEnd;
    message = "A new appointment time was proposed.";
  } else {
    throw new AppointmentsError("Choose a valid appointment response.", 400, "invalid_appointment_decision");
  }
  const { data: updatedRequest, error } = await viewer.service
    .from("business_appointment_requests")
    .update(updates)
    .eq("id", requestId)
    .eq("provider_id", viewer.user!.id)
    .eq("status", current)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new AppointmentsError(
      "Unable to update the appointment request.",
      503,
      "appointment_response_failed"
    );
  }
  if (!updatedRequest) {
    throw new AppointmentsError(
      "This appointment changed before your response was saved. Refresh and review its current status.",
      409,
      "appointment_status_changed"
    );
  }
  await createNotification({
    user_id: row.requester_id,
    actor_id: viewer.user!.id,
    type: "appointment_status",
    target_type: "appointment_request",
    target_id: requestId,
    message,
  });
  return { updated: true, status: updates.status };
}

export async function requesterAppointmentAction(request: NextRequest, input: AppointmentInput) {
  const viewer = await resolveViewer(request, true);
  const requestId = uuid(input.requestId, "appointment request id");
  const action = text(input.requestAction, 40);
  const row = await requireAppointmentControl(viewer.service, requestId, viewer.user!.id, "requester");
  const current = text(row.status, 40);
  const now = new Date().toISOString();
  const updates: Row = { acted_at: now };
  let message: string;
  if (action === "accept_reschedule") {
    if (current !== "reschedule_proposed" || !row.proposed_start || !row.proposed_end) {
      throw new AppointmentsError("No proposed appointment time is awaiting acceptance.", 409, "appointment_reschedule_unavailable");
    }
    await ensureProviderAvailability(viewer.service, row.provider_id, requestId, row.proposed_start, row.proposed_end);
    updates.status = "accepted";
    updates.requested_start = row.proposed_start;
    updates.requested_end = row.proposed_end;
    updates.proposed_start = null;
    updates.proposed_end = null;
    message = "The proposed appointment time was accepted.";
  } else if (action === "cancel") {
    if (["declined", "cancelled", "completed"].includes(current)) {
      throw new AppointmentsError("This appointment can no longer be cancelled.", 409, "appointment_cancel_closed");
    }
    updates.status = "cancelled";
    message = "The appointment request was cancelled.";
  } else {
    throw new AppointmentsError("Choose a valid appointment action.", 400, "invalid_appointment_action");
  }
  const { data: updatedRequest, error } = await viewer.service
    .from("business_appointment_requests")
    .update(updates)
    .eq("id", requestId)
    .eq("requester_id", viewer.user!.id)
    .eq("status", current)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new AppointmentsError(
      "Unable to update the appointment.",
      503,
      "appointment_action_failed"
    );
  }
  if (!updatedRequest) {
    throw new AppointmentsError(
      "This appointment changed before your action was saved. Refresh and review its current status.",
      409,
      "appointment_status_changed"
    );
  }
  await createNotification({
    user_id: row.provider_id,
    actor_id: viewer.user!.id,
    type: "appointment_status",
    target_type: "appointment_request",
    target_id: requestId,
    message,
  });
  return { updated: true, status: updates.status };
}

export async function completeAppointment(request: NextRequest, input: AppointmentInput) {
  const viewer = await resolveViewer(request, true);
  const requestId = uuid(input.requestId, "appointment request id");
  const row = await requireAppointmentControl(viewer.service, requestId, viewer.user!.id, "provider");
  if (text(row.status, 40) !== "accepted") {
    throw new AppointmentsError("Only an accepted appointment can be completed.", 409, "appointment_accepted_required");
  }
  if (new Date(row.requested_start).getTime() > Date.now()) {
    throw new AppointmentsError("The appointment cannot be completed before it starts.", 409, "appointment_not_started");
  }
  const { data: completedRequest, error } = await viewer.service
    .from("business_appointment_requests")
    .update({ status: "completed", acted_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("provider_id", viewer.user!.id)
    .eq("status", "accepted")
    .select("id")
    .maybeSingle();
  if (error) {
    throw new AppointmentsError(
      "Unable to complete the appointment.",
      503,
      "appointment_complete_failed"
    );
  }
  if (!completedRequest) {
    throw new AppointmentsError(
      "This appointment changed before it was completed. Refresh and review its current status.",
      409,
      "appointment_status_changed"
    );
  }
  await createNotification({
    user_id: row.requester_id,
    actor_id: viewer.user!.id,
    type: "appointment_status",
    target_type: "appointment_request",
    target_id: requestId,
    message: "Your appointment was marked complete.",
  });
  return { updated: true, status: "completed" };
}
