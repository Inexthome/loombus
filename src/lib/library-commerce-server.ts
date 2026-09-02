import "server-only";

import Stripe from "stripe";
import { getBillingSupabaseAdmin } from "@/lib/billing-entitlements";
import { getMemberPayoutIdentity, refreshMemberPayoutAccount } from "@/lib/member-payout-account-server";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const LIBRARY_PRODUCT = "loombus_library_book";
const CHECKOUT_SESSION_MS = 60 * 60 * 1000;
const LIBRARY_LAUNCH_FEE_BPS = 1500;
const LIBRARY_STANDARD_FEE_BPS = 2000;
// The launch rate applies through September 2, 2027. The standard rate begins
// at 00:00:00 UTC on September 3, 2027, so the cutoff is deterministic globally.
const LIBRARY_STANDARD_FEE_START_MS = Date.UTC(2027, 8, 3, 0, 0, 0, 0);

type CheckoutReservation = {
  id: string;
  buyer_id: string;
  publication_id: string;
  seller_id: string;
  amount_cents: number;
  currency: "USD";
  platform_fee_cents: number;
  stripe_checkout_session_id: string | null;
  checkout_expires_at: string;
};

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

export function getLibraryPlatformFeeBps(at = new Date()) {
  const timestamp = at.getTime();
  if (!Number.isFinite(timestamp)) {
    throw new LibraryCommerceError("Unable to determine the Library platform fee.", 503, "library_platform_fee_date_invalid");
  }
  return timestamp < LIBRARY_STANDARD_FEE_START_MS ? LIBRARY_LAUNCH_FEE_BPS : LIBRARY_STANDARD_FEE_BPS;
}

export function libraryPlatformFeeCents(amountCents: number, at = new Date()) {
  return Math.floor((amountCents * getLibraryPlatformFeeBps(at)) / 10_000);
}

export function isLibraryBookCheckoutSession(session: Stripe.Checkout.Session) {
  return session.metadata?.product === LIBRARY_PRODUCT;
}

async function ensureNoActiveEntitlement(buyerId: string, publicationId: string) {
  const admin = getBillingSupabaseAdmin();
  const { data, error } = await (admin.from("library_book_purchases") as any)
    .select("id,status")
    .eq("buyer_id", buyerId)
    .eq("publication_id", publicationId)
    .in("status", ["paid", "disputed"])
    .maybeSingle();
  if (error) {
    throw new LibraryCommerceError("Unable to verify Library ownership.", 503, "library_entitlement_check_failed");
  }
  if (data?.id) {
    throw new LibraryCommerceError("You already own this publication.", 409, "library_publication_already_owned");
  }
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

  await ensureNoActiveEntitlement(buyerId, publicationId);

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

function reservationExpired(reservation: CheckoutReservation) {
  const expiresAt = new Date(reservation.checkout_expires_at).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

async function loadReservation(buyerId: string, publicationId: string) {
  const admin = getBillingSupabaseAdmin();
  const { data, error } = await (admin.from("library_book_checkout_reservations") as any)
    .select("id,buyer_id,publication_id,seller_id,amount_cents,currency,platform_fee_cents,stripe_checkout_session_id,checkout_expires_at")
    .eq("buyer_id", buyerId)
    .eq("publication_id", publicationId)
    .maybeSingle();
  if (error) {
    throw new LibraryCommerceError("Unable to verify Library checkout state.", 503, "library_checkout_reservation_failed");
  }
  return (data ?? null) as CheckoutReservation | null;
}

async function deleteReservation(id: string) {
  const admin = getBillingSupabaseAdmin();
  const { error } = await (admin.from("library_book_checkout_reservations") as any).delete().eq("id", id);
  if (error) {
    throw new LibraryCommerceError("Unable to reset Library checkout state.", 503, "library_checkout_reservation_cleanup_failed");
  }
}

async function reserveCheckout(input: {
  buyerId: string;
  publicationId: string;
  sellerId: string;
  amountCents: number;
  platformFeeCents: number;
}) {
  const admin = getBillingSupabaseAdmin();
  const existing = await loadReservation(input.buyerId, input.publicationId);
  if (existing && !reservationExpired(existing)) return existing;
  if (existing) await deleteReservation(existing.id);

  const checkoutExpiresAt = new Date(Date.now() + CHECKOUT_SESSION_MS).toISOString();
  const { data, error } = await (admin.from("library_book_checkout_reservations") as any)
    .insert({
      buyer_id: input.buyerId,
      publication_id: input.publicationId,
      seller_id: input.sellerId,
      amount_cents: input.amountCents,
      currency: "USD",
      platform_fee_cents: input.platformFeeCents,
      checkout_expires_at: checkoutExpiresAt,
    })
    .select("id,buyer_id,publication_id,seller_id,amount_cents,currency,platform_fee_cents,stripe_checkout_session_id,checkout_expires_at")
    .single();

  if (!error && data) return data as CheckoutReservation;
  if (error?.code === "23505") {
    const winner = await loadReservation(input.buyerId, input.publicationId);
    if (winner && !reservationExpired(winner)) return winner;
  }
  throw new LibraryCommerceError("Unable to reserve Library checkout.", 503, "library_checkout_reservation_failed");
}

async function persistReservationSession(reservationId: string, sessionId: string) {
  const admin = getBillingSupabaseAdmin();
  const { error } = await (admin.from("library_book_checkout_reservations") as any)
    .update({ stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() })
    .eq("id", reservationId);
  if (error) {
    throw new LibraryCommerceError("Unable to save Library checkout state.", 503, "library_checkout_reservation_persist_failed");
  }
}

export async function createLibraryCheckout(input: {
  publicationId: string;
  buyerId: string;
  buyerEmail?: string | null;
  origin: string;
}) {
  const offer = await getLibrarySaleOffer(input.publicationId, input.buyerId);
  const platformFeeBps = getLibraryPlatformFeeBps();
  const platformFeeCents = Math.floor((offer.amountCents * platformFeeBps) / 10_000);
  let reservation = await reserveCheckout({
    buyerId: input.buyerId,
    publicationId: offer.publicationId,
    sellerId: offer.sellerId,
    amountCents: offer.amountCents,
    platformFeeCents,
  });

  if (reservation.stripe_checkout_session_id) {
    const existingSession = await stripe().checkout.sessions.retrieve(reservation.stripe_checkout_session_id);
    if (existingSession.status === "open" && existingSession.url) return { url: existingSession.url };
    if (existingSession.status === "complete") {
      if (existingSession.payment_status === "paid") await fulfillLibraryCheckoutSession(existingSession);
      throw new LibraryCommerceError("This checkout already completed. Your Library access is being finalized.", 409, "library_checkout_already_completed");
    }
    await deleteReservation(reservation.id);
    reservation = await reserveCheckout({
      buyerId: input.buyerId,
      publicationId: offer.publicationId,
      sellerId: offer.sellerId,
      amountCents: offer.amountCents,
      platformFeeCents,
    });
  }

  const metadata = {
    product: LIBRARY_PRODUCT,
    reservation_id: reservation.id,
    publication_id: reservation.publication_id,
    buyer_id: reservation.buyer_id,
    seller_id: reservation.seller_id,
    amount_cents: String(reservation.amount_cents),
    currency: reservation.currency,
    platform_fee_cents: String(reservation.platform_fee_cents),
    platform_fee_bps: String(platformFeeBps),
  };

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: reservation.amount_cents,
        product_data: { name: offer.title, metadata: { publication_id: reservation.publication_id } },
      },
      quantity: 1,
    }],
    client_reference_id: reservation.buyer_id,
    customer_email: input.buyerEmail ?? undefined,
    success_url: `${input.origin}/library/publication/${encodeURIComponent(reservation.publication_id)}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/library/publication/${encodeURIComponent(reservation.publication_id)}?checkout=cancelled`,
    expires_at: Math.floor(new Date(reservation.checkout_expires_at).getTime() / 1000),
    metadata,
    payment_intent_data: {
      metadata,
      application_fee_amount: reservation.platform_fee_cents,
      transfer_data: { destination: offer.stripeAccountId },
    },
  }, { idempotencyKey: `loombus-library-book-${reservation.id}` });

  if (!session.url) {
    throw new LibraryCommerceError("Stripe did not return a Library checkout URL.", 502, "library_checkout_url_missing");
  }
  await persistReservationSession(reservation.id, session.id);
  return { url: session.url };
}

async function purchaseBySession(sessionId: string) {
  const admin = getBillingSupabaseAdmin();
  const { data, error } = await (admin.from("library_book_purchases") as any)
    .select("id,buyer_id,publication_id,status")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (error) {
    throw new LibraryCommerceError("Unable to verify Library fulfillment.", 503, "library_purchase_lookup_failed");
  }
  return data ?? null;
}

async function reservationBySession(sessionId: string) {
  const admin = getBillingSupabaseAdmin();
  const { data, error } = await (admin.from("library_book_checkout_reservations") as any)
    .select("id,buyer_id,publication_id,seller_id,amount_cents,currency,platform_fee_cents,stripe_checkout_session_id,checkout_expires_at")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (error) {
    throw new LibraryCommerceError("Unable to verify Library checkout reservation.", 503, "library_checkout_reservation_lookup_failed");
  }
  return (data ?? null) as CheckoutReservation | null;
}

export async function fulfillLibraryCheckoutSession(session: Stripe.Checkout.Session) {
  if (!isLibraryBookCheckoutSession(session)) return false;
  const already = await purchaseBySession(session.id);
  if (already?.id) return true;
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    throw new LibraryCommerceError("Library checkout is not paid.", 409, "library_checkout_not_paid");
  }

  const reservation = await reservationBySession(session.id);
  if (!reservation) {
    throw new LibraryCommerceError("Library checkout reservation is missing.", 409, "library_checkout_reservation_missing");
  }
  if (
    session.metadata?.reservation_id !== reservation.id ||
    session.metadata?.publication_id !== reservation.publication_id ||
    (session.metadata?.buyer_id ?? session.client_reference_id) !== reservation.buyer_id ||
    session.metadata?.seller_id !== reservation.seller_id ||
    session.amount_total !== reservation.amount_cents ||
    session.currency?.toUpperCase() !== reservation.currency ||
    Number(session.metadata?.platform_fee_cents) !== reservation.platform_fee_cents
  ) {
    throw new LibraryCommerceError("Library checkout verification failed.", 409, "library_checkout_snapshot_mismatch");
  }

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const now = new Date().toISOString();
  const admin = getBillingSupabaseAdmin();
  const { error } = await (admin.from("library_book_purchases") as any).insert({
    buyer_id: reservation.buyer_id,
    publication_id: reservation.publication_id,
    seller_id: reservation.seller_id,
    status: "paid",
    amount_cents: reservation.amount_cents,
    currency: reservation.currency,
    platform_fee_cents: reservation.platform_fee_cents,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    purchased_at: now,
    updated_at: now,
  });
  if (error) {
    if (error.code === "23505") {
      const concurrent = await purchaseBySession(session.id);
      if (concurrent?.id) return true;
    }
    throw new LibraryCommerceError(`Unable to fulfill Library purchase: ${error.message}`, 503, "library_purchase_fulfillment_failed");
  }
  await deleteReservation(reservation.id);
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
