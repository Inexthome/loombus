import { NextRequest, NextResponse } from "next/server";
import {
  incrementPolicyContentDailyView,
  type PolicyAnalyticsSurface,
} from "@/lib/policy-content-analytics";
import { resolvePolicyPublicHistory } from "@/lib/policy-content-history";
import {
  resolvePolicyArchiveVersion,
  resolvePolicyCurrentVersion,
} from "@/lib/policy-content-resolver";

const SURFACES = new Set<PolicyAnalyticsSurface>([
  "current",
  "history",
  "archive",
]);
const VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;

function noStoreResponse(status = 204) {
  return new NextResponse(null, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const next = value.trim();
  return next.length > 0 && next.length <= maximum ? next : "";
}

function isPublicAnalyticsIdentity(input: {
  surface: PolicyAnalyticsSurface;
  documentId: string;
  version: string;
}) {
  if (input.surface === "current") {
    const resolution = resolvePolicyCurrentVersion(input.documentId);
    return (
      resolution.resolved &&
      resolution.version?.version === input.version &&
      resolution.family?.documentId === input.documentId
    );
  }

  if (input.surface === "history") {
    const history = resolvePolicyPublicHistory(input.documentId);
    return (
      history.visible &&
      history.family?.documentId === input.documentId &&
      history.entries[0]?.version === input.version
    );
  }

  const resolution = resolvePolicyArchiveVersion(input.documentId, input.version);
  return (
    resolution.resolved &&
    resolution.version?.version === input.version &&
    resolution.family?.documentId === input.documentId
  );
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as unknown;
    if (!isRecord(payload)) return noStoreResponse(400);

    const surface = boundedString(payload.surface, 16) as PolicyAnalyticsSurface;
    const documentId = boundedString(payload.documentId, 80);
    const version = boundedString(payload.version, 40);

    if (
      !SURFACES.has(surface) ||
      !documentId ||
      !VERSION_PATTERN.test(version) ||
      !isPublicAnalyticsIdentity({ surface, documentId, version })
    ) {
      return noStoreResponse(400);
    }

    await incrementPolicyContentDailyView({ surface, documentId, version });
    return noStoreResponse(204);
  } catch (error) {
    console.error("Policy analytics aggregate increment failed:", error);
    return noStoreResponse(503);
  }
}
