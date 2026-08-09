import { NextRequest, NextResponse } from "next/server";
import {
  recordLegalOperationsAudit,
  requireLegalOperationsAccess,
} from "@/lib/legal-operations/access";

function phaseState() {
  return {
    integrityReviewEnabled: true,
    exportGenerationEnabled: false,
    packageMutationEnabled: false,
    artifactRegistrationEnabled: false,
    verificationRecordingEnabled: false,
    custodyEventRecordingEnabled: false,
    externalTransferEnabled: false,
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

  // This capability is intentionally queried locally so deployment of the app does
  // not make existing Legal Operations routes depend on the new migration column.
  const capabilityResult = await service
    .from("legal_operations_authorizations")
    .select("can_review_export_integrity")
    .eq("user_id", user.id)
    .maybeSingle();

  if (capabilityResult.error) {
    return NextResponse.json(
      { error: "Export-integrity review capability could not be verified." },
      { status: 503 }
    );
  }

  if (!capabilityResult.data?.can_review_export_integrity) {
    return NextResponse.json(
      { error: "Legal Operations capability can_review_export_integrity is required." },
      { status: 403 }
    );
  }

  const auditRecorded = await recordLegalOperationsAudit(service, {
    actorId: user.id,
    action: "legal_export_integrity_workspace_view_attempt",
    targetType: "legal_export_integrity_workspace",
    targetId: null,
    metadata: {
      surface: "/admin/legal-operations/export-integrity",
      foundation_version: "20260809060000",
      mode: "metadata_only",
    },
  });

  if (!auditRecorded) {
    return NextResponse.json(
      { error: "Export-integrity review was blocked because audit recording failed." },
      { status: 503 }
    );
  }

  const [packagesResult, artifactsResult, verificationsResult, custodyResult] =
    await Promise.all([
      service
        .from("legal_export_packages")
        .select(
          "id,request_id,disclosure_id,status,package_label,manifest_item_count,artifact_count,total_bytes,manifest_sha256,package_sha256,generated_at,verified_at,sealed_at,voided_at,created_at,updated_at"
        )
        .order("created_at", { ascending: false })
        .limit(250),
      service
        .from("legal_export_artifacts")
        .select(
          "id,package_id,disclosure_item_id,artifact_role,file_name,media_type,byte_size,sha256,created_at"
        )
        .order("created_at", { ascending: true })
        .limit(1000),
      service
        .from("legal_export_verifications")
        .select(
          "id,package_id,verification_type,result,expected_digest,observed_digest,expected_count,observed_count,verification_note,verified_at,created_at"
        )
        .order("created_at", { ascending: true })
        .limit(1000),
      service
        .from("legal_chain_of_custody_events")
        .select(
          "id,package_id,event_type,custody_location_ref,counterparty_reference,event_summary,occurred_at,created_at"
        )
        .order("occurred_at", { ascending: true })
        .limit(1000),
    ]);

  if (
    packagesResult.error ||
    artifactsResult.error ||
    verificationsResult.error ||
    custodyResult.error
  ) {
    return NextResponse.json(
      { error: "Unable to load export-integrity foundation metadata." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    authorization: {
      role: authorization.role,
      can_review_export_integrity: true,
      can_export: authorization.can_export,
      can_disclose: authorization.can_disclose,
      can_approve_emergency: authorization.can_approve_emergency,
    },
    packages: packagesResult.data ?? [],
    artifacts: artifactsResult.data ?? [],
    verifications: verificationsResult.data ?? [],
    custodyEvents: custodyResult.data ?? [],
    phase: phaseState(),
  });
}
