import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

type Row = Record<string, unknown>;

class AppointmentsAdminError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "appointments_admin_error"
  ) {
    super(message);
  }
}

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof AppointmentsAdminError) {
    return response(
      { error: error.message, code: error.code },
      error.status
    );
  }

  console.error(
    "Appointments administrator request failed:",
    error
  );

  return response(
    {
      error:
        "Appointments administration could not complete this request.",
      code: "appointments_admin_failed",
    },
    500
  );
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function text(value: unknown, maximum = 3000) {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

function iso(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}

function displayName(profile: Row | undefined) {
  return (
    text(profile?.full_name, 200) ||
    text(profile?.username, 100) ||
    "Loombus member"
  );
}

async function requireAdministrator(request: NextRequest) {
  const access = await verifyRequestAccountAccess(
    createRequestSupabase(request)
  );

  if (!access.ok) {
    throw new AppointmentsAdminError(
      access.error,
      access.status,
      access.code ?? "account_access_denied"
    );
  }

  if (access.profile.is_admin !== true) {
    throw new AppointmentsAdminError(
      "Administrator access is required.",
      403,
      "administrator_required"
    );
  }

  return {
    administratorId: access.user.id,
    service: createRoomServiceSupabase(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { service } = await requireAdministrator(request);

    const [servicesResult, requestsResult] =
      await Promise.all([
        service
          .from("business_appointment_services")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(500),
        service
          .from("business_appointment_requests")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(500),
      ]);

    const firstError =
      servicesResult.error || requestsResult.error;

    if (firstError) {
      if (
        /business_appointment|schema cache/i.test(
          firstError.message ?? ""
        )
      ) {
        throw new AppointmentsAdminError(
          "The Appointments migration has not been applied.",
          503,
          "appointments_schema_unavailable"
        );
      }

      throw new AppointmentsAdminError(
        firstError.message ||
          "Unable to load Appointments.",
        503,
        "appointments_unavailable"
      );
    }

    const serviceRows =
      (servicesResult.data ?? []) as unknown as Row[];
    const requestRows =
      (requestsResult.data ?? []) as unknown as Row[];

    const businessIds = [
      ...new Set(
        [
          ...serviceRows.map((row) =>
            asString(row.business_id)
          ),
          ...requestRows.map((row) =>
            asString(row.business_id)
          ),
        ].filter(Boolean)
      ),
    ];

    const profileIds = [
      ...new Set(
        [
          ...serviceRows.map((row) =>
            asString(row.owner_id)
          ),
          ...requestRows.map((row) =>
            asString(row.provider_id)
          ),
          ...requestRows.map((row) =>
            asString(row.requester_id)
          ),
        ].filter(Boolean)
      ),
    ];

    const emptyResult = {
      data: [] as Row[],
      error: null,
    };

    const [businessesResult, profilesResult] =
      await Promise.all([
        businessIds.length
          ? service
              .from("businesses")
              .select(
                "id,name,slug,owner_id,status"
              )
              .in("id", businessIds)
          : emptyResult,
        profileIds.length
          ? service
              .from("profiles")
              .select(
                "id,username,full_name,account_status"
              )
              .in("id", profileIds)
          : emptyResult,
      ]);

    const hydrationError =
      businessesResult.error ||
      profilesResult.error;

    if (hydrationError) {
      throw new AppointmentsAdminError(
        hydrationError.message ||
          "Unable to load Appointment account details.",
        503,
        "appointment_hydration_failed"
      );
    }

    const businesses = new Map<string, Row>(
      ((businessesResult.data ?? []) as unknown as Row[]).map(
        (row) => [asString(row.id), row]
      )
    );
    const profiles = new Map<string, Row>(
      ((profilesResult.data ?? []) as unknown as Row[]).map(
        (row) => [asString(row.id), row]
      )
    );
    const servicesById = new Map<string, Row>(
      serviceRows.map((row) => [
        asString(row.id),
        row,
      ])
    );

    const services = serviceRows.map((row) => {
      const ownerId = asString(row.owner_id);
      const owner = profiles.get(ownerId);
      const business = businesses.get(
        asString(row.business_id)
      );

      return {
        id: asString(row.id),
        businessId: asString(row.business_id),
        businessName:
          text(business?.name, 200) ||
          "Business",
        businessSlug:
          text(business?.slug, 120) || null,
        businessStatus:
          text(business?.status, 60) || null,
        ownerId,
        owner: {
          id: ownerId,
          displayName: displayName(owner),
          username:
            text(owner?.username, 100) || null,
          accountStatus:
            text(owner?.account_status, 60) ||
            null,
        },
        name:
          text(row.name, 200) ||
          "Appointment service",
        description: text(row.description, 5000),
        durationMinutes: Number(
          row.duration_minutes ?? 30
        ),
        locationMode:
          text(row.location_mode, 40) ||
          "flexible",
        locationText:
          text(row.location_text, 300) || null,
        priceText:
          text(row.price_text, 200) || null,
        instructions:
          text(row.instructions, 3000) || null,
        status: text(row.status, 40) || "active",
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      };
    });

    const now = Date.now();

    const requests = requestRows.map((row) => {
      const providerId = asString(row.provider_id);
      const requesterId = asString(
        row.requester_id
      );
      const provider = profiles.get(providerId);
      const requester = profiles.get(requesterId);
      const business = businesses.get(
        asString(row.business_id)
      );
      const appointmentService = servicesById.get(
        asString(row.service_id)
      );
      const requestedEnd = iso(row.requested_end);
      const status =
        text(row.status, 50) || "pending";

      return {
        id: asString(row.id),
        serviceId: asString(row.service_id),
        serviceName:
          text(appointmentService?.name, 200) ||
          "Appointment",
        businessId: asString(row.business_id),
        businessName:
          text(business?.name, 200) ||
          "Business",
        businessSlug:
          text(business?.slug, 120) || null,
        providerId,
        provider: {
          id: providerId,
          displayName: displayName(provider),
          username:
            text(provider?.username, 100) || null,
          accountStatus:
            text(provider?.account_status, 60) ||
            null,
        },
        requesterId,
        requester: {
          id: requesterId,
          displayName: displayName(requester),
          username:
            text(requester?.username, 100) || null,
          accountStatus:
            text(
              requester?.account_status,
              60
            ) || null,
        },
        requestedStart: iso(row.requested_start),
        requestedEnd,
        proposedStart: iso(row.proposed_start),
        proposedEnd: iso(row.proposed_end),
        timezone:
          text(row.timezone, 100) || "UTC",
        note: text(row.note, 3000) || null,
        providerNote:
          text(row.provider_note, 3000) || null,
        status,
        overdue:
          status === "accepted" &&
          requestedEnd !== null &&
          new Date(requestedEnd).getTime() < now,
        actedAt: iso(row.acted_at),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      };
    });

    return response({
      isAdmin: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        activeServices: services.filter(
          (item) => item.status === "active"
        ).length,
        pausedServices: services.filter(
          (item) => item.status === "paused"
        ).length,
        pendingRequests: requests.filter(
          (item) => item.status === "pending"
        ).length,
        acceptedRequests: requests.filter(
          (item) => item.status === "accepted"
        ).length,
        rescheduleProposed: requests.filter(
          (item) =>
            item.status ===
            "reschedule_proposed"
        ).length,
        overdueAccepted: requests.filter(
          (item) => item.overdue
        ).length,
        completedRequests: requests.filter(
          (item) => item.status === "completed"
        ).length,
        cancelledRequests: requests.filter(
          (item) => item.status === "cancelled"
        ).length,
      },
      services,
      requests,
      boundaries: {
        disputeQueueAvailable: false,
        accountSuspensionAvailable: false,
        paymentOperationsAvailable: false,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { administratorId, service } =
      await requireAdministrator(request);

    const body = await request
      .json()
      .catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new AppointmentsAdminError(
        "Invalid Appointments administrator request.",
        400,
        "invalid_payload"
      );
    }

    const input = body as Record<string, unknown>;
    const action = text(input.action, 80);
    const note = text(input.note, 2000);

    if (action === "cancel_request") {
      const requestId = text(input.requestId, 60);

      if (note.length < 3) {
        throw new AppointmentsAdminError(
          "An administrator cancellation reason is required.",
          400,
          "cancellation_reason_required"
        );
      }

      if (!validUuid(requestId)) {
        throw new AppointmentsAdminError(
          "Invalid appointment request id.",
          400,
          "invalid_request_id"
        );
      }

      const requestResult = await service
        .from("business_appointment_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();

      if (requestResult.error) {
        throw new AppointmentsAdminError(
          requestResult.error.message ||
            "Unable to verify the appointment request.",
          503,
          "appointment_request_unavailable"
        );
      }

      if (!requestResult.data) {
        throw new AppointmentsAdminError(
          "Appointment request not found.",
          404,
          "appointment_request_not_found"
        );
      }

      const currentStatus =
        text(requestResult.data.status, 50) ||
        "pending";

      if (
        ![
          "pending",
          "accepted",
          "reschedule_proposed",
        ].includes(currentStatus)
      ) {
        throw new AppointmentsAdminError(
          "This appointment can no longer be cancelled.",
          409,
          "appointment_cancel_closed"
        );
      }

      const now = new Date().toISOString();

      const updateResult = await service
        .from("business_appointment_requests")
        .update({
          status: "cancelled",
          acted_at: now,
        })
        .eq("id", requestId)
        .eq("status", currentStatus)
        .select("id")
        .maybeSingle();

      if (updateResult.error) {
        throw new AppointmentsAdminError(
          updateResult.error.message ||
            "Unable to cancel the appointment.",
          503,
          "appointment_cancel_failed"
        );
      }

      if (!updateResult.data) {
        throw new AppointmentsAdminError(
          "This appointment changed before the cancellation was saved. Refresh and review its current status.",
          409,
          "appointment_status_changed"
        );
      }

      const parties = [
        asString(requestResult.data.provider_id),
        asString(
          requestResult.data.requester_id
        ),
      ].filter(Boolean);

      await Promise.allSettled(
        [...new Set(parties)].map((userId) =>
          createNotification({
            user_id: userId,
            actor_id: administratorId,
            type: "appointment_status",
            target_type: "appointment_request",
            target_id: requestId,
            message:
              "Loombus administration cancelled this appointment request.",
          })
        )
      );

      await logAuditEvent({
        actor_id: administratorId,
        action:
          "admin.appointment_request_cancelled",
        target_type:
          "business_appointment_request",
        target_id: requestId,
        metadata: {
          previous_status: currentStatus,
          provider_id:
            requestResult.data.provider_id,
          requester_id:
            requestResult.data.requester_id,
          business_id:
            requestResult.data.business_id,
          service_id:
            requestResult.data.service_id,
          note: note || null,
        },
      });

      return response({
        updated: true,
        status: "cancelled",
      });
    }

    throw new AppointmentsAdminError(
      "Unsupported Appointments administrator action.",
      400,
      "unsupported_action"
    );
  } catch (error) {
    return errorResponse(error);
  }
}
