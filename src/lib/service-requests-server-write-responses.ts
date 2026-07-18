import "server-only";

import type { NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";
import {
  ServiceRequestsError,
  cleanText,
  cleanUuid,
  ensureNotBlocked,
  findExistingConversation,
  optionalNumber,
  optionalUuid,
  requireEligibility,
  requireOwnedPublishedBusiness,
  requireRequestControl,
  resolveViewer,
  type ServiceRequestInput,
} from "@/lib/service-requests-server-core";

export async function respondToServiceRequest(
  request: NextRequest,
  input: ServiceRequestInput,
) {
  const viewer = await resolveViewer(request, true);
  const responderId = viewer.user!.id;
  const requestId = cleanUuid(input.requestId, "Request id");
  const { data: row, error } = await viewer.service
    .from("service_requests")
    .select("*")
    .eq("id", requestId)
    .eq("status", "open")
    .maybeSingle();
  if (error || !row) {
    throw new ServiceRequestsError(
      "This Request is no longer accepting responses.",
      409,
      "request_response_closed",
    );
  }
  if (row.requester_id === responderId) {
    throw new ServiceRequestsError(
      "You cannot respond to your own Request.",
      400,
      "self_response_not_allowed",
    );
  }
  await Promise.all([
    requireEligibility(
      viewer.service,
      responderId,
      "respond to a public Request",
    ),
    requireEligibility(
      viewer.service,
      String(row.requester_id),
      "receive public Request responses",
    ),
    ensureNotBlocked(viewer.service, responderId, String(row.requester_id)),
  ]);

  let message = cleanText(input.message, 8000);
  const availabilityText = cleanText(input.availabilityText, 1000) || null;
  const estimateMin = optionalNumber(input.estimateMin, "minimum estimate");
  const estimateMax = optionalNumber(input.estimateMax, "maximum estimate");
  const currency = (cleanText(input.currency, 3) || "USD").toUpperCase();
  if (message.length < 20) {
    throw new ServiceRequestsError(
      "Explain how you can help in at least 20 characters.",
      400,
      "response_message_required",
    );
  }
  if (
    estimateMin !== null &&
    estimateMax !== null &&
    estimateMax < estimateMin
  ) {
    throw new ServiceRequestsError(
      "The maximum estimate cannot be lower than the minimum estimate.",
      400,
      "invalid_estimate_range",
    );
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ServiceRequestsError(
      "Use a three-letter currency code.",
      400,
      "invalid_currency",
    );
  }

  const providerServiceId = optionalUuid(
    input.providerServiceId,
    "provider Service id",
  );
  let businessId = optionalUuid(input.businessId, "business id");
  let appointmentServiceId = optionalUuid(
    input.appointmentServiceId,
    "appointment service id",
  );

  if (providerServiceId) {
    const { data: providerService, error: providerServiceError } =
      await viewer.service
        .from("provider_services")
        .select(
          "id, provider_id, business_id, appointment_service_id, title, slug, category, status",
        )
        .eq("id", providerServiceId)
        .eq("provider_id", responderId)
        .eq("status", "published")
        .maybeSingle();
    if (providerServiceError || !providerService) {
      throw new ServiceRequestsError(
        "Choose one of your published Services.",
        403,
        "provider_service_not_owned",
      );
    }
    if (String(providerService.category) !== String(row.category)) {
      throw new ServiceRequestsError(
        "Choose a published Service in the same category as this Request.",
        400,
        "provider_service_category_mismatch",
      );
    }
    const attributedBusinessId = providerService.business_id
      ? String(providerService.business_id)
      : null;
    const linkedAppointmentId = providerService.appointment_service_id
      ? String(providerService.appointment_service_id)
      : null;
    if (businessId && businessId !== attributedBusinessId) {
      throw new ServiceRequestsError(
        "The response business must match the selected Service.",
        400,
        "provider_service_business_mismatch",
      );
    }
    if (appointmentServiceId && appointmentServiceId !== linkedAppointmentId) {
      throw new ServiceRequestsError(
        "The appointment connection must match the selected Service.",
        400,
        "provider_service_appointment_mismatch",
      );
    }
    businessId = attributedBusinessId;
    appointmentServiceId = linkedAppointmentId;
    message = `Published Service: ${providerService.title}\nhttps://loombus.com/services/${providerService.slug}\n\n${message}`.slice(
      0,
      8000,
    );
  }

  if (businessId) {
    await requireOwnedPublishedBusiness(
      viewer.service,
      businessId,
      responderId,
    );
  }
  if (appointmentServiceId) {
    const { data: service } = await viewer.service
      .from("business_appointment_services")
      .select("id, business_id")
      .eq("id", appointmentServiceId)
      .eq("owner_id", responderId)
      .eq("status", "active")
      .maybeSingle();
    if (!service || (businessId && service.business_id !== businessId)) {
      throw new ServiceRequestsError(
        "Choose an active appointment service from the attributed business.",
        403,
        "appointment_service_not_owned",
      );
    }
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await viewer.service
    .from("service_request_responses")
    .select("id", { count: "exact", head: true })
    .eq("responder_id", responderId)
    .gte("created_at", since);
  if ((count ?? 0) >= 20) {
    throw new ServiceRequestsError(
      "You have reached the Request response limit for this hour.",
      429,
      "response_rate_limited",
    );
  }
  const { data: existing } = await viewer.service
    .from("service_request_responses")
    .select("id")
    .eq("request_id", requestId)
    .eq("responder_id", responderId)
    .neq("status", "withdrawn")
    .maybeSingle();
  if (existing) {
    throw new ServiceRequestsError(
      "You already responded to this Request.",
      409,
      "response_already_exists",
    );
  }
  const { data, error: insertError } = await viewer.service
    .from("service_request_responses")
    .insert({
      request_id: requestId,
      responder_id: responderId,
      business_id: businessId,
      provider_service_id: providerServiceId,
      message,
      availability_text: availabilityText,
      estimate_min: estimateMin,
      estimate_max: estimateMax,
      currency,
      appointment_service_id: appointmentServiceId,
      status: "submitted",
    })
    .select("id")
    .single();
  if (insertError || !data) {
    throw new ServiceRequestsError(
      "Unable to submit the Request response.",
      503,
      "response_create_failed",
    );
  }
  await createNotification({
    user_id: row.requester_id,
    actor_id: responderId,
    type: "service_request_response",
    target_type: "service_request",
    target_id: requestId,
    message: `A member responded to your Request: ${row.title}`,
  });
  return { id: data.id, status: "submitted" };
}

export async function withdrawServiceRequestResponse(
  request: NextRequest,
  input: ServiceRequestInput,
) {
  const viewer = await resolveViewer(request, true);
  const responseId = cleanUuid(input.responseId, "response id");
  const { data, error } = await viewer.service
    .from("service_request_responses")
    .update({ status: "withdrawn" })
    .eq("id", responseId)
    .eq("responder_id", viewer.user!.id)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (error) {
    throw new ServiceRequestsError(
      "Unable to withdraw the response.",
      503,
      "response_withdraw_failed",
    );
  }
  if (!data) {
    throw new ServiceRequestsError(
      "This response can no longer be withdrawn.",
      409,
      "response_withdraw_closed",
    );
  }
  return { updated: true, status: "withdrawn" };
}

export async function selectServiceRequestResponse(
  request: NextRequest,
  input: ServiceRequestInput,
) {
  const viewer = await resolveViewer(request, true);
  const requestId = cleanUuid(input.requestId, "Request id");
  const responseId = cleanUuid(input.responseId, "response id");
  const row = await requireRequestControl(viewer, requestId);
  if (row.requester_id !== viewer.user!.id) {
    throw new ServiceRequestsError(
      "Only the requester may select a response.",
      403,
      "response_selection_forbidden",
    );
  }
  if (
    !["open", "reviewing"].includes(String(row.status)) ||
    row.selected_response_id
  ) {
    throw new ServiceRequestsError(
      "This Request is no longer selecting responses.",
      409,
      "response_selection_closed",
    );
  }
  const { data: selected } = await viewer.service
    .from("service_request_responses")
    .select("*")
    .eq("id", responseId)
    .eq("request_id", requestId)
    .eq("status", "submitted")
    .maybeSingle();
  if (!selected) {
    throw new ServiceRequestsError(
      "Response not found.",
      404,
      "response_not_found",
    );
  }
  await ensureNotBlocked(
    viewer.service,
    String(row.requester_id),
    String(selected.responder_id),
  );
  let conversationId = await findExistingConversation(
    viewer.service,
    String(row.requester_id),
    String(selected.responder_id),
  );
  const now = new Date().toISOString();
  if (!conversationId) {
    const { data: conversation, error } = await viewer.service
      .from("private_conversations")
      .insert({ created_by: row.requester_id, updated_at: now })
      .select("id")
      .single();
    if (error || !conversation) {
      throw new ServiceRequestsError(
        "Unable to start the private conversation.",
        503,
        "conversation_create_failed",
      );
    }
    conversationId = String(conversation.id);
    const { error: memberError } = await viewer.service
      .from("private_conversation_members")
      .insert([
        { conversation_id: conversationId, user_id: row.requester_id },
        { conversation_id: conversationId, user_id: selected.responder_id },
      ]);
    if (memberError) {
      throw new ServiceRequestsError(
        "Unable to start the private conversation.",
        503,
        "conversation_members_failed",
      );
    }
  }
  const { data: changed } = await viewer.service
    .from("service_requests")
    .update({ selected_response_id: responseId, status: "in_progress" })
    .eq("id", requestId)
    .is("selected_response_id", null)
    .in("status", ["open", "reviewing"])
    .select("id")
    .maybeSingle();
  if (!changed) {
    throw new ServiceRequestsError(
      "Another response was selected first. Refresh the workspace.",
      409,
      "response_selection_changed",
    );
  }
  await Promise.all([
    viewer.service
      .from("service_request_responses")
      .update({ status: "selected", conversation_id: conversationId })
      .eq("id", responseId),
    viewer.service
      .from("service_request_responses")
      .update({ status: "declined" })
      .eq("request_id", requestId)
      .neq("id", responseId)
      .eq("status", "submitted"),
    viewer.service
      .from("private_conversation_members")
      .update({ deleted_at: null, archived_at: null })
      .eq("conversation_id", conversationId)
      .in("user_id", [row.requester_id, selected.responder_id]),
  ]);
  const { data: message, error: messageError } = await viewer.service
    .from("private_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: row.requester_id,
      message_type: "text",
      body: `Request response selected: ${row.title}\nhttps://loombus.com/requests/${row.slug}`,
      created_at: now,
    })
    .select("id")
    .single();
  if (messageError || !message) {
    throw new ServiceRequestsError(
      "The response was selected, but the opening message could not be sent.",
      503,
      "response_message_failed",
    );
  }
  await viewer.service
    .from("private_conversations")
    .update({ updated_at: now, last_message_at: now })
    .eq("id", conversationId);
  await createNotification({
    user_id: selected.responder_id,
    actor_id: row.requester_id,
    type: "new_message",
    target_type: "conversation",
    target_id: conversationId,
    message: `Your response was selected for “${row.title}.”`,
  });
  await logAuditEvent({
    actor_id: row.requester_id,
    action: "service_request.response_selected",
    target_type: "service_request",
    target_id: requestId,
    metadata: {
      response_id: responseId,
      responder_id: selected.responder_id,
      conversation_id: conversationId,
      message_id: message.id,
      provider_service_id: selected.provider_service_id ?? null,
    },
  });
  return { selected: true, conversationId, status: "in_progress" };
}
