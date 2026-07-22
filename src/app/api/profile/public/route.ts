import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type Entitlement = { tier: string | null; ai_assisted_enabled: boolean | null; monthly_summary_limit: number | null };
const PERSPECTIVE_MARKERS = new Set(["Lived experience", "Professional experience", "Research-based", "Builder / operator", "Student / learner", "Question / exploring"]);
function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validUrl(value: string) { return !value || /^https?:\/\//i.test(value); }
function creatorAccess(entitlement: Entitlement | null, admin: boolean) { return admin || Boolean(entitlement?.ai_assisted_enabled && entitlement.tier === "premium" && (entitlement.monthly_summary_limit ?? 0) > 50); }
function client(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration");
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: authorization ? { Authorization: authorization } : {} } });
}
export async function POST(request: NextRequest) {
  let supabase;
  try { supabase = client(request); } catch { return NextResponse.json({ error: "Server configuration error." }, { status: 500 }); }
  const access = await verifyRequestAccountAccess(supabase);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: access.status });
  const source = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!source || Array.isArray(source)) return NextResponse.json({ error: "Invalid profile payload." }, { status: 400 });
  const gate = validatePublicProfileCompletion({ fullName: clean(source.fullName, 80), username: clean(source.username, 30), bio: typeof source.bio === "string" ? source.bio : "" });
  if (!gate.ok) return NextResponse.json({ error: gate.message, code: gate.code }, { status: 400 });
  const perspective = typeof source.perspectiveMarker === "string" && PERSPECTIVE_MARKERS.has(source.perspectiveMarker) ? source.perspectiveMarker : null;
  const avatarUrl = clean(source.avatarUrl, 500) || null;
  const website = clean(source.creatorWebsiteUrl, 240);
  const support = clean(source.creatorSupportUrl, 240);
  const supportLabel = clean(source.creatorSupportLabel, 40);
  if (!validUrl(website) || !validUrl(support)) return NextResponse.json({ error: "Creator and support URLs must start with http:// or https://." }, { status: 400 });
  const [{ data: duplicate }, { data: entitlement }] = await Promise.all([
    supabase.from("profiles").select("id").eq("username", gate.normalizedUsername).neq("id", access.user.id).maybeSingle(),
    supabase.from("user_ai_entitlements").select("tier, ai_assisted_enabled, monthly_summary_limit").eq("user_id", access.user.id).maybeSingle(),
  ]);
  if (duplicate) return NextResponse.json({ error: "That username is already taken. Please choose another one." }, { status: 409 });
  if ((website || support || supportLabel) && !creatorAccess((entitlement ?? null) as Entitlement | null, Boolean(access.profile.is_admin))) return NextResponse.json({ error: "Creator/supporter profile tools require Premium Plus access." }, { status: 403 });
  const profile = { id: access.user.id, full_name: gate.normalizedName, username: gate.normalizedUsername, bio: gate.normalizedBio, perspective_marker: perspective, avatar_url: avatarUrl, creator_website_url: website || null, creator_support_url: support || null, creator_support_label: supportLabel || null };
  const { error } = await supabase.from("profiles").upsert(profile);
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That username is already taken. Please choose another one." : error.message }, { status: error.code === "23505" ? 409 : 400 });
  return NextResponse.json({ ok: true, profile });
}
