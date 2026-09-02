import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LibraryCommerceError, verifyAndFulfillLibraryCheckoutSession } from "@/lib/library-commerce-server";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const token = authHeader.slice("Bearer ".length);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userResult.user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
    if (!body.sessionId?.startsWith("cs_")) {
      return NextResponse.json({ error: "Checkout session is required." }, { status: 400 });
    }

    const result = await verifyAndFulfillLibraryCheckoutSession(body.sessionId, userResult.user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof LibraryCommerceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("Library checkout finalization failed:", error);
    return NextResponse.json({ error: "Unable to verify this Library purchase." }, { status: 500 });
  }
}
