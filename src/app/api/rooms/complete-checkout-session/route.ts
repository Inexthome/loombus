import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

function getSafeRoomId(value: unknown) {
  return typeof value === "string" && /^[0-9a-fA-F-]{20,80}$/.test(value) ? value : "";
}

function getSafeSessionId(value: unknown) {
  return typeof value === "string" && value.startsWith("cs_") ? value : "";
}

async function updateRoomStatus(
  supabase: ReturnType<typeof createClient>,
  roomId: string,
  planKey: string
) {
  const { error } = await supabase
    .from("rooms")
    .update({
      subscription_plan: planKey,
      subscription_status: "active",
    })
    .eq("id", roomId);

  if (error) throw error;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      roomId?: unknown;
      sessionId?: unknown;
    };

    const roomId = getSafeRoomId(body.roomId);
    const sessionId = getSafeSessionId(body.sessionId);

    if (!roomId || !sessionId) {
      return NextResponse.json({ error: "Room ID and session ID are required." }, { status: 400 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || membership?.role !== "owner") {
      return NextResponse.json({ error: "Only the room owner can complete billing." }, { status: 403 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      session.metadata?.product !== "loombus_room" ||
      session.metadata?.room_id !== roomId ||
      session.metadata?.user_id !== user.id
    ) {
      return NextResponse.json({ error: "Stripe session does not match this room." }, { status: 400 });
    }

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return NextResponse.json({ error: "Room checkout is not complete yet." }, { status: 409 });
    }

    const planKey = session.metadata?.room_plan ?? "starter";
    await updateRoomStatus(supabase, roomId, planKey);

    return NextResponse.json({ ok: true, roomId, planKey });
  } catch (error) {
    console.error("Room checkout completion failed:", error);

    return NextResponse.json(
      { error: "Unable to complete room checkout." },
      { status: 500 }
    );
  }
}
