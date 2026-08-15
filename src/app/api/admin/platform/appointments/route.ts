import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";
import {
  getProfessionalBookingProviderPaymentReviewState,
  loadProfessionalBookingProviderPaymentReviewScope,
  PROFESSIONAL_BOOKING_PROVIDER_PAYMENT_REVIEW_POLICY_VERSION,
  ProfessionalBookingProviderPaymentReviewError,
} from "@/lib/professional-booking-provider-payment-review-server";
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

  if (error instanceof ProfessionalBookingProviderPaymentReviewError) {
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

    const [servicesResult, requestsResult, disputesResult] =
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
        service
          .from("professional_booking_payment_disputes")
          .select("*")
          .order("last_synced_at", { ascending: false })
          .limit(200),
      ]);

    const firstError =
      servicesResult.error ||
      requestsResult.error ||
      disputesResult.error;

    if (firstError) {
      if (
        /business_appointment|professional_booking_payment_disputes|schema cache/i.test(
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
    const disputeRows =
      (disputesResult.data ?? []) as unknown as Row[];

    const disputePaymentIds = [
      ...new Set(
        disputeRows
          .map((row) => asString(row.payment_id))
          .filter(Boolean)
      ),
    ];

    const disputePaymentsResult = disputePaymentIds.length
      ? await service
          .from("professional_booking_payments")
          .select(
            "id,appointment_request_id,service_id,provider_id,requester_id,status,gross_amount_cents,currency"
          )
          .in("id", disputePaymentIds)
      : { data: [] as Row[], error: null };

    if (disputePaymentsResult.error) {
      throw new AppointmentsAdminError(
        disputePaymentsResult.error.message ||
          "Unable to load Professional Booking dispute payments.",
        503,
        "professional_booking_dispute_payment_hydration_failed"
      );
    }

    const disputePaymentRows =
      (disputePaymentsResult.data ?? []) as unknown as Row[];

    const disputeRequestIds = [
      ...new Set(
        disputePaymentRows
          .map((row) =>
            asString(row.appointment_request_id)
          )
          .filter(Boolean)
      ),
    ];

    const disputeServiceIds = [
      ...new Set(
        disputePaymentRows
          .map((row) => asString(row.service_id))
          .filter(Boolean)
      ),
    ];

    const [disputeRequestsResult, disputeServicesResult] =
      await Promise.all([
        disputeRequestIds.length
          ? service
              .from("business_appointment_requests")
              .select(
                "id,business_id,service_id,provider_id,requester_id,requested_start,requested_end,timezone,status"
              )
              .in("id", disputeRequestIds)
          : { data: [] as Row[], error: null },
        disputeServiceIds.length
          ? service
              .from("business_appointment_services")
              .select(
                "id,business_id,owner_id,name,status"
              )
              .in("id", disputeServiceIds)
          : { data: [] as Row[], error: null },
      ]);

    const disputeHydrationError =
      disputeRequestsResult.error ||
      disputeServicesResult.error;

    if (disputeHydrationError) {
      throw new AppointmentsAdminError(
        disputeHydrationError.message ||
          "Unable to load Professional Booking dispute context.",
        503,
        "professional_booking_dispute_context_hydration_failed"
      );
    }

    const disputeRequestRows =
      (disputeRequestsResult.data ?? []) as unknown as Row[];
    const disputeServiceRows =
      (disputeServicesResult.data ?? []) as unknown as Row[];

    const businessIds = [
      ...new Set(
        [
          ...serviceRows.map((row) =>
            asString(row.business_id)
          ),
          ...requestRows.map((row) =>
            asString(row.business_id)
          ),
          ...disputeServiceRows.map((row) =>
            asString(row.business_id)
          ),
          ...disputeRequestRows.map((row) =>
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
          ...disputeServiceRows.map((row) =>
            asString(row.owner_id)
          ),
          ...disputePaymentRows.map((row) =>
            asString(row.provider_id)
          ),
          ...disputePaymentRows.map((row) =>
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
      [...serviceRows, ...disputeServiceRows].map((row) => [
        asString(row.id),
        row,
      ])
    );
    const requestsById = new Map<string, Row>(
      [...requestRows, ...disputeRequestRows].map((row) => [
        asString(row.id),
        row,
      ])
    );
    const disputePaymentsById = new Map<string, Row>(
      disputePaymentRows.map((row) => [
        asString(row.id),
        row,
      ])
    );

    if (
      disputeRows.some(
        (row) =>
          !disputePaymentsById.has(
            asString(row.payment_id)
          )
      )
    ) {
      throw new AppointmentsAdminError(
        "A Professional Booking dispute is missing its payment context.",
        503,
        "professional_booking_dispute_payment_context_missing"
      );
    }

    const paymentReviewProviderIds = [
      ...new Set(
        serviceRows
          .filter((row) =>
            ["active", "paused"].includes(
              text(row.status, 40)
            )
          )
          .map((row) => asString(row.owner_id))
          .filter(Boolean)
      ),
    ].sort();

    const paymentReviewStates = await Promise.all(
      paymentReviewProviderIds.map((providerId) =>
        getProfessionalBookingProviderPaymentReviewState(
          service,
          providerId
        )
      )
    );

    const providerPaymentReviews = paymentReviewStates.map(
      (state) => {
        const provider = profiles.get(state.scope.providerId);

        return {
          providerId: state.scope.providerId,
          provider: {
            id: state.scope.providerId,
            displayName: displayName(provider),
            username:
              text(provider?.username, 100) || null,
            accountStatus:
              text(provider?.account_status, 60) || null,
          },
          review: state.review,
          matchesCurrentScope: state.matchesCurrentScope,
          paymentEligible: state.paymentEligible,
          scope: state.scope,
        };
      }
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

    const paymentDisputes = disputeRows.map((row) => {
      const payment = disputePaymentsById.get(
        asString(row.payment_id)
      )!;
      const appointment = requestsById.get(
        asString(payment.appointment_request_id)
      );
      const appointmentService = servicesById.get(
        asString(payment.service_id)
      );
      const business = businesses.get(
        asString(
          appointment?.business_id ??
            appointmentService?.business_id
        )
      );
      const providerId = asString(payment.provider_id);
      const requesterId = asString(payment.requester_id);
      const provider = profiles.get(providerId);
      const requester = profiles.get(requesterId);

      return {
        id: asString(row.id),
        paymentId: asString(payment.id),
        appointmentRequestId:
          asString(payment.appointment_request_id),
        serviceId: asString(payment.service_id),
        serviceName:
          text(appointmentService?.name, 200) ||
          "Professional Booking",
        businessId:
          asString(
            appointment?.business_id ??
              appointmentService?.business_id
          ) || null,
        businessName:
          text(business?.name, 200) || "Business",
        providerId,
        provider: {
          id: providerId,
          displayName: displayName(provider),
          username:
            text(provider?.username, 100) || null,
          accountStatus:
            text(provider?.account_status, 60) || null,
        },
        requesterId,
        requester: {
          id: requesterId,
          displayName: displayName(requester),
          username:
            text(requester?.username, 100) || null,
          accountStatus:
            text(requester?.account_status, 60) || null,
        },
        appointmentStatus:
          text(appointment?.status, 50) || null,
        requestedStart:
          iso(appointment?.requested_start),
        requestedEnd:
          iso(appointment?.requested_end),
        timezone:
          text(appointment?.timezone, 100) || null,
        paymentStatus:
          text(payment.status, 50) || "unknown",
        grossAmountCents:
          Number(payment.gross_amount_cents ?? 0),
        paymentCurrency:
          text(payment.currency, 10).toLowerCase(),
        stripeDisputeId:
          text(row.stripe_dispute_id, 255),
        stripeChargeId:
          text(row.stripe_charge_id, 255),
        stripePaymentIntentId:
          text(row.stripe_payment_intent_id, 255),
        livemode: row.livemode === true,
        amountCents: Number(row.amount_cents ?? 0),
        currency:
          text(row.currency, 10).toLowerCase(),
        reason: text(row.reason, 200),
        status: text(row.status, 60),
        isChargeRefundable:
          row.is_charge_refundable === true,
        evidenceDueAt:
          iso(row.evidence_due_at),
        evidenceHasEvidence:
          row.evidence_has_evidence === true,
        evidencePastDue:
          row.evidence_past_due === true,
        evidenceSubmissionCount:
          Number(row.evidence_submission_count ?? 0),
        stripeCreatedAt:
          iso(row.stripe_created_at),
        lastStripeEventId:
          text(row.last_stripe_event_id, 255),
        lastEventCreatedAt:
          iso(row.last_event_created_at),
        firstSeenAt:
          iso(row.first_seen_at),
        lastSyncedAt:
          iso(row.last_synced_at),
        resolvedAt:
          iso(row.resolved_at),
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
        paymentReviewProviders:
          providerPaymentReviews.length,
        paymentEligibleProviders:
          providerPaymentReviews.filter(
            (item) => item.paymentEligible
          ).length,
        paymentReviewAttention:
          providerPaymentReviews.filter(
            (item) => !item.paymentEligible
          ).length,
        paymentDisputes: paymentDisputes.length,
        paymentDisputesOpen:
          paymentDisputes.filter(
            (item) => item.resolvedAt === null
          ).length,
        paymentDisputesNeedsResponse:
          paymentDisputes.filter((item) =>
            [
              "needs_response",
              "warning_needs_response",
            ].includes(item.status)
          ).length,
      },
      services,
      requests,
      providerPaymentReviews,
      paymentDisputes,
      boundaries: {
        disputeQueueAvailable: true,
        accountSuspensionAvailable: false,
        paymentOperationsAvailable: false,
        paymentEligibilityReviewAvailable: true,
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

    if (action === "review_provider_payment_eligibility") {
      const providerId = text(input.providerId, 60);
      const decision = text(input.decision, 20);

      if (!validUuid(providerId)) {
        throw new AppointmentsAdminError(
          "Invalid provider id.",
          400,
          "invalid_provider_id"
        );
      }

      if (!["approved", "rejected"].includes(decision)) {
        throw new AppointmentsAdminError(
          "Choose approved or rejected for the provider payment review.",
          400,
          "invalid_payment_review_decision"
        );
      }

      if (note.length < 10) {
        throw new AppointmentsAdminError(
          "A payment-review basis note of at least 10 characters is required.",
          400,
          "payment_review_basis_required"
        );
      }

      const scope =
        await loadProfessionalBookingProviderPaymentReviewScope(
          service,
          providerId
        );

      if (
        scope.serviceIds.length === 0 ||
        scope.businessIds.length === 0
      ) {
        throw new AppointmentsAdminError(
          "This provider does not have a reviewable Professional Booking payment scope.",
          409,
          "payment_review_scope_empty"
        );
      }

      if (
        decision === "approved" &&
        scope.blockers.length > 0
      ) {
        throw new AppointmentsAdminError(
          "Resolve the provider's current payment-review blockers before approval.",
          409,
          "payment_review_scope_blocked"
        );
      }

      const reviewedAt = new Date().toISOString();

      const insertResult = await service
        .from("professional_booking_provider_payment_reviews")
        .insert({
          provider_id: providerId,
          decision,
          policy_version:
            PROFESSIONAL_BOOKING_PROVIDER_PAYMENT_REVIEW_POLICY_VERSION,
          reviewed_business_ids: scope.businessIds,
          reviewed_service_ids: scope.serviceIds,
          scope_fingerprint: scope.fingerprint,
          basis_note: note,
          reviewed_by: administratorId,
          reviewed_at: reviewedAt,
        })
        .select(
          "id,provider_id,decision,policy_version,reviewed_business_ids,reviewed_service_ids,scope_fingerprint,basis_note,reviewed_by,reviewed_at"
        )
        .single();

      if (insertResult.error || !insertResult.data) {
        if (
          /professional_booking_provider_payment_reviews|schema cache|relation .* does not exist/i.test(
            insertResult.error?.message ?? ""
          )
        ) {
          throw new AppointmentsAdminError(
            "The Professional Booking payment-review migration has not been applied.",
            503,
            "payment_review_schema_unavailable"
          );
        }

        throw new AppointmentsAdminError(
          insertResult.error?.message ||
            "Unable to save the provider payment review.",
          503,
          "payment_review_save_failed"
        );
      }

      await logAuditEvent({
        actor_id: administratorId,
        action:
          "admin.professional_booking_provider_payment_reviewed",
        target_type:
          "professional_booking_provider_payment_review",
        target_id: asString(insertResult.data.id),
        metadata: {
          provider_id: providerId,
          decision,
          policy_version:
            PROFESSIONAL_BOOKING_PROVIDER_PAYMENT_REVIEW_POLICY_VERSION,
          scope_fingerprint: scope.fingerprint,
          reviewed_business_ids: scope.businessIds,
          reviewed_service_ids: scope.serviceIds,
          scope_blockers: scope.blockers,
          basis_note: note,
        },
      });

      return response({
        updated: true,
        review: insertResult.data,
        paymentEligible:
          decision === "approved" &&
          scope.blockers.length === 0,
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
