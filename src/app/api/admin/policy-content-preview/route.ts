import { NextRequest, NextResponse } from "next/server";
import accessibilitySuccessorPayload from "@/content/policies/POLICY-ACCESSIBILITY/2026.08.10.1.json";
import {
  evaluatePolicyVersionPublicationEligibility,
  findPolicyDocumentFamily,
  policyContentRegistry,
} from "@/lib/policy-content-registry";
import { validateStructuredPolicyPayload } from "@/lib/policy-content-payload";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase } from "@/lib/room-operations";

const ACCESSIBILITY_DOCUMENT_ID = "POLICY-ACCESSIBILITY";
const ACCESSIBILITY_SUCCESSOR_VERSION = "2026.08.10.1";
const ACCESSIBILITY_SUCCESSOR_PAYLOAD_PATH =
  "src/content/policies/POLICY-ACCESSIBILITY/2026.08.10.1.json";
const PREVIEWABLE_STATUSES = new Set([
  "internal_draft",
  "review",
  "approved",
  "scheduled",
]);

const PREVIEW_PAYLOADS: Readonly<
  Record<
    string,
    {
      payloadPath: string;
      payload: unknown;
    }
  >
> = {
  [`${ACCESSIBILITY_DOCUMENT_ID}:${ACCESSIBILITY_SUCCESSOR_VERSION}`]: {
    payloadPath: ACCESSIBILITY_SUCCESSOR_PAYLOAD_PATH,
    payload: accessibilitySuccessorPayload,
  },
};

class PolicyPreviewError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "policy_preview_error",
  ) {
    super(message);
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Vary: "Authorization",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof PolicyPreviewError) {
    return jsonResponse({ error: error.message, code: error.code }, error.status);
  }

  console.error("Policy content preview request failed:", error);
  return jsonResponse(
    {
      error: "The policy content preview could not be loaded.",
      code: "policy_preview_failed",
    },
    500,
  );
}

async function requireAdministrator(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));

  if (!access.ok) {
    throw new PolicyPreviewError(
      access.error,
      access.status,
      access.code ?? "account_access_denied",
    );
  }

  if (access.profile.is_admin !== true) {
    throw new PolicyPreviewError(
      "Administrator access is required.",
      403,
      "administrator_required",
    );
  }

  return access.user.id;
}

function boundedQueryValue(value: string | null, maximum = 120) {
  const next = value?.trim() ?? "";
  return next.length <= maximum ? next : "";
}

export async function GET(request: NextRequest) {
  try {
    await requireAdministrator(request);

    const documentId = boundedQueryValue(
      request.nextUrl.searchParams.get("documentId"),
      80,
    );
    const version = boundedQueryValue(
      request.nextUrl.searchParams.get("version"),
      40,
    );

    if (!documentId || !version) {
      throw new PolicyPreviewError(
        "A registered document id and version are required.",
        400,
        "policy_preview_identity_required",
      );
    }

    const source = PREVIEW_PAYLOADS[`${documentId}:${version}`];
    if (!source) {
      throw new PolicyPreviewError(
        "That policy version is not available in the restricted preview registry.",
        404,
        "policy_preview_not_registered",
      );
    }

    const family = findPolicyDocumentFamily(documentId);
    if (!family) {
      throw new PolicyPreviewError(
        "The policy document family is not registered.",
        404,
        "policy_family_not_registered",
      );
    }

    if (
      family.migrationState !== "registry_candidate" &&
      family.migrationState !== "registry_managed"
    ) {
      throw new PolicyPreviewError(
        "This preview route is restricted to an explicitly registered policy-content family.",
        409,
        "policy_family_not_previewable",
      );
    }

    const versionRecord = family.registryManagedVersions.find(
      (candidate) => candidate.version === version,
    );
    if (!versionRecord) {
      throw new PolicyPreviewError(
        "The requested policy version is not registered on this document family.",
        404,
        "policy_version_not_registered",
      );
    }

    if (!PREVIEWABLE_STATUSES.has(versionRecord.status)) {
      throw new PolicyPreviewError(
        "Only non-effective policy candidates may be loaded through the restricted preview.",
        409,
        "policy_version_not_preview_candidate",
      );
    }

    if (versionRecord.payloadPath !== source.payloadPath) {
      throw new PolicyPreviewError(
        "The preview payload path does not match the registered version.",
        409,
        "policy_preview_payload_path_mismatch",
      );
    }

    const validation = validateStructuredPolicyPayload(source.payload);
    if (!validation.ok) {
      throw new PolicyPreviewError(
        "The registered structured payload failed validation.",
        409,
        "policy_preview_payload_invalid",
      );
    }

    const payload = validation.payload;
    if (
      payload.documentId !== family.documentId ||
      payload.version !== versionRecord.version ||
      payload.canonicalRoute !== family.canonicalRoute ||
      payload.sourceRevision !== versionRecord.sourceRevision
    ) {
      throw new PolicyPreviewError(
        "The structured payload identity does not match the registered candidate.",
        409,
        "policy_preview_identity_mismatch",
      );
    }

    const eligibility = evaluatePolicyVersionPublicationEligibility(
      family,
      versionRecord,
    );

    return jsonResponse({
      isAdmin: true,
      previewOnly: true,
      documentId: family.documentId,
      version: versionRecord.version,
      migrationState: family.migrationState,
      status: versionRecord.status,
      publicReady: versionRecord.publicReady,
      publicationEligible: eligibility.eligible,
      publicationEligibilityReasons: eligibility.reasons,
      sourceRevision: versionRecord.sourceRevision,
      payload,
      boundaries: {
        publicRouteSwitchover: false,
        registryRoutingEnabled: policyContentRegistry.registryRoutingEnabled,
        archiveRoutingEnabled: policyContentRegistry.archiveRoutingEnabled,
        editable: false,
        approvalActionAvailable: false,
        publishActionAvailable: false,
        memberNoticeAvailable: false,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
