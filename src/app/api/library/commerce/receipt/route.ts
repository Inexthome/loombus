import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getBillingSupabaseAdmin } from "@/lib/billing-entitlements";
import { requireMemberUser } from "@/lib/member-privacy-server";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: message, ...(code ? { code } : {}) },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

function stripe() {
  if (!STRIPE_SECRET_KEY) return null;
  return new Stripe(STRIPE_SECRET_KEY);
}

export async function POST(request: NextRequest) {
  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401, "unauthorized");

  const body = (await request.json().catch(() => ({}))) as { purchaseId?: unknown };
  const purchaseId = typeof body.purchaseId === "string" ? body.purchaseId.trim() : "";
  if (!purchaseId) return jsonError("Purchase is required.", 400, "purchase_required");

  const admin = getBillingSupabaseAdmin();
  const { data: purchase, error } = await (admin.from("library_book_purchases") as any)
    .select("id,buyer_id,stripe_payment_intent_id,status")
    .eq("id", purchaseId)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Unable to load Library purchase for receipt.", error);
    return jsonError("Unable to load this Library purchase.", 503, "purchase_lookup_failed");
  }
  if (!purchase?.id) return jsonError("Library purchase not found.", 404, "purchase_not_found");
  if (!purchase.stripe_payment_intent_id) {
    return jsonError("A Stripe receipt is not available for this transaction.", 409, "receipt_unavailable");
  }

  const stripeClient = stripe();
  if (!stripeClient) return jsonError("Receipt service is not configured.", 503, "receipt_service_unavailable");

  try {
    const paymentIntent = await stripeClient.paymentIntents.retrieve(
      purchase.stripe_payment_intent_id,
      { expand: ["latest_charge"] }
    );

    let charge: Stripe.Charge | null = null;
    if (typeof paymentIntent.latest_charge === "string") {
      charge = await stripeClient.charges.retrieve(paymentIntent.latest_charge);
    } else if (paymentIntent.latest_charge) {
      charge = paymentIntent.latest_charge;
    }

    if (!charge?.receipt_url) {
      return jsonError("Stripe has not made a hosted receipt available for this transaction.", 409, "receipt_unavailable");
    }

    return NextResponse.json(
      { receiptUrl: charge.receipt_url },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (stripeError) {
    console.error("Unable to retrieve Library Stripe receipt.", stripeError);
    return jsonError("Unable to retrieve this receipt right now.", 503, "receipt_lookup_failed");
  }
}
