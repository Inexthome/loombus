import { NextRequest, NextResponse } from "next/server";
import {
  recordLegalOperationsAudit,
  requireLegalOperationsAccess,
} from "@/lib/legal-operations/access";

const REGISTRY_FIELDS = [
  "source_key",
  "source_group",
  "display_name",
  "source_kind",
  "system_of_record",
  "data_classes",
  "source_locations",
  "locator_contract",
  "account_deletion_resource_keys",
  "external_processors",
  "inventory_status",
  "unresolved_items",
  "evidence_sources",
  "notes",
  "sort_order",
  "updated_at",
].join(",");

export async function GET(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request, "can_review_requests");
  if (!access.user) return access.response;

  const { service, user, authorization } = access;

  const auditRecorded = await recordLegalOperationsAudit(service, {
    actorId: user.id,
    action: "legal_data_source_registry_view_attempt",
    targetType: "legal_data_source_registry",
    targetId: null,
    metadata: {
      surface: "/admin/legal-operations/data-map",
      registry_version: "20260809053000",
      mode: "metadata_only",
    },
  });

  if (!auditRecorded) {
    return NextResponse.json(
      { error: "The Legal Data Map could not be opened because audit recording failed." },
      { status: 503 }
    );
  }

  const result = await service
    .from("legal_data_source_registry")
    .select(REGISTRY_FIELDS)
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("source_key", { ascending: true });

  if (result.error) {
    return NextResponse.json(
      { error: "Unable to load the Legal Data Source Registry." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    authorization: {
      role: authorization.role,
      can_review_requests: authorization.can_review_requests,
    },
    sources: result.data ?? [],
    phase: {
      metadataOnly: true,
      sourceCollectionEnabled: false,
      exportEnabled: false,
      disclosureApprovalEnabled: false,
      emergencyApprovalEnabled: false,
      memberNoticeSendingEnabled: false,
      externalTransmissionEnabled: false,
    },
  });
}
