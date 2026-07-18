import "server-only";

import type { NextRequest } from "next/server";
import { createAdminNotifications, createNotification } from "@/lib/notifications";
import {
  ProviderServicesError,
  cleanText,
  cleanUuid,
  normalizeProviderServiceInput,
  optionalUuid,
  requireOwnedPublishedBusiness,
  requireProviderEligibility,
  requireProviderServiceControl,
  resolveViewer,
  uniqueProviderServiceSlug,
  type ProviderServiceInput,
} from "@/lib/provider-services-server-core";

async function validateAttribution(
  request: NextRequest,
  input: ProviderServiceInput,
  existingBusinessId?: string | null,
) {
  const viewer = await resolveViewer(request, true);
  const providerId = viewer.user!.id;
  await requireProviderEligibility(
    viewer.service,
    providerId,
    "publish a public Service",
  );
  const businessId = optionalUuid(input.businessId, "business id");
  if (businessId) {
    await requireOwnedPublishedBusiness(viewer.service, businessId, providerId);
  }
  const appointmentServiceId = optionalUuid(
    input.appointmentServiceId,
    "appointment service id",
  );
  if (appointmentServiceId) {
    const { data } = await viewer.service
      .from("business_appointment_services")
      .select("id, business_id, owner_id, status")
      .eq("id", appointmentServiceId)
      .eq("owner_id", providerId)
      .eq("status", "active")
      .maybeSingle();
    if (
      !data ||
      !businessId ||
      String(data.business_id) !== businessId
    ) {
      throw new ProviderServicesError(
        "Choose an active appointment service from the attributed business.",
        403,
        "appointment_service_not_owned",
      );
    }
  }
  if (existingBusinessId && businessId !== existingBusinessId) {
    // Attribution changes are allowed after the new business is verified.
  }
  return { viewer, providerId, businessId, appointmentServiceId };
}

export async function createProviderService(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const { viewer, providerId, businessId, appointmentServiceId } =
    await validateAttribution(request, input);
  const values = await normalizeProviderServiceInput(
    viewer.service,
    providerId,
    input,
  );
  const slug = await uniqueProviderServiceSlug(viewer.service, values.title);
  const { data, error } = await viewer.service
    .from("provider_services")
    .insert({
      provider_id: providerId,
      business_id: businessId,
      appointment_service_id: appointmentServiceId,
      slug,
      ...values,
      status: "pending",
      moderation_reason: null,
      published_at: null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new ProviderServicesError(
      "Unable to create the Service.",
      503,
      "service_create_failed",
    );
  }
  await createAdminNotifications({
    actor_id: providerId,
    type: "provider_service_review_requested",
    target_type: "provider_service",
    target_id: data.id,
    message: `A public Service is ready for review: ${values.title}`,
  });
  return { id: String(data.id), slug, status: "pending" };
}

export async function updateProviderService(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const initialViewer = await resolveViewer(request, true);
  const serviceId = cleanUuid(input.serviceId, "Service id");
  const existing = await requireProviderServiceControl(initialViewer, serviceId);
  if (["removed"].includes(String(existing.status))) {
    throw new ProviderServicesError(
      "This Service can no longer be edited.",
      409,
      "service_edit_closed",
    );
  }
  const { viewer, providerId, businessId, appointmentServiceId } =
    await validateAttribution(
      request,
      input,
      existing.business_id ? String(existing.business_id) : null,
    );
  const values = await normalizeProviderServiceInput(
    viewer.service,
    providerId,
    input,
  );
  const slug = await uniqueProviderServiceSlug(
    viewer.service,
    values.title,
    serviceId,
  );
  const { error } = await viewer.service
    .from("provider_services")
    .update({
      ...values,
      business_id: businessId,
      appointment_service_id: appointmentServiceId,
      slug,
      status: "pending",
      moderation_reason: null,
    })
    .eq("id", serviceId)
    .eq("provider_id", providerId);
  if (error) {
    throw new ProviderServicesError(
      "Unable to update the Service.",
      503,
      "service_update_failed",
    );
  }
  await createAdminNotifications({
    actor_id: providerId,
    type: "provider_service_review_requested",
    target_type: "provider_service",
    target_id: serviceId,
    message: `An updated public Service is ready for review: ${values.title}`,
  });
  return { id: serviceId, slug, status: "pending" };
}

export async function setProviderServiceLifecycle(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const viewer = await resolveViewer(request, true);
  const serviceId = cleanUuid(input.serviceId, "Service id");
  const action = cleanText(input.action, 40);
  const listing = await requireProviderServiceControl(viewer, serviceId);
  const current = String(listing.status);
  const updates: Record<string, unknown> = {};
  let message = "";

  if (action === "pause") {
    if (current !== "published") {
      throw new ProviderServicesError(
        "Only a published Service can be paused.",
        409,
        "service_published_required",
      );
    }
    updates.status = "paused";
    message = "Service paused.";
  } else if (action === "activate") {
    if (current !== "paused") {
      throw new ProviderServicesError(
        "Only a paused Service can be activated.",
        409,
        "service_paused_required",
      );
    }
    await requireProviderEligibility(
      viewer.service,
      String(listing.provider_id),
      "publish a public Service",
    );
    if (listing.business_id) {
      await requireOwnedPublishedBusiness(
        viewer.service,
        String(listing.business_id),
        String(listing.provider_id),
      );
    }
    updates.status = "published";
    message = "Service activated.";
  } else if (action === "archive") {
    if (["removed", "archived"].includes(current)) {
      throw new ProviderServicesError(
        "This Service cannot be archived.",
        409,
        "service_archive_closed",
      );
    }
    updates.status = "archived";
    message = "Service archived.";
  } else if (action === "reopen") {
    if (!["rejected", "archived"].includes(current)) {
      throw new ProviderServicesError(
        "This Service cannot be reopened.",
        409,
        "service_reopen_closed",
      );
    }
    updates.status = "pending";
    updates.moderation_reason = null;
    message = "Service returned to administrator review.";
    await createAdminNotifications({
      actor_id: viewer.user!.id,
      type: "provider_service_review_requested",
      target_type: "provider_service",
      target_id: serviceId,
      message: `A reopened public Service is ready for review: ${listing.title}`,
    });
  } else {
    throw new ProviderServicesError(
      "Choose a valid Service action.",
      400,
      "invalid_service_action",
    );
  }

  const { data, error } = await viewer.service
    .from("provider_services")
    .update(updates)
    .eq("id", serviceId)
    .eq("provider_id", viewer.user!.id)
    .eq("status", current)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new ProviderServicesError(
      "Unable to update the Service status.",
      503,
      "service_lifecycle_failed",
    );
  }
  if (!data) {
    throw new ProviderServicesError(
      "The Service changed before your action was saved. Refresh and try again.",
      409,
      "service_status_changed",
    );
  }
  return { updated: true, status: updates.status, message };
}

export async function moderateProviderService(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const viewer = await resolveViewer(request, true);
  if (!viewer.isAdmin) {
    throw new ProviderServicesError(
      "Administrator access is required.",
      403,
      "admin_required",
    );
  }
  const serviceId = cleanUuid(input.serviceId, "Service id");
  const decision = cleanText(input.decision, 30);
  const note = cleanText(input.note, 2000) || null;
  const listing = await requireProviderServiceControl(viewer, serviceId);
  const updates: Record<string, unknown> = { moderation_reason: note };

  if (decision === "approve") {
    await requireProviderEligibility(
      viewer.service,
      String(listing.provider_id),
      "publish a public Service",
    );
    if (listing.business_id) {
      await requireOwnedPublishedBusiness(
        viewer.service,
        String(listing.business_id),
        String(listing.provider_id),
      );
    }
    updates.status = "published";
    updates.published_at =
      listing.published_at || new Date().toISOString();
  } else if (decision === "reject") {
    updates.status = "rejected";
  } else if (decision === "remove") {
    updates.status = "removed";
  } else {
    throw new ProviderServicesError(
      "Choose a valid moderation decision.",
      400,
      "invalid_service_decision",
    );
  }

  const { error } = await viewer.service
    .from("provider_services")
    .update(updates)
    .eq("id", serviceId);
  if (error) {
    throw new ProviderServicesError(
      "Unable to moderate the Service.",
      503,
      "service_moderation_failed",
    );
  }
  await createNotification({
    user_id: listing.provider_id,
    actor_id: viewer.user!.id,
    type: "provider_service_status",
    target_type: "provider_service",
    target_id: serviceId,
    message:
      decision === "approve"
        ? `Your Service is now public: ${listing.title}`
        : decision === "reject"
          ? `Your Service needs changes: ${listing.title}`
          : `Your Service was removed: ${listing.title}`,
  });
  return { updated: true, status: updates.status };
}

export async function saveProviderService(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const viewer = await resolveViewer(request, true);
  const serviceId = cleanUuid(input.serviceId, "Service id");
  const { data: listing } = await viewer.service
    .from("provider_services")
    .select("id")
    .eq("id", serviceId)
    .eq("status", "published")
    .maybeSingle();
  if (!listing) {
    throw new ProviderServicesError(
      "Service not found.",
      404,
      "service_not_found",
    );
  }
  const { error } = await viewer.service
    .from("provider_service_saves")
    .upsert(
      { service_id: serviceId, user_id: viewer.user!.id },
      { onConflict: "service_id,user_id", ignoreDuplicates: true },
    );
  if (error) {
    throw new ProviderServicesError(
      "Unable to save the Service.",
      503,
      "service_save_failed",
    );
  }
  return { saved: true };
}

export async function unsaveProviderService(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const viewer = await resolveViewer(request, true);
  const serviceId = cleanUuid(input.serviceId, "Service id");
  const { error } = await viewer.service
    .from("provider_service_saves")
    .delete()
    .eq("service_id", serviceId)
    .eq("user_id", viewer.user!.id);
  if (error) {
    throw new ProviderServicesError(
      "Unable to remove the saved Service.",
      503,
      "service_unsave_failed",
    );
  }
  return { saved: false };
}

export async function reportProviderService(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const viewer = await resolveViewer(request, true);
  const serviceId = cleanUuid(input.serviceId, "Service id");
  const reason = cleanText(input.reason, 120);
  const details = cleanText(input.details, 3000);
  if (!reason || details.length < 10) {
    throw new ProviderServicesError(
      "Choose a reason and explain the concern.",
      400,
      "service_report_details_required",
    );
  }
  const { data: listing } = await viewer.service
    .from("provider_services")
    .select("id, title")
    .eq("id", serviceId)
    .eq("status", "published")
    .maybeSingle();
  if (!listing) {
    throw new ProviderServicesError(
      "Service not found.",
      404,
      "service_not_found",
    );
  }
  const { data: existing } = await viewer.service
    .from("provider_service_reports")
    .select("id")
    .eq("service_id", serviceId)
    .eq("reporter_id", viewer.user!.id)
    .eq("status", "open")
    .maybeSingle();
  if (existing) {
    throw new ProviderServicesError(
      "You already have an open report for this Service.",
      409,
      "service_report_already_open",
    );
  }
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await viewer.service
    .from("provider_service_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", viewer.user!.id)
    .gte("created_at", since);
  if ((count ?? 0) >= 10) {
    throw new ProviderServicesError(
      "You have reached the Service report limit for this hour.",
      429,
      "service_report_rate_limited",
    );
  }
  const { data, error } = await viewer.service
    .from("provider_service_reports")
    .insert({
      service_id: serviceId,
      reporter_id: viewer.user!.id,
      reason,
      details,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new ProviderServicesError(
      "Unable to submit the Service report.",
      503,
      "service_report_failed",
    );
  }
  await createAdminNotifications({
    actor_id: viewer.user!.id,
    type: "provider_service_report_received",
    target_type: "provider_service",
    target_id: serviceId,
    message: `A public Service was reported: ${listing.title}`,
  });
  return { submitted: true };
}

export async function reviewProviderServiceReport(
  request: NextRequest,
  input: ProviderServiceInput,
) {
  const viewer = await resolveViewer(request, true);
  if (!viewer.isAdmin) {
    throw new ProviderServicesError(
      "Administrator access is required.",
      403,
      "admin_required",
    );
  }
  const reportId = cleanUuid(input.reportId, "report id");
  const decision = cleanText(input.decision, 30);
  if (!["resolve", "dismiss"].includes(decision)) {
    throw new ProviderServicesError(
      "Choose a valid report decision.",
      400,
      "invalid_report_decision",
    );
  }
  const { data, error } = await viewer.service
    .from("provider_service_reports")
    .update({
      status: decision === "resolve" ? "resolved" : "dismissed",
      reviewed_by: viewer.user!.id,
      reviewed_at: new Date().toISOString(),
      decision_note: cleanText(input.note, 2000) || null,
    })
    .eq("id", reportId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (error) {
    throw new ProviderServicesError(
      "Unable to review the Service report.",
      503,
      "service_report_review_failed",
    );
  }
  if (!data) {
    throw new ProviderServicesError(
      "This Service report is no longer open.",
      409,
      "service_report_review_closed",
    );
  }
  return { updated: true };
}
