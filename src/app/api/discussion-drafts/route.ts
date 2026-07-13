import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_DISCUSSION_TOPIC, DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { normalizeRealityLens } from "@/lib/reality-lenses";
import { normalizePurposeLane } from "@/lib/purpose-lanes";
import { normalizePublicText } from "@/lib/public-text";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

  const authorization = request.headers.get("authorization") ?? "";

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

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
}

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const { data, error } = await supabase
    .from("discussion_drafts")
    .select("id, title, topic, reality_lens, purpose_lane, body, created_at, updated_at")
    .eq("user_id", accountAccess.user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return jsonError(error.message || "Unable to load draft.", 400);
  }

  return NextResponse.json({ draft: data ?? null });
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid draft payload.", 400);
  }

  const source = body as Record<string, unknown>;
  const draftId = source.draftId;
  const title = cleanText(source.title, 140);
  const rawTopic = typeof source.topic === "string" ? source.topic : "";
  const reality_lens = normalizeRealityLens(source.realityLens ?? source.reality_lens);
  const purpose_lane = normalizePurposeLane(source.purposeLane ?? source.purpose_lane);
  const topic = DISCUSSION_TOPICS.includes(rawTopic as typeof DISCUSSION_TOPICS[number])
    ? rawTopic
    : DEFAULT_DISCUSSION_TOPIC;
  const draftBody = normalizePublicText(String(source.body ?? "")).slice(0, 12000);

  if (!title && !draftBody) {
    return jsonError("Add a title or body before saving a draft.", 400);
  }

  const payload = {
    user_id: accountAccess.user.id,
    title,
    topic,
    reality_lens,
    purpose_lane,
    body: draftBody,
  };

  const requestQuery = isValidUuid(draftId)
    ? supabase
        .from("discussion_drafts")
        .update(payload)
        .eq("id", draftId)
        .eq("user_id", accountAccess.user.id)
        .select("id, updated_at")
        .single()
    : supabase
        .from("discussion_drafts")
        .insert(payload)
        .select("id, updated_at")
        .single();

  const { data, error } = await requestQuery;

  if (error) {
    return jsonError(error.message || "Unable to save draft.", 400);
  }

  return NextResponse.json({ draft: data });
}

export async function DELETE(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const body = await request.json().catch(() => null);
  const draftId = body?.draftId;

  if (!isValidUuid(draftId)) {
    return jsonError("Invalid draft id.", 400);
  }

  const { error } = await supabase
    .from("discussion_drafts")
    .delete()
    .eq("id", draftId)
    .eq("user_id", accountAccess.user.id);

  if (error) {
    return jsonError(error.message || "Unable to delete draft.", 400);
  }

  return NextResponse.json({ ok: true });
}
