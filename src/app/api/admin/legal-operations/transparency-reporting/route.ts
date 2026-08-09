import { NextRequest, NextResponse } from "next/server";
import {
  recordLegalOperationsAudit,
  requireLegalOperationsAccess,
} from "@/lib/legal-operations/access";

const REGISTRY_FIELDS = [
  "control_key",
  "control_kind",
  "display_name",
  "source_fields",
  "aggregation_contract",
  "null_handling",
  "publication_approval_status",
  "aggregation_execution_enabled",
  "publication_enabled",
  "request_specific_data_allowed",
  "counsel_review_required",
  "suppression_rule_required",
  "unresolved_items",
  "evidence_sources",
  "notes",
  "sort_order",
  "updated_at",
].join(",");

function phaseState() {
  return {
    methodologyOnly: true,
    aggregationExecutionEnabled: false,
    snapshotGenerationEnabled: false,
    requestSpecificDataEnabled: false,
    publicPublicationEnabled: false,
    publicTransparencyPageEnabled: false,
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

  // Keep this capability local to the new route so existing Legal Operations
  // surfaces do not depend on the migration column before production migration.
  const capabilityResult = await service
    .from("legal_operations_authorizations")
    .select("can_review_transparency_reporting")
    .eq("user_id", user.id)
    .maybeSingle();

  if (capabilityResult.error) {
    return NextResponse.json(
      { error: "Transparency-reporting review capability could not be verified." },
      { status: 503 }
    );
  }

  if (!capabilityResult.data?.can_review_transparency_reporting) {
    return NextResponse.json(
      { error: "Legal Operations capability can_review_transparency_reporting is required." },
      { status: 403 }
    );
  }

  const auditRecorded = await recordLegalOperationsAudit(service, {
    actorId: user.id,
    action: "legal_transparency_reporting_workspace_view_attempt",
    targetType: "legal_transparency_reporting_registry",
    targetId: null,
    metadata: {
      surface: "/admin/legal-operations/transparency-reporting",
      foundation_version: "20260809064500",
      mode: "methodology_only",
      aggregation_execution_enabled: false,
      publication_enabled: false,
    },
  });

  if (!auditRecorded) {
    return NextResponse.json(
      { error: "Transparency-reporting review was blocked because audit recording failed." },
      { status: 503 }
    );
  }

  const result = await service
    .from("legal_transparency_reporting_registry")
    .select(REGISTRY_FIELDS)
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("control_key", { ascending: true });

  if (result.error) {
    return NextResponse.json(
      { error: "Unable to load the Legal Operations transparency-reporting methodology." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    authorization: {
      role: authorization.role,
      can_review_transparency_reporting: true,
      can_export: authorization.can_export,
      can_disclose: authorization.can_disclose,
      can_approve_emergency: authorization.can_approve_emergency,
    },
    rows: result.data ?? [],
    phase: phaseState(),
  });
}
