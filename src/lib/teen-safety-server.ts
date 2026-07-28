import "server-only";

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EverythingSearchResult,
  EverythingSearchType,
} from "@/lib/everything-search";
import type {
  LocalDiscoveryEntityType,
  LocalDiscoveryResponse,
} from "@/lib/local-discovery";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

export type LoombusAgeBand = "unknown" | "under_13" | "teen" | "adult";

export type MemberAgeSafety = {
  userId: string;
  ageBand: LoombusAgeBand;
  teenSafetyMode: boolean;
  guardianRequired: boolean;
  personalizedRecommendationsEnabled: boolean;
  commerceDiscoveryEnabled: boolean;
  lookupAvailable: boolean;
};

export type RequestAgeSafety =
  | MemberAgeSafety
  | {
      userId: null;
      ageBand: "unknown";
      teenSafetyMode: false;
      guardianRequired: false;
      personalizedRecommendationsEnabled: false;
      commerceDiscoveryEnabled: false;
      lookupAvailable: boolean;
    };

export type RoomMinorSafetySettings = {
  roomId: string;
  allowsMinors: boolean;
  minorAdmissionMode: "blocked" | "approval_required";
  teenStaffAllowed: false;
  updatedAt: string | null;
};

const TEEN_COMMERCE_RESULT_TYPES = new Set<EverythingSearchType>([
  "service",
  "request",
  "company",
  "product",
  "job",
  "marketplace",
]);

const TEEN_COMMERCE_LOCAL_TYPES = new Set<LocalDiscoveryEntityType>([
  "business",
  "service",
  "job",
  "marketplace",
  "request",
]);

const ROOM_SCOPED_TYPES = new Set<EverythingSearchType>([
  "room",
  "room_discussion",
  "announcement",
  "knowledge",
  "task",
  "poll",
  "form",
  "resource",
  "file",
  "document",
]);

function normalizeAgeBand(value: unknown): LoombusAgeBand {
  const ageBand = String(value ?? "unknown").toLowerCase();
  return ["under_13", "teen", "adult"].includes(ageBand)
    ? (ageBand as LoombusAgeBand)
    : "unknown";
}

function privateJson(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function getMemberAgeSafety(
  service: SupabaseClient,
  userId: string
): Promise<MemberAgeSafety> {
  const [sensitiveResult, settingsResult] = await Promise.all([
    service
      .from("profile_sensitive")
      .select("age_band, teen_safety_mode, guardian_required")
      .eq("id", userId)
      .maybeSingle(),
    service
      .from("teen_safety_settings")
      .select(
        "personalized_recommendations_enabled, commerce_discovery_enabled"
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (sensitiveResult.error || settingsResult.error) {
    return {
      userId,
      ageBand: "unknown",
      teenSafetyMode: false,
      guardianRequired: false,
      personalizedRecommendationsEnabled: false,
      commerceDiscoveryEnabled: false,
      lookupAvailable: false,
    };
  }

  const ageBand = normalizeAgeBand(sensitiveResult.data?.age_band);
  return {
    userId,
    ageBand,
    teenSafetyMode:
      sensitiveResult.data?.teen_safety_mode === true || ageBand === "teen",
    guardianRequired:
      sensitiveResult.data?.guardian_required === true || ageBand === "under_13",
    personalizedRecommendationsEnabled:
      settingsResult.data?.personalized_recommendations_enabled === true,
    commerceDiscoveryEnabled:
      settingsResult.data?.commerce_discovery_enabled === true,
    lookupAvailable: true,
  };
}

export async function resolveRequestAgeSafety(
  request: NextRequest
): Promise<RequestAgeSafety> {
  let requestClient;
  let serviceClient;
  try {
    requestClient = createRequestSupabase(request);
    serviceClient = createRoomServiceSupabase();
  } catch {
    return {
      userId: null,
      ageBand: "unknown",
      teenSafetyMode: false,
      guardianRequired: false,
      personalizedRecommendationsEnabled: false,
      commerceDiscoveryEnabled: false,
      lookupAvailable: false,
    };
  }

  const {
    data: { user },
  } = await requestClient.auth.getUser();
  if (!user) {
    return {
      userId: null,
      ageBand: "unknown",
      teenSafetyMode: false,
      guardianRequired: false,
      personalizedRecommendationsEnabled: false,
      commerceDiscoveryEnabled: false,
      lookupAvailable: true,
    };
  }

  return getMemberAgeSafety(serviceClient, user.id);
}

export async function enforceAdultOnlyAction(
  request: NextRequest,
  actionLabel: string
): Promise<NextResponse | null> {
  const ageSafety = await resolveRequestAgeSafety(request);
  if (!ageSafety.userId) return null;

  if (!ageSafety.lookupAvailable) {
    return privateJson(
      {
        error: "Loombus could not verify age-safety eligibility. Try again later.",
        code: "age_safety_unavailable",
      },
      503
    );
  }
  if (ageSafety.ageBand === "under_13" || ageSafety.guardianRequired) {
    return privateJson(
      {
        error: "This account is not eligible to use Loombus.",
        code: "under_13_not_allowed",
      },
      403
    );
  }
  if (ageSafety.ageBand === "unknown") {
    return privateJson(
      {
        error: "Complete age safety before using this feature.",
        code: "age_gate_required",
      },
      403
    );
  }
  if (ageSafety.ageBand === "teen") {
    return privateJson(
      {
        error: `${actionLabel} is currently limited to adult accounts while Loombus verifies teen-safe commercial and organizational controls.`,
        code: "teen_action_restricted",
        ageSafetyPath: "/account/age-safety",
      },
      403
    );
  }

  return null;
}

function roomIdForResult(result: EverythingSearchResult) {
  if (result.roomId) return result.roomId;
  if (!ROOM_SCOPED_TYPES.has(result.type)) return null;
  const match = result.href.match(
    /\/rooms\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i
  );
  return match?.[1] ?? null;
}

export async function getRoomMinorSafetySettings(
  service: SupabaseClient,
  roomId: string
): Promise<RoomMinorSafetySettings> {
  const { data, error } = await service
    .from("room_minor_safety_settings")
    .select("room_id, allows_minors, minor_admission_mode, updated_at")
    .eq("room_id", roomId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return {
    roomId,
    allowsMinors: data?.allows_minors === true,
    minorAdmissionMode:
      data?.minor_admission_mode === "approval_required"
        ? "approval_required"
        : "blocked",
    teenStaffAllowed: false,
    updatedAt: data?.updated_at ?? null,
  };
}

export async function filterEverythingResultsForTeen(
  request: NextRequest,
  results: EverythingSearchResult[]
): Promise<{
  results: EverythingSearchResult[];
  limited: boolean;
  ageSafety: RequestAgeSafety;
}> {
  const ageSafety = await resolveRequestAgeSafety(request);
  if (!ageSafety.userId || ageSafety.ageBand === "adult") {
    return { results, limited: false, ageSafety };
  }

  if (ageSafety.ageBand === "under_13" || ageSafety.guardianRequired) {
    return { results: [], limited: results.length > 0, ageSafety };
  }

  const commerceAllowed =
    ageSafety.lookupAvailable &&
    ageSafety.ageBand === "teen" &&
    ageSafety.commerceDiscoveryEnabled;
  let filtered = commerceAllowed
    ? results
    : results.filter(
        (result) => !TEEN_COMMERCE_RESULT_TYPES.has(result.type)
      );

  const roomIds = [
    ...new Set(
      filtered
        .map(roomIdForResult)
        .filter((value): value is string => Boolean(value))
    ),
  ];

  if (roomIds.length > 0) {
    let service;
    try {
      service = createRoomServiceSupabase();
    } catch {
      filtered = filtered.filter((result) => !roomIdForResult(result));
      return {
        results: filtered,
        limited: filtered.length !== results.length,
        ageSafety,
      };
    }

    const { data, error } = await service
      .from("room_minor_safety_settings")
      .select("room_id, allows_minors")
      .in("room_id", roomIds);

    if (error) {
      filtered = filtered.filter((result) => !roomIdForResult(result));
    } else {
      const eligibleRoomIds = new Set(
        (data ?? [])
          .filter((row) => row.allows_minors === true)
          .map((row) => String(row.room_id))
      );
      filtered = filtered.filter((result) => {
        const roomId = roomIdForResult(result);
        return !roomId || eligibleRoomIds.has(roomId);
      });
    }
  }

  return {
    results: filtered,
    limited: filtered.length !== results.length,
    ageSafety,
  };
}

export async function filterLocalDiscoveryForTeen(
  request: NextRequest,
  response: LocalDiscoveryResponse
): Promise<LocalDiscoveryResponse & { teenSafetyLimited?: boolean }> {
  const ageSafety = await resolveRequestAgeSafety(request);
  if (!ageSafety.userId || ageSafety.ageBand === "adult") return response;

  if (ageSafety.ageBand === "under_13" || ageSafety.guardianRequired) {
    return {
      ...response,
      results: [],
      total: 0,
      counts: {},
      anchoredTotal: 0,
      teenSafetyLimited: response.results.length > 0,
    };
  }

  if (
    ageSafety.lookupAvailable &&
    ageSafety.ageBand === "teen" &&
    ageSafety.commerceDiscoveryEnabled
  ) {
    return response;
  }

  const results = response.results.filter(
    (result) => !TEEN_COMMERCE_LOCAL_TYPES.has(result.entityType)
  );
  const counts = results.reduce<LocalDiscoveryResponse["counts"]>(
    (next, result) => {
      next[result.entityType] = (next[result.entityType] ?? 0) + 1;
      return next;
    },
    {}
  );

  return {
    ...response,
    results,
    total: results.length,
    counts,
    anchoredTotal: results.filter(
      (result) => result.distanceMiles !== null
    ).length,
    teenSafetyLimited: results.length !== response.results.length,
  };
}
