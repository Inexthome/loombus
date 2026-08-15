import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { syncCreatorPayoutAccountEvent } from "@/lib/creator-supporter-billing";
import { syncAdoptedCreatorPayoutAccountEvent } from "@/lib/creator-supporter-payout-adoption-server";
import { syncMemberPayoutAccountEvent } from "@/lib/member-payout-account-server";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_CONNECT_WEBHOOK_SECRET =
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

function getStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(STRIPE_SECRET_KEY);
}

export async function POST(request: NextRequest) {
  if (!STRIPE_SECRET_KEY || !STRIPE_CONNECT_WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        error:
          "Stripe Connect webhook is not configured yet. Stripe secret key and Connect webhook secret are required.",
        code: "stripe_connect_webhook_not_configured",
      },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_CONNECT_WEBHOOK_SECRET
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      "Stripe Connect webhook signature verification failed:",
      message
    );
    return NextResponse.json(
      { error: "Invalid Stripe Connect webhook signature." },
      { status: 400 }
    );
  }

  try {
    if (event.type !== "account.updated") {
      console.log(`Unhandled Stripe Connect webhook event: ${event.type}`);
      return NextResponse.json({ received: true });
    }

    const account = event.data.object as Stripe.Account;

    await syncMemberPayoutAccountEvent(account);

    const adoptedCreatorHandled =
      await syncAdoptedCreatorPayoutAccountEvent(account);

    if (!adoptedCreatorHandled) {
      await syncCreatorPayoutAccountEvent(account);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe Connect webhook handling failed:", error);
    return NextResponse.json(
      { error: "Stripe Connect webhook handling failed." },
      { status: 500 }
    );
  }
}
