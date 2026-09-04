import { NextRequest, NextResponse } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  createMemberPrivacyRequestClient,
  createMemberPrivacyServiceClient,
  isActiveAccountStatus,
} from "@/lib/member-privacy-server";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    code ? { error: message, code } : { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

async function getCurrentUser(supabase: NonNullable<ReturnType<typeof createMemberPrivacyRequestClient>>) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, error: jsonError("Unauthorized.", 401) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status, enforcement_reason, suspended_until")
    .eq("id", user.id)
    .maybeSingle();

  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );

  if (!enforcement.allowed) {
    return {
      user: null,
      error: jsonError(
        enforcement.errorMessage ?? "Account restricted.",
        403,
        enforcement.code
      ),
    };
  }

  return { user, error: null };
}

export async function GET(request: NextRequest) {
  const supabase = createMemberPrivacyRequestClient(request);
  if (!supabase) return jsonError("Unauthorized.", 401);

  const { user, error } = await getCurrentUser(supabase);

  if (error || !user) {
    return error ?? jsonError("Unauthorized.", 401);
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json(
      { people: [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const safeQuery = q.replaceAll("%", "").replaceAll("_", "").slice(0, 40);

  const { data, error: searchError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, bio, account_status")
    .neq("id", user.id)
    .or(
      [
        `username.ilike.%${safeQuery}%`,
        `full_name.ilike.%${safeQuery}%`,
      ].join(",")
    )
    .order("full_name", { ascending: true, nullsFirst: false })
    .limit(24);

  if (searchError) {
    return jsonError(searchError.message, 500);
  }

  const candidates = (data ?? []).filter((profile) =>
    isActiveAccountStatus(profile.account_status)
  );

  if (candidates.length === 0) {
    return NextResponse.json(
      { people: [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const service = createMemberPrivacyServiceClient();
  if (!service) {
    return jsonError("Member search privacy could not be verified.", 503, "member_privacy_unavailable");
  }

  const candidateIds = candidates.map((profile) => profile.id);
  const [{ data: privacyRows, error: privacyError }, { data: blockRows, error: blocksError }] =
    await Promise.all([
      service
        .from("member_privacy_settings")
        .select("user_id, discoverable")
        .in("user_id", candidateIds),
      service
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(
          `and(blocker_id.eq.${user.id},blocked_id.in.(${candidateIds.join(",")})),and(blocked_id.eq.${user.id},blocker_id.in.(${candidateIds.join(",")}))`
        ),
    ]);

  if (privacyError || blocksError) {
    console.error(
      "Message people-search privacy verification failed:",
      privacyError?.message ?? blocksError?.message
    );
    return jsonError("Member search privacy could not be verified.", 503, "member_privacy_unavailable");
  }

  const hiddenIds = new Set(
    (privacyRows ?? [])
      .filter((row) => row.discoverable === false)
      .map((row) => String(row.user_id))
  );
  const blockedIds = new Set<string>();

  for (const row of blockRows ?? []) {
    const blockerId = String(row.blocker_id ?? "");
    const blockedId = String(row.blocked_id ?? "");
    if (blockerId === user.id && blockedId) blockedIds.add(blockedId);
    if (blockedId === user.id && blockerId) blockedIds.add(blockerId);
  }

  const people = candidates
    .filter((profile) => !hiddenIds.has(profile.id) && !blockedIds.has(profile.id))
    .slice(0, 12)
    .map((profile) => ({
      id: profile.id,
      username: profile.username,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      bio: profile.bio,
    }));

  return NextResponse.json(
    { people },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
