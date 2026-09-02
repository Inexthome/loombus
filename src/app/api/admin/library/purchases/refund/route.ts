import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getBillingSupabaseAdmin } from "@/lib/billing-entitlements";
import { reconcileLibraryDestinationChargeLoss } from "@/lib/library-commerce-events-server";
import { createMemberPrivacyServiceClient, isAdmin, requireMemberUser } from "@/lib/member-privacy-server";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status, headers: { "Cache-Control": "private, no-store" } });
}

function stripe() {
  return STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
}

export async function POST(request: NextRequest) {
  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401, "unauthorized");

  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Administration service is unavailable.", 503, "admin_service_unavailable");
  if (!(await isAdmin(service, user.id))) return jsonError("Forbidden.", 403, "forbidden");

  const body = (await request.json().catch(() => ({}))) as { purchaseId?: unknown };
  const purchaseId = typeof body.purchaseId === "string" ? body.purchaseId.trim() : "";
  if (!purchaseId) return jsonError("Purchase is required.", 400, "purchase_required");

  const admin = getBillingSupabaseAdmin();
  const { data: purchase, error } = await (admin.from("library_book_purchases") as any)
    .select("id,status,stripe_payment_intent_id")
    .eq("id", purchaseId)
    .maybeSingle();
  if (error) return jsonError("Unable to load Library purchase.", 503, "purchase_lookup_failed");
  if (!purchase?.id) return jsonError("Library purchase not found.", 404, "purchase_not_found");
  if (purchase.status !== "paid") {
    return jsonError("Only settled paid Library purchases can be refunded through this operation.", 409, "purchase_not_refundable");
  }
  if (!purchase.stripe_payment_intent_id) {
    return jsonError("This purchase has no Stripe payment to refund.", 409, "payment_missing");
  }

  const stripeClient = stripe();
  if (!stripeClient) return jsonError("Stripe refund service is not configured.", 503, "refund_service_unavailable");

  try {
    const intent = await stripeClient.paymentIntents.retrieve(purchase.stripe_payment_intent_id, {
      expand: ["latest_charge"],
    });
    const latestCharge = intent.latest_charge;
    const charge = typeof latestCharge === "string"
      ? await stripeClient.charges.retrieve(latestCharge)
      : latestCharge ?? null;
    if (!charge) return jsonError("Stripe charge could not be resolved.", 409, "charge_missing");

    const refund = await stripeClient.refunds.create(
      {
        charge: charge.id,
        metadata: {
          product: "loombus_library_book",
          purchase_id: purchase.id,
          initiated_by_admin: user.id,
        },
      },
      { idempotencyKey: `loombus-library-full-refund-${purchase.id}` }
    );

    // RefundCreateParams in the current Stripe SDK does not expose Connect
    // transfer/application-fee reversal flags. Reconcile both explicitly using
    // the same idempotent helper the refund webhook uses, so webhook races are safe.
    await reconcileLibraryDestinationChargeLoss(charge, purchase.id, "refund");

    return NextResponse.json(
      { refundId: refund.id, status: refund.status },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (refundError) {
    console.error("Unable to refund Library purchase.", refundError);
    return jsonError("Unable to issue this Library refund right now.", 503, "refund_failed");
  }
}
