import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  EverythingSearchError,
  runEverythingSearch,
} from "@/lib/everything-search-server";
import type { EverythingSearchResult } from "@/lib/everything-search";
import { getOpenAiUsageMetadata, logAiUsage } from "@/lib/premium-ai";

const SEARCH_AI_MODEL =
  process.env.OPENAI_SEARCH_AI_MODEL ||
  process.env.OPENAI_SUMMARY_MODEL ||
  "gpt-4o-mini";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FEATURE_KEY = "global_search_ai";
const MAX_QUERY_CHARS = 280;
const MAX_CONTEXT_CHARS = 7000;

type ProfileAccess = {
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

function jsonError(
  message: string,
  status: number,
  extras: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { error: message, ...extras },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

function getSupabaseForRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: authorization ? { Authorization: authorization } : {},
      },
    }
  );
}

function clampText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function compactContextItem(result: EverythingSearchResult, index: number) {
  const details = [
    result.snippet,
    result.ownerName ? `Contributor: ${result.ownerName}` : "",
    result.roomName ? `Room: ${result.roomName}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    `Source [${index + 1}]`,
    `Type: ${result.sourceLabel}`,
    `Title: ${result.title}`,
    details ? `Context: ${details.slice(0, 500)}` : "",
    `Path: ${result.href}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function compactContext(results: EverythingSearchResult[]) {
  return results
    .filter(
      (result) =>
        result.visibility !== "member" && result.visibility !== "private"
    )
    .slice(0, 12)
    .map(compactContextItem)
    .join("\n\n")
    .slice(0, MAX_CONTEXT_CHARS);
}

async function getCurrentUserAndAccess(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      isAdmin: false,
      error: jsonError("Unauthorized.", 401),
    };
  }

  const [{ data: profile }, { data: entitlement }] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_admin, account_status, enforcement_reason, suspended_until")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_ai_entitlements")
      .select("tier, ai_assisted_enabled, monthly_summary_limit")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );

  if (!enforcement.allowed) {
    return {
      user: null,
      isAdmin: false,
      error: jsonError(
        enforcement.errorMessage ?? "Account restricted.",
        403,
        { code: enforcement.code }
      ),
    };
  }

  const isAdmin = Boolean(profile?.is_admin) || entitlement?.tier === "admin";
  const tier = String(entitlement?.tier ?? "free");
  const hasPremiumAiAccess =
    isAdmin ||
    (entitlement?.ai_assisted_enabled === true &&
      (tier === "premium" || tier === "premium_plus" || tier === "admin"));

  if (!hasPremiumAiAccess) {
    return {
      user: null,
      isAdmin,
      error: jsonError("Ask Loombus AI requires Premium access.", 403, {
        code: "premium_required",
        upgradeRequired: true,
      }),
    };
  }

  return { user, isAdmin, error: null };
}

async function generateSearchAnswer({
  query,
  context,
}: {
  query: string;
  context: string;
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("Ask Loombus AI is not configured yet.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SEARCH_AI_MODEL,
      temperature: 0.2,
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content:
            "You are Loombus AI inside Everything Search. Organize only the supplied Loombus sources. Never claim to search the open web. Never invent businesses, people, prices, reviews, expertise, availability, consensus, or source counts. Use source markers such as [1] only when the numbered source directly supports the sentence. Distinguish member experiences from verified facts. Private Room and private saved-item material is not supplied. When evidence is thin or conflicting, say so plainly. Keep the response practical and concise. End with one useful next action inside Loombus.",
        },
        {
          role: "user",
          content: `User search query:\n${query}\n\nAvailable Loombus sources:\n${
            context || "No public or eligible Loombus sources were returned."
          }\n\nReturn a concise grounded answer with source markers where supported, any important uncertainty, and one next action inside Loombus.`,
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Ask Loombus AI failed.");
  }

  const answer = payload?.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new Error("Ask Loombus AI returned no answer.");
  }

  return {
    answer: answer.slice(0, 2500),
    usageMetadata: getOpenAiUsageMetadata(payload, SEARCH_AI_MODEL),
  };
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const { user, error } = await getCurrentUserAndAccess(supabase);

  if (error) {
    return error;
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid Ask Loombus AI payload.", 400);
  }

  const query = clampText(
    (body as Record<string, unknown>).query,
    MAX_QUERY_CHARS
  );

  if (query.length < 2) {
    return jsonError("Type a question or search first.", 400);
  }

  try {
    const search = await runEverythingSearch({
      request,
      query,
      limit: 24,
    });
    const eligibleResults = search.results.filter(
      (result) =>
        result.visibility !== "member" && result.visibility !== "private"
    );
    const context = compactContext(eligibleResults);

    if (!context) {
      return jsonError(
        "No public, member-directory, or Premium sources are available for AI organization. Private Room and saved-item content stays private.",
        409,
        { code: "no_ai_eligible_search_context" }
      );
    }

    const generated = await generateSearchAnswer({ query, context });

    await logAiUsage({
      supabase,
      userId: user.id,
      featureKey: FEATURE_KEY,
      targetType: "everything_search",
      provider: "openai",
      modelName: SEARCH_AI_MODEL,
      cached: false,
      success: true,
      ...generated.usageMetadata,
    });

    return NextResponse.json(
      {
        answer: generated.answer,
        modelName: SEARCH_AI_MODEL,
        brief: search.brief,
        sources: eligibleResults.slice(0, 10).map((result, index) => ({
          number: index + 1,
          type: result.type,
          label: result.sourceLabel,
          title: result.title,
          href: result.href,
        })),
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (caughtError) {
    const message =
      caughtError instanceof Error
        ? caughtError.message
        : "Ask Loombus AI failed.";

    await logAiUsage({
      supabase,
      userId: user.id,
      featureKey: FEATURE_KEY,
      targetType: "everything_search",
      provider: "openai",
      modelName: SEARCH_AI_MODEL,
      cached: false,
      success: false,
      errorMessage: message,
    });

    if (caughtError instanceof EverythingSearchError) {
      return jsonError(caughtError.message, caughtError.status, {
        code: caughtError.code,
      });
    }

    return jsonError(message, 500);
  }
}
