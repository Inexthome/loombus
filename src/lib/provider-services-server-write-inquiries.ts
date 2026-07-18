import "server-only";

import type { NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";
import {
  ProviderServicesError,
  cleanText,
  cleanUuid,
  ensureNotBlocked,
  findExistingConversation,
  optionalIso,
  optionalNumber,
  optionalUuid,
  requireProviderEligibility,
  requireProviderServiceControl,
  resolveViewer,
  type ProviderServiceInput,
} from "@/lib/provider-services-server-core";

export async function createProviderServiceInquiry(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const viewer = await resolveViewer(request, true);
  const requesterId = viewer.user!.id;
  const serviceId = cleanUuid(input.serviceId, "Service id");
  const { data: listing, error } = await viewer.service
    .from("provider_services")
    .select("*")
    .eq("id", serviceId)
    .eq("status", "published")
    .maybeSingle();
  if (error || !listing) {
    throw new ProviderServicesError(
      "This Service is no longer accepting inquiries.",
      409,
      "service_inquiry_closed",
    );
  }
  if (listing.provider_id === requesterId) {
    throw new ProviderServicesError(
      "You cannot inquire about your own Service.",
      400,
      "self_inquiry_not_allowed",
    );
  }
  await Promise.all([
    requireProviderEligibility(
      viewer.service,
      requesterId,
      "send a Service inquiry",
    ),
    requireProviderEligibility(
      viewer.service,
      String(listing.provider_id),
      "receive Service inquiries",
    ),
    ensureNotBlocked(
      viewer.service,
      requesterId,
      String(listing.provider_id),
    ),
  ]);

  const message = cleanText(input.message, 8000);
  const preferredStart = optionalIso(input.preferredStart, "preferred start");
  const preferredEnd = optionalIso(input.preferredEnd, "preferred end");
  const budgetMin = optionalNumber(input.budgetMin, "minimum budget");
  const budgetMax = optionalNumber(input.budgetMax, "maximum budget");
  const currency = (cleanText(input.currency, 3) || "USD").toUpperCase();
  const linkedRequestId = optionalUuid(input.linkedRequestId, "Request id");

  if (message.length < 20) {
    throw new ProviderServicesError(
      "Explain what you need in at least 20 characters.",
      400,
      "inquiry_message_required",
    );
  }
  if (
    preferredStart &&
    preferredEnd &&
    new Date(preferredEnd).getTime() <= new Date(preferredStart).getTime()
  ) {
    throw new ProviderServicesError(
      "The preferred end must be after the preferred start.",
      400,
      "invalid_inquiry_time_range",
    );
  }
  if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
    throw new ProviderServicesError(
      "The maximum budget cannot be lower than the minimum budget.",
      400,
      "invalid_inquiry_budget_range",
    );
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ProviderServicesError(
      "Use a three-letter currency code.",
      400,
      "invalid_currency",
    );
  }

  if (linkedRequestId) {
    const { data: linked } = await viewer.service
      .from("service_requests")
      .select("id")
      .eq("id", linkedRequestId)
      .eq("requester_id", requesterId)
      .in("status", ["open", "reviewing"])
      .is("selected_response_id", null)
      .maybeSingle();
    if (!linked) {
      throw new ProviderServicesError(
        "Choose one of your open Requests.",
        403,
        "linked_request_not_owned",
      );
    }
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await viewer.service
    .from("provider_service_inquiries")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", requesterId)
    .gte("created_at", since);
  if ((count ?? 0) >= 20) {
    throw new ProviderServicesError(
      "You have reached the Service inquiry limit for this hour.",
      429,
      "service_inquiry_rate_limited",
    );
  }
  const { data: existing } = await viewer.service
    .from("provider_service_inquiries")
    .select("id")
    .eq("service_id", serviceId)
    .eq("requester_id", requesterId)
    .in("status", ["submitted", "accepted"])
    .maybeSingle();
  if (existing) {
    throw new ProviderServicesError(
      "You already have an active inquiry for this Service.",
      409,
      "service_inquiry_already_exists",
    );
  }

  const { data, error: insertError } = await viewer.service
    .from("provider_service_inquiries")
    .insert({
      service_id: serviceId,
      provider_id: listing.provider_id,
      requester_id: requesterId,
      linked_request_id: linkedRequestId,
      message,
      preferred_start: preferredStart,
      preferred_end: preferredEnd,
      budget_min: budgetMin,
      budget_max: budgetMax,
      currency,
      status: "submitted",
    })
    .select("id")
    .single();
  if (insertError || !data) {
    throw new ProviderServicesError(
      "Unable to send the Service inquiry.",
      503,
      "service_inquiry_create_failed",
    );
  }
  await createNotification({
    user_id: listing.provider_id,
    actor_id: requesterId,
    type: "provider_service_inquiry",
    target_type: "provider_service",
    target_id: serviceId,
    message: `A member inquired about your Service: ${listing.title}`,
  });
  return { id: String(data.id), status: "submitted" };
}

export async function providerServiceInquiryAction(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const viewer = await resolveViewer(request, true);
  const inquiryId = cleanUuid(input.inquiryId, "inquiry id");
  const decision = cleanText(input.decision, 30);
  const { data: inquiry, error } = await viewer.service
    .from("provider_service_inquiries")
    .select("*")
    .eq("id", inquiryId)
    .eq("provider_id", viewer.user!.id)
    .maybeSingle();
  if (error || !inquiry) {
    throw new ProviderServicesError(
      "Service inquiry not found.",
      404,
      "service_inquiry_not_found",
    );
  }
  const listing = await requireProviderServiceControl(
    viewer,
    String(inquiry.service_id),
  );

  if (decision === "decline") {
    const { data, error: updateError } = await viewer.service
      .from("provider_service_inquiries")
      .update({ status: "declined" })
      .eq("id", inquiryId)
      .eq("provider_id", viewer.user!.id)
      .eq("status", "submitted")
      .select("id")
      .maybeSingle();
    if (updateError) {
      throw new ProviderServicesError(
        "Unable to decline the Service inquiry.",
        503,
        "service_inquiry_decline_failed",
      );
    }
    if (!data) {
      throw new ProviderServicesError(
        "This Service inquiry is no longer awaiting a response.",
        409,
        "service_inquiry_response_closed",
      );
    }
    await createNotification({
      user_id: inquiry.requester_id,
      actor_id: viewer.user!.id,
      type: "provider_service_inquiry_status",
      target_type: "provider_service",
      target_id: inquiry.service_id,
      message: `Your inquiry was declined for “${listing.title}.”`,
    });
    return { updated: true, status: "declined" };
  }

  if (decision !== "accept") {
    throw new ProviderServicesError(
      "Choose a valid inquiry decision.",
      400,
      "invalid_inquiry_decision",
    );
  }
  if (String(inquiry.status) !== "submitted") {
    throw new ProviderServicesError(
      "This Service inquiry is no longer awaiting a response.",
      409,
      "service_inquiry_response_closed",
    );
  }
  await ensureNotBlocked(
    viewer.service,
    String(inquiry.provider_id),
    String(inquiry.requester_id),
  );
  let conversationId = await findExistingConversation(
    viewer.service,
    String(inquiry.provider_id),
    String(inquiry.requester_id),
  );
  const now = new Date().toISOString();
  if (!conversationId) {
    const { data: conversation, error: conversationError } = await viewer.service
      .from("private_conversations")
      .insert({ created_by: inquiry.provider_id, updated_at: now })
      .select("id")
      .single();
    if (conversationError || !conversation) {
      throw new ProviderServicesError(
        "Unable to start the private conversation.",
        503,
        "conversation_create_failed",
      );
    }
    conversationId = String(conversation.id);
    const { error: memberError } = await viewer.service
      .from("private_conversation_members")
      .insert([
        {
          conversation_id: conversationId,
          user_id: inquiry.provider_id,
        },
        {
          conversation_id: conversationId,
          user_id: inquiry.requester_id,
        },
      ]);
    if (memberError) {
      throw new ProviderServicesError(
        "Unable to start the private conversation.",
        503,
        "conversation_members_failed",
      );
    }
  }

  const { data: changed, error: updateError } = await viewer.service
    .from("provider_service_inquiries")
    .update({ status: "accepted", conversation_id: conversationId })
    .eq("id", inquiryId)
    .eq("provider_id", viewer.user!.id)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (updateError) {
    throw new ProviderServicesError(
      "Unable to accept the Service inquiry.",
      503,
      "service_inquiry_accept_failed",
    );
  }
  if (!changed) {
    throw new ProviderServicesError(
      "The Service inquiry changed before your response was saved.",
      409,
      "service_inquiry_status_changed",
    );
  }
  await viewer.service
    .from("private_conversation_members")
    .update({ deleted_at: null, archived_at: null })
    .eq("conversation_id", conversationId)
    .in("user_id", [inquiry.provider_id, inquiry.requester_id]);

  let linkedRequestLine = "";
  if (inquiry.linked_request_id) {
    const { data: linkedRequest } = await viewer.service
      .from("service_requests")
      .select("slug")
      .eq("id", inquiry.linked_request_id)
      .maybeSingle();
    if (linkedRequest?.slug) {
      linkedRequestLine = `\nLinked Request: https://loombus.com/requests/${linkedRequest.slug}`;
    }
  }
  const { data: message, error: messageError } = await viewer.service
    .from("private_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: inquiry.provider_id,
      message_type: "text",
      body: `Service inquiry accepted: ${listing.title}\nhttps://loombus.com/services/${listing.slug}${linkedRequestLine}`,
      created_at: now,
    })
    .select("id")
    .single();
  if (messageError || !message) {
    throw new ProviderServicesError(
      "The inquiry was accepted, but the opening message could not be sent.",
      503,
      "service_inquiry_message_failed",
    );
  }
  await viewer.service
    .from("private_conversations")
    .update({ updated_at: now, last_message_at: now })
    .eq("id", conversationId);
  await createNotification({
    user_id: inquiry.requester_id,
    actor_id: inquiry.provider_id,
    type: "new_message",
    target_type: "conversation",
    target_id: conversationId,
    message: `Your inquiry was accepted for “${listing.title}.”`,
  });
  await logAuditEvent({
    actor_id: inquiry.provider_id,
    action: "provider_service.inquiry_accepted",
    target_type: "provider_service",
    target_id: listing.id,
    metadata: {
      inquiry_id: inquiryId,
      requester_id: inquiry.requester_id,
      conversation_id: conversationId,
      message_id: message.id,
    },
  });
  return { updated: true, status: "accepted", conversationId };
}

export async function requesterServiceInquiryAction(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const viewer = await resolveViewer(request, true);
  const inquiryId = cleanUuid(input.inquiryId, "inquiry id");
  const action = cleanText(input.inquiryAction, 30);
  const { data: inquiry, error } = await viewer.service
    .from("provider_service_inquiries")
    .select("*")
    .eq("id", inquiryId)
    .eq("requester_id", viewer.user!.id)
    .maybeSingle();
  if (error || !inquiry) {
    throw new ProviderServicesError(
      "Service inquiry not found.",
      404,
      "service_inquiry_not_found",
    );
  }
  const current = String(inquiry.status);
  let nextStatus: "cancelled" | "closed";
  if (action === "cancel") {
    if (!["submitted", "accepted"].includes(current)) {
      throw new ProviderServicesError(
        "This Service inquiry can no longer be cancelled.",
        409,
        "service_inquiry_cancel_closed",
      );
    }
    nextStatus = "cancelled";
  } else if (action === "close") {
    if (current !== "accepted") {
      throw new ProviderServicesError(
        "Only an accepted Service inquiry can be closed.",
        409,
        "service_inquiry_accepted_required",
      );
    }
    nextStatus = "closed";
  } else {
    throw new ProviderServicesError(
      "Choose a valid inquiry action.",
      400,
      "invalid_inquiry_action",
    );
  }
  const { data, error: updateError } = await viewer.service
    .from("provider_service_inquiries")
    .update({ status: nextStatus })
    .eq("id", inquiryId)
    .eq("requester_id", viewer.user!.id)
    .eq("status", current)
    .select("id")
    .maybeSingle();
  if (updateError) {
    throw new ProviderServicesError(
      "Unable to update the Service inquiry.",
      503,
      "service_inquiry_action_failed",
    );
  }
  if (!data) {
    throw new ProviderServicesError(
      "The Service inquiry changed before your action was saved.",
      409,
      "service_inquiry_status_changed",
    );
  }
  await createNotification({
    user_id: inquiry.provider_id,
    actor_id: viewer.user!.id,
    type: "provider_service_inquiry_status",
    target_type: "provider_service",
    target_id: inquiry.service_id,
    message:
      nextStatus === "closed"
        ? "A Service inquiry was closed."
        : "A Service inquiry was cancelled.",
  });
  return { updated: true, status: nextStatus };
}

export async function providerCloseServiceInquiry(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const viewer = await resolveViewer(request, true);
  const inquiryId = cleanUuid(input.inquiryId, "inquiry id");
  const { data: inquiry } = await viewer.service
    .from("provider_service_inquiries")
    .select("*")
    .eq("id", inquiryId)
    .eq("provider_id", viewer.user!.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (!inquiry) {
    throw new ProviderServicesError(
      "Only an accepted Service inquiry can be closed.",
      409,
      "service_inquiry_accepted_required",
    );
  }
  const { data, error } = await viewer.service
    .from("provider_service_inquiries")
    .update({ status: "closed" })
    .eq("id", inquiryId)
    .eq("provider_id", viewer.user!.id)
    .eq("status", "accepted")
    .select("id")
    .maybeSingle();
  if (error) {
    throw new ProviderServicesError(
      "Unable to close the Service inquiry.",
      503,
      "service_inquiry_close_failed",
    );
  }
  if (!data) {
    throw new ProviderServicesError(
      "The Service inquiry changed before your action was saved.",
      409,
      "service_inquiry_status_changed",
    );
  }
  await createNotification({
    user_id: inquiry.requester_id,
    actor_id: viewer.user!.id,
    type: "provider_service_inquiry_status",
    target_type: "provider_service",
    target_id: inquiry.service_id,
    message: "The provider closed your Service inquiry.",
  });
  return { updated: true, status: "closed" };
}
