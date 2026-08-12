import { NextRequest } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  createCalendarFeedServiceClient,
  hashCalendarFeedToken,
} from "@/lib/calendar-feed-credentials";
import {
  loadCalendarFeedItems,
  serializeCalendarFeed,
} from "@/lib/calendar-feed-export";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import { evaluateSubscriptionEntitlement } from "@/lib/subscription-entitlements";

type RouteContext = {
  params: Promise<{ token: string }>;
};

type FeedProfileRow = {
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function hiddenNotFound() {
  return new Response("Not found.\n", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function unavailable() {
  return new Response("Calendar feed is temporarily unavailable.\n", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    if (!TOKEN_PATTERN.test(token)) return hiddenNotFound();

    const service = createCalendarFeedServiceClient();
    const tokenHash = hashCalendarFeedToken(token);
    const { data: credential, error: credentialError } = await service
      .from("calendar_feed_credentials")
      .select("user_id, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (credentialError) {
      console.error("Unable to resolve calendar-feed credential:", credentialError);
      return unavailable();
    }
    if (!credential || credential.revoked_at) return hiddenNotFound();

    const userId = String(credential.user_id);
    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("is_admin, account_status, enforcement_reason, suspended_until")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Unable to verify calendar-feed account access:", profileError);
      return unavailable();
    }

    const profileRow = (profile ?? null) as FeedProfileRow | null;
    const enforcement = getAccountEnforcementResult(profileRow);
    if (!enforcement.allowed) return hiddenNotFound();

    let plan: "free" | "premium" | "pro" = "free";
    if (profileRow?.is_admin) {
      plan = "pro";
    } else {
      const subscription = await getResolvedGeneralSubscriptionForUser(userId);
      plan = subscription.plan;
    }

    if (
      !evaluateSubscriptionEntitlement(plan, "external_calendar_sync").allowed
    ) {
      return hiddenNotFound();
    }

    const items = await loadCalendarFeedItems(service, userId);
    const calendar = serializeCalendarFeed(items);

    return new Response(calendar, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="loombus-calendar.ics"',
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Calendar feed request failed:", error);
    return unavailable();
  }
}
