import "server-only";

import Stripe from "stripe";
import { getBillingSupabaseAdmin } from "@/lib/billing-entitlements";
import { getMemberPayoutIdentity, refreshMemberPayoutAccount } from "@/lib/member-payout-account-server";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const LIBRARY_PRODUCT = "loombus_library_book";

export class LibraryCommerceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "library_commerce_error") {
    super(message);
    this.name = "LibraryCommerceError";
    this.status = status;
    this.code = code;
  }
}

function stripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new LibraryCommerceError("Library checkout is not configured.", 503, "library_checkout_not_configured");
  }
  return new Stripe(STRIPE_SECRET_KEY);
}

export function getLibraryPlatformFeeBps() {
  const raw = process.env.LOOMBUS_LIBRARY_PLATFORM_FEE_BPS;
  if (!raw || !/^\d+$/.test(raw)) {
    throw new LibraryCommerceError(
      "Library checkout is waiting for the Loombus Library platform fee configuration.",
      503,
      "library_platform_fee_not_configured"
    );
  }
  const bps = Number.parseInt(raw, 10);
  if (bps < 0 || bps > 3000) {
    throw new LibraryCommerceError(
      "The configured Library platform fee is invalid.",
      503,
      "library_platform_fee_invalid"
    );
  }
  return bps;
}

export function libraryPlatformFeeCents(amountCents: number) {
  return Math.floor((amountCents * getLibraryPlatformFeeBps()) / 10_000);
}

export function isLibraryBookCheckoutSession(session: Stripe.Checkout.Session) {
  return session.metadata?.product === LIBRARY_PRODUCT;
}

export async function getLibrarySaleOffer(publicationId: string, buyerId: string) {
  const admin = getBillingSupabaseAdmin();
  const { data: publication, error: publicationError } = await (admin.from("library_publications") as any)
    .select("id,title,status,is_free,price_cents,currency")
    .eq("id", publicationId)
    .maybeSingle();

  if (publicationError || !publication || publication.status !== "published") {
    throw new LibraryCommerceError("This publication is not available for purchase.", 404, "library_publication_unavailable");
  }
  if (publication.is_free) {
    throw new LibraryCommerceError("This publication is free to read.", 409, "library_publication_free");
  }
  if (!Number.isInteger(publication.price_cents) || publication.price_cents < 100 || publication.currency !== "USD") {
    throw new LibraryCommerceError("This publication does not have a valid selling price.", 409, "library_price_invalid");
  }

  const { data: ownership, error: ownershipError } = await (admin.from("library_author_publications") as any)
    .select("user_id,retired_at")
    .eq("publication_id", publicationId)
    .maybeSingle();
  if (ownershipError || !ownership?.user_id || ownership.retired_at) {
    throw new LibraryCommerceError("This publication is not available for purchase.", 409, "library_seller_unavailable");
  }
  if (ownership.user_id === buyerId) {
    throw new LibraryCommerceError("Authors already have access to their own publication.", 409, "library_author_purchase_not_required");
  }

  const { data: entitlement, error: entitlementError } = await (admin.from("library_book_purchases") as any)
    .select("id,status")
    .eq("buyer_id", buyerId)
    .eq("publication_id", publicationId)
    .in("status", ["paid", "disputed"])
    .maybeSingle();
  if (entitlementError) {
    throw new LibraryCommerceError("Unable to verify Library ownership.", 503, "library_entitlement_check_failed");
  }
  if (entitlement?.id) {
    throw new LibraryCommerceError("You already own this publication.", 409, "library_publication_already_owned");
  }

  let payout = await getMemberPayoutIdentity(ownership.user_id);
  if (payout) payout = await refreshMemberPayoutAccount(ownership.user_id);
  if (!payout || !payout.details_submitted || !payout.payouts_enabled) {
    throw new LibraryCommerceError(
      "This author has not completed payout setup, so this publication cannot be purchased yet.",
      409,
      "library_author_payout_not_ready"
    );
  }

  return {
    publicationId: publication.id as string,
    title: publication.title as string,
    amountCents: publication.price_cents as number,
    currency: "usd" as const,
    sellerId: ownership.user_id as string,
    stripeAccountId: payout.stripe_account_id,
  };
}

export async function createLibraryCheckout(input: {
  publicationId: string;
  buyerId: string;
  buyerEmail?: string | null;
  origin: string;
}) {
  const offer = await getLibrarySaleOffer(input.publicationId, input.buyerId);
  const platformFeeCents = libraryPlatformFeeCents(offer.amountCents);
  const metadata = {
    product: LIBRARY_PRODUCT,
    publication_id: offer.publicationId,
    buyer_id: input.buyerId,
    seller_id: offer.sellerId,
    amount_cents: String(offer.amountCents),
    currency: "USD",
    platform_fee_cents: String(platformFeeCents),
  };

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: offer.currency,
        unit_amount: offer.amountCents,
        product_data: { name: offer.title, metadata: { publication_id: offer.publicationId } },
      },
      quantity: 1,
    }],
    client_reference_id: input.buyerId,
    customer_email: input.buyerEmail ?? undefined,
    success_url: `${input.origin}/library/publication/${encodeURIComponent(offer.publicationId)}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/library/publication/${encodeURIComponent(offer.publicationId)}?checkout=cancelled`,
    metadata,
    payment_intent_data: {
      metadata,
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: offer.stripeAccountId },
    },
  }, {
    idempotencyKey: `loombus-library-book:${input.buyerId}:${offer.publicationId}:${offer.amountCents}`,
  });

  if (!session.url) {
    throw new LibraryCommerceError("Stripe did not return a Library checkout URL.", 502, "library_checkout_url_missing");
  }
  return { url: session.url };
}

export async function fulfillLibraryCheckoutSession(session: Stripe.Checkout.Session) {
  if (!isLibraryBookCheckoutSession(session)) return false;
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    throw new LibraryCommerceError("Library checkout is not paid.", 409, "library_checkout_not_paid");
  }

  const publicationId = session.metadata?.publication_id;
  const buyerId = session.metadata?.buyer_id ?? session.client_reference_id ?? null;
  const sellerId = session.metadata?.seller_id;
  if (!publicationId || !buyerId || !sellerId) {
    throw new LibraryCommerceError("Library checkout metadata is incomplete.", 409, "library_checkout_metadata_invalid");
  }

  const admin = getBillingSupabaseAdmin();
  const { data: publication, error: publicationError } = await (admin.from("library_publications") as any)
    .select("id,status,is_free,price_cents,currency")
    .eq("id", publicationId)
    .maybeSingle();
  if (publicationError || !publication || publication.is_free || publication.currency !== "USD") {
    throw new LibraryCommerceError("Library checkout no longer matches a paid publication.", 409, "library_checkout_publication_invalid");
  }

  const expectedAmount = Number(session.metadata?.amount_cents);
  const expectedFee = Number(session.metadata?.platform_fee_cents);
  if (!Number.isInteger(expectedAmount) || expectedAmount !== session.amount_total || expectedAmount !== publication.price_cents) {
    throw new LibraryCommerceError("Library checkout amount verification failed.", 409, "library_checkout_amount_mismatch");
  }
  if (!Number.isInteger(expectedFee) || expectedFee < 0 || expectedFee > expectedAmount) {
    throw new LibraryCommerceError("Library checkout fee verification failed.", 409, "library_checkout_fee_mismatch");
  }

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const now = new Date().toISOString();
  const { error } = await (admin.from("library_book_purchases") as any).upsert({
    buyer_id: buyerId,
    publication_id: publicationId,
    seller_id: sellerId,
    status: "paid",
    amount_cents: expectedAmount,
    currency: "USD",
    platform_fee_cents: expectedFee,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    purchased_at: now,
    updated_at: now,
  }, { onConflict: "stripe_checkout_session_id" });
  if (error) {
    throw new LibraryCommerceError(`Unable to fulfill Library purchase: ${error.message}`, 503, "library_purchase_fulfillment_failed");
  }
  return true;
}

export async function verifyAndFulfillLibraryCheckoutSession(sessionId: string, buyerId: string) {
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  if (!isLibraryBookCheckoutSession(session)) {
    throw new LibraryCommerceError("This is not a Library checkout session.", 400, "library_checkout_session_invalid");
  }
  const sessionBuyerId = session.metadata?.buyer_id ?? session.client_reference_id ?? null;
  if (sessionBuyerId !== buyerId) {
    throw new LibraryCommerceError("This checkout belongs to another account.", 403, "library_checkout_owner_mismatch");
  }
  await fulfillLibraryCheckoutSession(session);
  return { publicationId: session.metadata!.publication_id! };
}
