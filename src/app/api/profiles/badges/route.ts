import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSubscriptionDisplay,
  getSubscriptionDisplayKey,
  type AiEntitlementLike,
} from "@/lib/subscription-plans";

type BadgeResponse = {
  key: "premium" | "premium_plus" | "admin";
  label: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      profileIds?: unknown;
    };

    const profileIds = Array.isArray(body.profileIds)
      ? [
          ...new Set(
            body.profileIds
              .map((value) => String(value ?? "").trim())
              .filter(Boolean)
          ),
        ].slice(0, 100)
      : [];

    if (profileIds.length === 0) {
      return NextResponse.json({ badges: {} });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return NextResponse.json(
        { error: "Profile badge service is not configured." },
        { status: 503 }
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
        { status: 500 }
      );
    }

    const badges: Record<string, BadgeResponse> = {};

    for (const entitlement of data ?? []) {
      const displayKey = getSubscriptionDisplayKey(entitlement as AiEntitlementLike);

      if (displayKey === "free") {
        continue;
      }

      const display = getSubscriptionDisplay(entitlement as AiEntitlementLike);

      badges[entitlement.user_id] = {
        key: displayKey,
        label: display.badge,
      };
    }

    return NextResponse.json({ badges });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
