import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type AppearanceTheme = "system" | "dark" | "light";

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "").trim() || null;
}

function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return value === "system" || value === "dark" || value === "light";
}

export async function PUT(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!token || !serviceKey) {
      return NextResponse.json({ error: "Unable to update appearance." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const appearanceTheme = body?.appearance_theme;

    if (!isAppearanceTheme(appearanceTheme)) {
      return NextResponse.json({ error: "Invalid appearance theme." }, { status: 400 });
    }

    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await adminSupabase.from("loombus_shell_preferences").upsert(
      {
        user_id: user.id,
        layout_version: "v2",
        appearance_theme: appearanceTheme,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("V2 appearance preference update failed:", error.message);
      return NextResponse.json({ error: "Unable to save appearance." }, { status: 500 });
    }

    return NextResponse.json({ appearance_theme: appearanceTheme });
  } catch (error) {
    console.error("Unexpected V2 appearance API failure:", error);
    return NextResponse.json({ error: "Unable to save appearance." }, { status: 500 });
  }
}
