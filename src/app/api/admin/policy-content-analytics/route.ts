import { NextRequest, NextResponse } from "next/server";
import { readPolicyContentDailyAnalytics } from "@/lib/policy-content-analytics";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase } from "@/lib/room-operations";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 93;

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Vary: "Authorization",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function utcDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string | null) {
  if (!value || !DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  try {
    const access = await verifyRequestAccountAccess(createRequestSupabase(request));
    if (!access.ok) {
      return jsonResponse(
        { error: access.error, code: access.code ?? "account_access_denied" },
        access.status,
      );
    }
    if (access.profile.is_admin !== true) {
      return jsonResponse(
        { error: "Administrator access is required.", code: "administrator_required" },
        403,
      );
    }

    const today = new Date();
    const requestedEnd = parseDate(request.nextUrl.searchParams.get("end"));
    const end = requestedEnd ?? new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    ));
    const defaultStart = new Date(end);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - (DEFAULT_WINDOW_DAYS - 1));
    const start = parseDate(request.nextUrl.searchParams.get("start")) ?? defaultStart;

    const spanDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (spanDays < 1 || spanDays > MAX_WINDOW_DAYS) {
      return jsonResponse(
        {
          error: `Analytics date range must be between 1 and ${MAX_WINDOW_DAYS} days.`,
          code: "policy_analytics_date_range_invalid",
        },
        400,
      );
    }

    const startDate = utcDateString(start);
    const endDate = utcDateString(end);
    const rows = await readPolicyContentDailyAnalytics({ startDate, endDate });

    return jsonResponse({
      aggregateOnly: true,
      startDate,
      endDate,
      rows,
      excludedDimensions: [
        "user_id",
        "ip_address",
        "session_id",
        "device",
        "location",
        "referrer",
        "search_text",
        "dwell_time",
        "scroll_depth",
      ],
    });
  } catch (error) {
    console.error("Policy analytics aggregate read failed:", error);
    return jsonResponse(
      { error: "Policy analytics could not be loaded.", code: "policy_analytics_read_failed" },
      500,
    );
  }
}
