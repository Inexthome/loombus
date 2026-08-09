import { NextRequest, NextResponse } from "next/server";
import {
  recordLegalOperationsAudit,
  requireLegalOperationsAccess,
} from "@/lib/legal-operations/access";

const REGISTRY_FIELDS = [
  "record_key",
  "display_name",
  "source_group",
  "source_locations",
  "lifecycle_trigger",
  "normal_retention_rule",
  "timing_status",
  "timing_value",
  "hold_interaction",
  "active_hold_rule",
  "disposition_method",
  "disposition_execution_enabled",
  "counsel_review_required",
  "canonical_register_reference",
  "related_account_deletion_resource_keys",
  "accountable_owner",
  "review_cadence",
  "unresolved_items",
  "evidence_sources",
  "notes",
  "sort_order",
  "updated_at",
].join(",");

function phaseState() {
  return {
    metadataOnly: true,
    fixedRetentionTimelinesApproved: false,
    dispositionExecutionEnabled: false,
    purgeEnabled: false,
    deletionEnabled: false,
    anonymizationEnabled: false,
    archiveMutationEnabled: false,
    exportEnabled: false,
    disclosureApprovalEnabled: false,
    emergencyApprovalEnabled: false,
    memberNoticeSendingEnabled: false,
    externalTransmissionEnabled: false,
  };
}

export async function GET(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request);
  if (!access.user) return access.response;

  const { service, user, authorization } = access;

  // Keep the new capability local to this route so existing Legal Operations
  // surfaces do not depend on the migration column before production migration.
  const capabilityResult = await service
    .from("legal_operations_authorizations")
    .select("can_review_legal_retention")
    .eq("user_id", user.id)
    .maybeSingle();

  if (capabilityResult.error) {
    return NextResponse.json(
      { error: "Legal-retention review capability could not be verified." },
      { status: 503 }
    );
  }

  if (!capabilityResult.data?.can_review_legal_retention) {
    return NextResponse.json(
      { error: "Legal Operations capability can_review_legal_retention is required." },
      { status: 403 }
    );
  }

  const auditRecorded = await recordLegalOperationsAudit(service, {
    actorId: user.id,
    action: "legal_retention_schedule_workspace_view_attempt",
    targetType: "legal_retention_schedule_registry",
    targetId: null,
    metadata: {
      surface: "/admin/legal-operations/retention",
      foundation_version: "20260809062000",
      mode: "metadata_only",
      canonical_register: "public.account_deletion_resource_registry",
    },
  });

  if (!auditRecorded) {
    return NextResponse.json(
      { error: "Legal-retention review was blocked because audit recording failed." },
      { status: 503 }
    );
  }

  const result = await service
    .from("legal_retention_schedule_registry")
    .select(REGISTRY_FIELDS)
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("record_key", { ascending: true });

  if (result.error) {
    return NextResponse.json(
      { error: "Unable to load the Legal Operations retention schedule." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    authorization: {
      role: authorization.role,
      can_review_legal_retention: true,
      can_export: authorization.can_export,
      can_disclose: authorization.can_disclose,
      can_approve_emergency: authorization.can_approve_emergency,
    },
    rows: result.data ?? [],
    phase: phaseState(),
  });
}
