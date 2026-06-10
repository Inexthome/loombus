import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
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

function jsonError(message: string, status: number, extras: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extras }, { status });
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

function compactContextItem(item: unknown) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return "";
  }

  const record = item as Record<string, unknown>;
  const kind = clampText(record.kind, 40);
  const title = clampText(record.title, 180);
  const description = clampText(record.description, 400);
  const href = clampText(record.href, 180);

  return [
    kind ? `Type: ${kind}` : "",
    title ? `Title: ${title}` : "",
    description ? `Context: ${description}` : "",
    href ? `Path: ${href}` : "",
  ].filter(Boolean).join("\n");
}

function compactContext(items: unknown) {
  if (!Array.isArray(items)) {
    return "";
  }

  return items
    .slice(0, 12)
    .map(compactContextItem)
    .filter(Boolean)
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
      temperature: 0.25,
      max_tokens: 360,
      messages: [
        {
          role: "system",
          content:
            "You are Loombus AI inside Global Search. Help the user understand what to do next on Loombus. Use only the provided search context and general platform navigation. Do not claim access to private, admin, or hidden data. Do not reveal private notes unless they are explicitly included in the provided user-owned context. Keep the answer concise, practical, and non-hype.",
        },
        {
          role: "user",
          content: `User search query:\n${query}\n\nAvailable Loombus search context:\n${context || "No matching context was provided."}\n\nReturn a short answer with 2-4 bullets and one suggested next action.`,
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

  const query = clampText((body as Record<string, unknown>).query, MAX_QUERY_CHARS);
  const context = compactContext((body as Record<string, unknown>).context);

  if (query.length < 2) {
    return jsonError("Type a question or search first.", 400);
  }

  try {
    const generated = await generateSearchAnswer({
      query,
      context,
    });

    await logAiUsage({
      supabase,
      userId: user.id,
      featureKey: FEATURE_KEY,
      targetType: "search",
      provider: "openai",
      modelName: SEARCH_AI_MODEL,
      cached: false,
      success: true,
      ...generated.usageMetadata,
    });

    return NextResponse.json({
      answer: generated.answer,
      modelName: SEARCH_AI_MODEL,
    });
  } catch (error) {
    await logAiUsage({
      supabase,
      userId: user.id,
      featureKey: FEATURE_KEY,
      targetType: "search",
      provider: "openai",
      modelName: SEARCH_AI_MODEL,
      cached: false,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Ask Loombus AI failed.",
    });

    return jsonError(
      error instanceof Error ? error.message : "Unable to ask Loombus AI.",
      500
    );
  }
}
