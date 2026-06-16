import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSubscriptionDisplay,
  getSubscriptionDisplayKey,
  type AiEntitlementLike,
} from "@/lib/subscription-plans";

const MAX_PROFILE_BADGE_LOOKUP_IDS = 50;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BadgeResponse = {
  key: "premium" | "premium_plus";
  label: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      profileIds?: unknown;
    };

    if (body.profileIds !== undefined && !Array.isArray(body.profileIds)) {
      return NextResponse.json(
        { error: "profileIds must be an array." },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const profileIds = Array.isArray(body.profileIds)
      ? [
          ...new Set(
            body.profileIds
              .map((value) => String(value ?? "").trim())
              .filter((value) => UUID_PATTERN.test(value))
          ),
        ].slice(0, MAX_PROFILE_BADGE_LOOKUP_IDS)
      : [];

    if (profileIds.length === 0) {
      return NextResponse.json(
        { badges: {} },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return NextResponse.json(
        { error: "Profile badge service is not configured." },
        {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data, error } = await supabase
      .from("user_ai_entitlements")
      .select("user_id, tier, ai_assisted_enabled, monthly_summary_limit")
      .in("user_id", profileIds);

    if (error) {
      return NextResponse.json(
        { error: "Unable to load profile badges." },
        {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const badges: Record<string, BadgeResponse> = {};

    for (const entitlement of data ?? []) {
      const displayKey = getSubscriptionDisplayKey(entitlement as AiEntitlementLike);

      if (displayKey === "free" || displayKey === "admin") {
        continue;
      }

      const display = getSubscriptionDisplay(entitlement as AiEntitlementLike);

      badges[entitlement.user_id] = {
        key: displayKey,
        label: display.badge,
      };
    }

    return NextResponse.json(
      { badges },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
