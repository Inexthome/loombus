import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";

const MESSAGE_ASSIST_MODEL =
  process.env.OPENAI_MESSAGE_ASSIST_MODEL ||
  process.env.OPENAI_REWRITE_MODEL ||
  process.env.OPENAI_SUMMARY_MODEL ||
  "gpt-4o-mini";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

function clampInput(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .replace(/\s+$/g, "")
    .slice(0, maxLength);
}

function getInstruction(mode: string) {
  if (mode === "warmer") {
    return "Rewrite the message to sound warmer, respectful, and human. Keep the same meaning. Do not add facts.";
  }

  if (mode === "shorter") {
    return "Rewrite the message to be shorter and easier to read. Keep the same meaning. Do not add facts.";
  }

  if (mode === "rewrite") {
    return "Rewrite the message into a polished private message. Keep it natural, direct, and respectful. Do not add facts.";
  }

  return "Rewrite the message to be clearer while keeping the same meaning. Do not add facts.";
}

async function getCurrentUserAndAccess(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, error: jsonError("Unauthorized.", 401) };
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
      error: jsonError(
        enforcement.errorMessage ?? "Account restricted.",
        403,
        { code: enforcement.code }
      ),
    };
  }

  const isAdmin = Boolean(profile?.is_admin) || entitlement?.tier === "admin";
  const hasPremiumPlusAccess =
    isAdmin ||
    (entitlement?.ai_assisted_enabled === true &&
      (entitlement.tier === "premium_plus" ||
        (entitlement.tier === "premium" &&
          (entitlement.monthly_summary_limit ?? 0) > 50)));

  if (!hasPremiumPlusAccess) {
    return {
      user: null,
      error: jsonError("AI message assist requires Premium Plus access.", 403, {
        code: "premium_plus_required",
        upgradeRequired: true,
      }),
    };
  }

  return { user, error: null };
}

async function generateAssistedMessage({
  text,
  mode,
}: {
  text: string;
  mode: string;
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("AI message assist is not configured yet.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MESSAGE_ASSIST_MODEL,
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content:
            "You are a private-message writing assistant for Loombus. Improve only the user's draft message. Return only the rewritten message. Do not explain. Do not add claims, facts, promises, threats, or sensitive details. Preserve the user's intent.",
        },
        {
          role: "user",
          content: `${getInstruction(mode)}\n\nDraft message:\n${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.error?.message ?? "AI message assist generation failed."
    );
  }

  const payload = await response.json();
  const assistedText = payload?.choices?.[0]?.message?.content?.trim();

  if (!assistedText) {
    throw new Error("AI message assist returned no text.");
  }

  return assistedText.slice(0, 4000);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const { error } = await getCurrentUserAndAccess(supabase);

  if (error) {
    return error;
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid AI assist payload.", 400);
  }

  const text = clampInput((body as Record<string, unknown>).text, 2000);
  const mode = clampInput((body as Record<string, unknown>).mode, 40);

  if (text.length < 3) {
    return jsonError("Write a message draft first.", 400);
  }

  if (text.length > 2000) {
    return jsonError("Message draft is too long for AI assist.", 400);
  }

  try {
    const assistedText = await generateAssistedMessage({
      text,
      mode,
    });

    return NextResponse.json({
      assistedText,
      mode,
    });
  } catch (assistError) {
    return jsonError(
      assistError instanceof Error
        ? assistError.message
        : "Unable to generate AI message assist.",
      500
    );
  }
}
