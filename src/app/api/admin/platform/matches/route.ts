import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

type Row = Record<string, unknown>;

class MatchesAdminError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "matches_admin_error"
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
  if (error instanceof MatchesAdminError) {
    return response(
      { error: error.message, code: error.code },
      error.status
    );
  }

  console.error(
    "Intelligent Matching administrator request failed:",
    error
  );

  return response(
    {
      error:
        "Intelligent Matching administration could not complete this request.",
      code: "matches_admin_failed",
    },
    500
  );
}

function text(value: unknown, maximum = 2000) {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

function iso(value: unknown) {
  const raw = text(value, 100);
  if (!raw) return null;

  const date = new Date(raw);

  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function displayName(profile: Row | undefined) {
  return (
    text(profile?.full_name, 200) ||
    (text(profile?.username, 100)
      ? `@${text(profile?.username, 100)}`
      : "Loombus member")
  );
}

function objectValue(value: unknown) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(String).filter(Boolean)
    : [];
}

async function requireAdministrator(request: NextRequest) {
  const access = await verifyRequestAccountAccess(
    createRequestSupabase(request)
  );

  if (!access.ok) {
    throw new MatchesAdminError(
      access.error,
      access.status,
      access.code ?? "account_access_denied"
    );
  }

  if (access.profile.is_admin !== true) {
    throw new MatchesAdminError(
      "Administrator access is required.",
      403,
      "administrator_required"
    );
  }

  return { service: createRoomServiceSupabase() };
}

export async function GET(request: NextRequest) {
  try {
    const { service } = await requireAdministrator(request);

    const [
      candidatesResult,
      feedbackResult,
      preferencesResult,
      rulesResult,
      deliveriesResult,
    ] = await Promise.all([
      service
        .from("match_candidates")
        .select(
          [
            "id",
            "viewer_id",
            "source_type",
            "source_id",
            "target_type",
            "target_id",
            "direction",
            "eligibility_status",
            "internal_confidence",
            "factors",
            "explanation",
            "created_at",
            "refreshed_at",
            "expires_at",
            "viewed_at",
            "dismissed_at",
            "saved_at",
            "acted_on_at",
          ].join(",")
        )
        .order("refreshed_at", { ascending: false })
        .limit(1000),
      service
        .from("match_feedback")
        .select(
          [
            "id",
            "candidate_id",
            "user_id",
            "feedback_type",
            "note",
            "created_at",
          ].join(",")
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      service
        .from("matching_preferences")
        .select(
          [
            "user_id",
            "active_sections",
            "categories",
            "radius_miles",
            "include_remote",
            "minimum_relevance",
            "notification_frequency",
            "matching_paused",
            "created_at",
            "updated_at",
          ].join(",")
        )
        .limit(1000),
      service
        .from("matching_rules")
        .select(
          [
            "id",
            "user_id",
            "source_type",
            "target_type",
            "categories",
            "radius_miles",
            "include_remote",
            "minimum_relevance",
            "is_active",
            "created_at",
            "updated_at",
          ].join(",")
        )
        .limit(1000),
      service
        .from("match_deliveries")
        .select(
          [
            "id",
            "candidate_id",
            "user_id",
            "channel",
            "status",
            "scheduled_at",
            "delivered_at",
            "error_message",
            "created_at",
          ].join(",")
        )
        .order("scheduled_at", { ascending: false })
        .limit(1000),
    ]);

    const failedResult = [
      candidatesResult,
      feedbackResult,
      preferencesResult,
      rulesResult,
      deliveriesResult,
    ].find((result) => result.error);

    if (failedResult?.error) {
      throw new MatchesAdminError(
        failedResult.error.message ||
          "Unable to load Intelligent Matching diagnostics.",
        503,
        "matching_diagnostics_unavailable"
      );
    }

    const candidateRows =
      (candidatesResult.data ?? []) as unknown as Row[];
    const feedbackRows =
      (feedbackResult.data ?? []) as unknown as Row[];
    const preferenceRows =
      (preferencesResult.data ?? []) as unknown as Row[];
    const ruleRows =
      (rulesResult.data ?? []) as unknown as Row[];
    const deliveryRows =
      (deliveriesResult.data ?? []) as unknown as Row[];

    const viewerIds = [
      ...new Set(
        [
          ...candidateRows.map((row) =>
            text(row.viewer_id, 60)
          ),
          ...feedbackRows.map((row) =>
            text(row.user_id, 60)
          ),
        ].filter(Boolean)
      ),
    ];

    const requestIds = [
      ...new Set(
        candidateRows
          .flatMap((row) => [
            text(row.source_type, 20) === "request"
              ? text(row.source_id, 60)
              : "",
            text(row.target_type, 20) === "request"
              ? text(row.target_id, 60)
              : "",
          ])
          .filter(Boolean)
      ),
    ];

    const serviceIds = [
      ...new Set(
        candidateRows
          .flatMap((row) => [
            text(row.source_type, 20) === "service"
              ? text(row.source_id, 60)
              : "",
            text(row.target_type, 20) === "service"
              ? text(row.target_id, 60)
              : "",
          ])
          .filter(Boolean)
      ),
    ];

    const [
      profilesResult,
      requestsResult,
      servicesResult,
    ] = await Promise.all([
      viewerIds.length
        ? service
            .from("profiles")
            .select(
              "id, full_name, username, account_status, suspended_until"
            )
            .in("id", viewerIds)
        : Promise.resolve({
            data: [] as Row[],
            error: null,
          }),
      requestIds.length
        ? service
            .from("service_requests")
            .select("id, title, slug, status")
            .in("id", requestIds)
        : Promise.resolve({
            data: [] as Row[],
            error: null,
          }),
      serviceIds.length
        ? service
            .from("provider_services")
            .select("id, title, slug, status")
            .in("id", serviceIds)
        : Promise.resolve({
            data: [] as Row[],
            error: null,
          }),
    ]);

    if (
      profilesResult.error ||
      requestsResult.error ||
      servicesResult.error
    ) {
      throw new MatchesAdminError(
        "Unable to hydrate Intelligent Matching attribution.",
        503,
        "matching_attribution_unavailable"
      );
    }

    const profiles = new Map<string, Row>(
      ((profilesResult.data ?? []) as unknown as Row[]).map(
        (row) => [text(row.id, 60), row]
      )
    );
    const requests = new Map<string, Row>(
      ((requestsResult.data ?? []) as unknown as Row[]).map(
        (row) => [text(row.id, 60), row]
      )
    );
    const services = new Map<string, Row>(
      ((servicesResult.data ?? []) as unknown as Row[]).map(
        (row) => [text(row.id, 60), row]
      )
    );

    const entity = (
      entityType: string,
      entityId: string
    ) => {
      const row =
        entityType === "request"
          ? requests.get(entityId)
          : services.get(entityId);

      return {
        type: entityType,
        id: entityId,
        title:
          text(row?.title, 300) ||
          `${entityType === "request" ? "Request" : "Service"} ${entityId.slice(0, 8)}`,
        href:
          entityType === "request"
            ? text(row?.slug, 160)
              ? `/requests/${text(row?.slug, 160)}`
              : "/requests"
            : text(row?.slug, 160)
              ? `/services/${text(row?.slug, 160)}`
              : "/services",
        status: text(row?.status, 40) || "unknown",
      };
    };

    const now = Date.now();
    const staleThreshold = now - 7 * 86_400_000;

    const candidates = candidateRows.map((row) => {
      const id = text(row.id, 60);
      const viewerId = text(row.viewer_id, 60);
      const sourceType = text(row.source_type, 20);
      const sourceId = text(row.source_id, 60);
      const targetType = text(row.target_type, 20);
      const targetId = text(row.target_id, 60);
      const refreshedAt = iso(row.refreshed_at);
      const expiresAt = iso(row.expires_at);
      const profile = profiles.get(viewerId);
      const eligibilityStatus =
        text(row.eligibility_status, 30) || "unknown";
      const expiredByTime = Boolean(
        expiresAt &&
          new Date(expiresAt).getTime() <= now
      );
      const stale =
        eligibilityStatus === "eligible" &&
        (!refreshedAt ||
          new Date(refreshedAt).getTime() <
            staleThreshold ||
          expiredByTime);

      return {
        id,
        viewerId,
        viewerLabel: displayName(profile),
        viewerAccountStatus:
          text(profile?.account_status, 40) || "active",
        viewerSuspendedUntil:
          iso(profile?.suspended_until),
        direction:
          text(row.direction, 40) || "unknown",
        eligibilityStatus,
        confidence: Math.min(
          100,
          Math.max(
            0,
            Math.round(
              numberValue(row.internal_confidence)
            )
          )
        ),
        factors: objectValue(row.factors),
        explanation: stringArray(row.explanation),
        source: entity(sourceType, sourceId),
        target: entity(targetType, targetId),
        createdAt: iso(row.created_at),
        refreshedAt,
        expiresAt,
        viewed: Boolean(row.viewed_at),
        dismissed: Boolean(row.dismissed_at),
        saved: Boolean(row.saved_at),
        actedOn: Boolean(row.acted_on_at),
        stale,
      };
    });

    const candidateMap = new Map(
      candidates.map((candidate) => [
        candidate.id,
        candidate,
      ])
    );

    const feedbackCounts = {
      helpful: 0,
      notRelevant: 0,
      incorrect: 0,
      unsafe: 0,
    };

    for (const row of feedbackRows) {
      const feedbackType = text(
        row.feedback_type,
        30
      );

      if (feedbackType === "helpful") {
        feedbackCounts.helpful += 1;
      } else if (feedbackType === "not_relevant") {
        feedbackCounts.notRelevant += 1;
      } else if (feedbackType === "incorrect") {
        feedbackCounts.incorrect += 1;
      } else if (feedbackType === "unsafe") {
        feedbackCounts.unsafe += 1;
      }
    }

    const deliveryCounts = {
      queued: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    };

    for (const row of deliveryRows) {
      const status = text(row.status, 30);

      if (status in deliveryCounts) {
        deliveryCounts[
          status as keyof typeof deliveryCounts
        ] += 1;
      }
    }

    const eligible = candidates.filter(
      (candidate) =>
        candidate.eligibilityStatus === "eligible"
    );
    const confidenceTotal = candidates.reduce(
      (total, candidate) =>
        total + candidate.confidence,
      0
    );
    const feedbackAttention =
      feedbackCounts.unsafe +
      feedbackCounts.incorrect;
    const staleEligible = eligible.filter(
      (candidate) => candidate.stale
    ).length;
    const attentionTotal =
      feedbackAttention +
      staleEligible +
      deliveryCounts.failed;

    const feedbackSignals = feedbackRows
      .filter((row) =>
        new Set([
          "unsafe",
          "incorrect",
          "not_relevant",
        ]).has(text(row.feedback_type, 30))
      )
      .map((row) => {
        const candidateId = text(
          row.candidate_id,
          60
        );
        const candidate =
          candidateMap.get(candidateId);
        const userId = text(row.user_id, 60);

        return {
          id: text(row.id, 60),
          candidateId,
          feedbackType:
            text(row.feedback_type, 30) ||
            "unknown",
          note: text(row.note, 1000) || null,
          createdAt: iso(row.created_at),
          viewerLabel:
            candidate?.viewerLabel ??
            displayName(profiles.get(userId)),
          confidence:
            candidate?.confidence ?? null,
          direction:
            candidate?.direction ?? null,
          source:
            candidate?.source ?? null,
          target:
            candidate?.target ?? null,
        };
      })
      .slice(0, 250);

    return response({
      isAdmin: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        totalCandidates: candidates.length,
        eligible: eligible.length,
        expired: candidates.filter(
          (candidate) =>
            candidate.eligibilityStatus === "expired"
        ).length,
        ineligible: candidates.filter(
          (candidate) =>
            candidate.eligibilityStatus === "ineligible"
        ).length,
        averageConfidence: candidates.length
          ? Math.round(
              confidenceTotal / candidates.length
            )
          : 0,
        highConfidence: candidates.filter(
          (candidate) => candidate.confidence >= 80
        ).length,
        mediumConfidence: candidates.filter(
          (candidate) =>
            candidate.confidence >= 60 &&
            candidate.confidence < 80
        ).length,
        lowConfidence: candidates.filter(
          (candidate) => candidate.confidence < 60
        ).length,
        unviewedEligible: eligible.filter(
          (candidate) => !candidate.viewed
        ).length,
        saved: candidates.filter(
          (candidate) => candidate.saved
        ).length,
        dismissed: candidates.filter(
          (candidate) => candidate.dismissed
        ).length,
        actedOn: candidates.filter(
          (candidate) => candidate.actedOn
        ).length,
        staleEligible,
        feedbackAttention,
        failedDeliveries: deliveryCounts.failed,
        pausedAccounts: preferenceRows.filter(
          (row) => row.matching_paused === true
        ).length,
        activeRules: ruleRows.filter(
          (row) => row.is_active !== false
        ).length,
        attentionTotal,
      },
      feedbackCounts,
      deliveryCounts,
      candidates: candidates.slice(0, 250),
      feedbackSignals,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
