import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createLibraryCheckout, LibraryCommerceError } from "@/lib/library-commerce-server";

function safeOrigin(request: NextRequest) {
  const candidate = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "https://loombus.com";
  try {
    const parsed = new URL(candidate);
    return parsed.origin;
  } catch {
    return "https://loombus.com";
  }
}

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

    const body = (await request.json().catch(() => ({}))) as { publicationId?: string };
    if (!body.publicationId) {
      return NextResponse.json({ error: "Publication is required." }, { status: 400 });
    }

    const result = await createLibraryCheckout({
      publicationId: body.publicationId,
      buyerId: userResult.user.id,
      buyerEmail: userResult.user.email,
      origin: safeOrigin(request),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LibraryCommerceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("Library checkout failed:", error);
    return NextResponse.json({ error: "Library checkout is temporarily unavailable." }, { status: 500 });
  }
}
