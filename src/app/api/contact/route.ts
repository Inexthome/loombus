import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPPORT_CATEGORIES = new Set([
  "general",
  "account",
  "billing",
  "safety",
  "accessibility",
  "bug",
  "feedback",
  "legal",
]);

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const body = await request.json().catch(() => null);

  const email = cleanText(body?.email, 320).toLowerCase();
  const category = SUPPORT_CATEGORIES.has(cleanText(body?.category, 40))
    ? cleanText(body?.category, 40)
    : "general";
  const subject = cleanText(body?.subject, 160);
  const message = cleanText(body?.message, 4000);

  if (!isValidEmail(email)) {
    return jsonError("Enter a valid email address.", 400);
  }

  if (subject.length < 3) {
    return jsonError("Enter a support subject.", 400);
  }

  if (message.length < 10) {
    return jsonError("Enter a support message with at least 10 characters.", 400);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("support_requests")
    .insert({
      user_id: user?.id ?? null,
      email,
      category,
      subject,
      message,
      status: "new",
    })
    .select("id, status, created_at")
    .single();

  if (error) {
    return jsonError(error.message || "Unable to submit support request.", 400);
  }

  return NextResponse.json({
    request: data,
    message: "Support request submitted.",
  });
}
