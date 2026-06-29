import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type FeatureFlagKey = "v2_shell" | "v2_signal_brief" | "v2_rooms";
type AppearanceTheme = "system" | "dark" | "light";

type FeatureFlag = {
  key: string;
  enabled: boolean | null;
  rollout_percentage: number | null;
  allowed_user_ids: string[] | null;
  metadata: Record<string, unknown> | null;
};

type ShellPreference = {
  layout_version: "v1" | "v2" | null;
  appearance_theme: AppearanceTheme | null;
  home_sections: string[] | null;
  compact_mode: boolean | null;
  last_seen_v2_prompt_at: string | null;
};

const DEFAULT_FLAGS: FeatureFlagKey[] = ["v2_shell", "v2_signal_brief", "v2_rooms"];

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "").trim() || null;
}

function getDefaultFlagResponse(): Record<FeatureFlagKey, boolean> {
  return {
    v2_shell: false,
    v2_signal_brief: false,
    v2_rooms: false,
  };
}

function getDeterministicBucket(userId: string) {
  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) % 100;
  }

  return hash;
}

function isFlagEnabledForUser(flag: FeatureFlag | undefined, userId: string | null) {
  if (!flag?.enabled) {
    return false;
  }

  if (userId && (flag.allowed_user_ids ?? []).includes(userId)) {
    return true;
  }

  const rolloutPercentage = flag.rollout_percentage ?? 0;

  if (rolloutPercentage >= 100) {
    return true;
  }

  if (!userId || rolloutPercentage <= 0) {
    return false;
  }

  return getDeterministicBucket(userId) < rolloutPercentage;
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      token
        ? {
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          }
        : undefined
    );

    const {
      data: { user },
    } = token
      ? await userSupabase.auth.getUser(token)
      : { data: { user: null } };

    if (!serviceKey) {
      console.error("V2 shell flag lookup failed: missing service role key.");

      return NextResponse.json({
        version: "v1",
        configured: false,
        authenticated: Boolean(user),
        flags: getDefaultFlagResponse(),
        preferences: null,
      });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: flags, error: flagError } = await adminSupabase
      .from("loombus_feature_flags")
      .select("key, enabled, rollout_percentage, allowed_user_ids, metadata")
      .in("key", DEFAULT_FLAGS);

    if (flagError) {
      console.error("V2 shell flag lookup failed:", flagError.message);

      return NextResponse.json({
        version: "v1",
        configured: false,
        authenticated: Boolean(user),
        flags: getDefaultFlagResponse(),
        preferences: null,
      });
    }

    const flagMap = new Map((flags ?? []).map((flag) => [flag.key, flag as FeatureFlag]));
    const resolvedFlags: Record<FeatureFlagKey, boolean> = {
      v2_shell: isFlagEnabledForUser(flagMap.get("v2_shell"), user?.id ?? null),
      v2_signal_brief: isFlagEnabledForUser(flagMap.get("v2_signal_brief"), user?.id ?? null),
      v2_rooms: isFlagEnabledForUser(flagMap.get("v2_rooms"), user?.id ?? null),
    };

    let preferences: ShellPreference | null = null;

    if (user) {
      const { data: preferenceRow, error: preferenceError } = await userSupabase
        .from("loombus_shell_preferences")
        .select("layout_version, appearance_theme, home_sections, compact_mode, last_seen_v2_prompt_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (preferenceError) {
        console.error("V2 shell preference lookup failed:", preferenceError.message);
      } else {
        preferences = (preferenceRow ?? null) as ShellPreference | null;
      }
    }

    return NextResponse.json({
      version: resolvedFlags.v2_shell ? "v2" : "v1",
      configured: true,
      authenticated: Boolean(user),
      flags: resolvedFlags,
      preferences,
      appearanceOptions: [
        { key: "system", label: "System", description: "Follows the device setting." },
        { key: "dark", label: "Dark", description: "Loombus dark identity theme." },
        { key: "light", label: "Light", description: "Clean light theme." },
      ],
    });
  } catch (error) {
    console.error("Unexpected V2 shell API failure:", error);

    return NextResponse.json(
      {
        version: "v1",
        configured: false,
        authenticated: false,
        flags: getDefaultFlagResponse(),
        preferences: null,
      },
      { status: 200 }
    );
  }
}
