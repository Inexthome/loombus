import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type LoombusAgeBand = "unknown" | "under_13" | "teen" | "adult";

export type AgeSafetyRecord = {
  id: string;
  date_of_birth: string | null;
  age_band: LoombusAgeBand;
  age_state: string;
  teen_safety_mode: boolean;
  guardian_required: boolean;
  turns_18_at: string | null;
  age_declared_at: string | null;
  age_last_confirmed_at: string | null;
  age_transitioned_at: string | null;
};

export const TEEN_RESTRICTED_SEARCH_TYPES = new Set([
  "job",
  "jobs",
  "service",
  "services",
  "request",
  "requests",
  "marketplace",
  "appointment",
  "appointments",
]);

export function normalizeAgeBand(value: unknown): LoombusAgeBand {
  if (
    value === "under_13" ||
    value === "teen" ||
    value === "adult" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

export function isTeenAgeBand(value: unknown) {
  return normalizeAgeBand(value) === "teen";
}

export function isAdultAgeBand(value: unknown) {
  return normalizeAgeBand(value) === "adult";
}

export function isAgeEligible(value: unknown) {
  const ageBand = normalizeAgeBand(value);
  return ageBand === "teen" || ageBand === "adult";
}

export async function refreshDueAgeTransitions(service: SupabaseClient) {
  const { data, error } = await service.rpc("refresh_due_age_transitions");
  return {
    transitioned: typeof data === "number" ? data : Number(data ?? 0),
    error,
  };
}

export async function getAgeSafetyRecord(
  service: SupabaseClient,
  userId: string,
  options: { refreshTransition?: boolean } = {},
): Promise<AgeSafetyRecord | null> {
  if (options.refreshTransition !== false) {
    await refreshDueAgeTransitions(service).catch(() => null);
  }

  const { data, error } = await service
    .from("profile_sensitive")
    .select(
      "id, date_of_birth, age_band, age_state, teen_safety_mode, guardian_required, turns_18_at, age_declared_at, age_last_confirmed_at, age_transitioned_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    date_of_birth: data.date_of_birth ?? null,
    age_band: normalizeAgeBand(data.age_band),
    age_state: String(data.age_state ?? "unknown"),
    teen_safety_mode: Boolean(data.teen_safety_mode),
    guardian_required: Boolean(data.guardian_required),
    turns_18_at: data.turns_18_at ?? null,
    age_declared_at: data.age_declared_at ?? null,
    age_last_confirmed_at: data.age_last_confirmed_at ?? null,
    age_transitioned_at: data.age_transitioned_at ?? null,
  };
}

export async function declareMemberAge(
  service: SupabaseClient,
  userId: string,
  dateOfBirth: string,
) {
  const { data, error } = await service.rpc("declare_member_age", {
    p_user_id: userId,
    p_date_of_birth: dateOfBirth,
  });

  if (!error) return { data, error: null, code: null as string | null };

  const message = String(error.message ?? "");
  const code = message.includes("AGE_CORRECTION_REQUIRED")
    ? "age_correction_required"
    : message.includes("ACCOUNT_NOT_ELIGIBLE")
      ? "account_not_eligible"
      : message.includes("INVALID_DATE_OF_BIRTH")
        ? "invalid_date_of_birth"
        : "age_declaration_failed";

  return { data: null, error, code };
}

export async function canDiscoverTeenProfile(
  service: SupabaseClient,
  viewerUserId: string,
  targetUserId: string,
) {
  const { data, error } = await service.rpc("can_discover_teen_profile", {
    p_viewer_user_id: viewerUserId,
    p_target_user_id: targetUserId,
  });
  return !error && data === true;
}

export async function hasEstablishedRelationship(
  service: SupabaseClient,
  firstUserId: string,
  secondUserId: string,
) {
  const { data, error } = await service.rpc("is_established_member_relationship", {
    p_first_user_id: firstUserId,
    p_second_user_id: secondUserId,
  });
  return !error && data === true;
}

export async function getAgeBandMap(
  service: SupabaseClient,
  userIds: string[],
): Promise<Map<string, LoombusAgeBand>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const { data } = await service
    .from("profile_sensitive")
    .select("id, age_band")
    .in("id", ids);

  return new Map(
    (data ?? []).map((row) => [row.id, normalizeAgeBand(row.age_band)]),
  );
}

export function isTeenRestrictedSearchType(value: unknown) {
  return TEEN_RESTRICTED_SEARCH_TYPES.has(String(value ?? "").trim().toLowerCase());
}

export async function getRoomMinorSafetySettings(
  service: SupabaseClient,
  roomId: string,
) {
  const { data } = await service
    .from("room_minor_safety_settings")
    .select(
      "room_id, allows_minors, requires_staff_approval, adult_contact_mode, created_at, updated_at",
    )
    .eq("room_id", roomId)
    .maybeSingle();

  return {
    roomId,
    allowsMinors: Boolean(data?.allows_minors),
    requiresStaffApproval: data?.requires_staff_approval !== false,
    adultContactMode:
      data?.adult_contact_mode === "disabled" ? "disabled" : "teen_initiated",
    createdAt: data?.created_at ?? null,
    updatedAt: data?.updated_at ?? null,
  };
}
