import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getResolvedGeneralSubscriptionForUser,
  isGeneralSubscriptionActive,
} from "@/lib/general-subscriptions";
import { getBillingSupabaseAdmin } from "@/lib/billing-entitlements";

function authClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const supabaseAuth = authClient(token);
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const billingSupabase = getBillingSupabaseAdmin();
    const [resolved, profileResult] = await Promise.all([
      getResolvedGeneralSubscriptionForUser(user.id),
      billingSupabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      throw new Error(`Unable to read profile billing override: ${profileResult.error.message}`);
    }

    const isAdmin = Boolean(profileResult.data?.is_admin) || resolved.isAdminOverride;
    const providers = Array.from(
      new Set(
        resolved.subscriptions
          .filter(isGeneralSubscriptionActive)
          .map((subscription) => subscription.provider)
          .filter(
            (provider): provider is "stripe" | "apple" =>
              provider === "stripe" || provider === "apple"
          )
      )
    );

    return NextResponse.json({
      plan: resolved.plan,
      paidPlan: resolved.paidPlan,
      active: resolved.active,
      isAdmin,
      source: resolved.source,
      billingProvider:
        resolved.subscription?.provider === "stripe" ||
        resolved.subscription?.provider === "apple"
          ? resolved.subscription.provider
          : null,
      providers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown subscription status error.";
    console.error("Unable to resolve subscription status:", { message });
    return NextResponse.json(
      { error: "Unable to verify current subscription status." },
      { status: 500 }
    );
  }
}
