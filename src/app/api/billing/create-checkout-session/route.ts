import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getBillingSupabaseAdmin } from "@/lib/billing-entitlements";
import {
  getResolvedGeneralSubscriptionForUser,
  isGeneralSubscriptionActive,
} from "@/lib/general-subscriptions";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const MEMBERSHIP_CHECKOUT_RESERVATION_MS = 60 * 60 * 1000;

const CHECKOUT_PLANS = {
  premium_monthly: {
    label: "Loombus Premium Monthly",
    tier: "premium",
    interval: "monthly",
    mode: "subscription",
    priceEnvVar: "STRIPE_PREMIUM_MONTHLY_PRICE_ID",
    fallbackPriceEnvVar: "STRIPE_PREMIUM_PRICE_ID",
  },
  premium_annual: {
    label: "Loombus Premium Annual",
    tier: "premium",
    interval: "annual",
    mode: "subscription",
    priceEnvVar: "STRIPE_PREMIUM_ANNUAL_PRICE_ID",
  },
  premium_plus_monthly: {
    // Keep the legacy key and Stripe env var; only the public product name is
    // changing during this rollout.
    label: "Loombus Premium Pro Monthly",
    tier: "premium_plus",
    interval: "monthly",
    mode: "subscription",
    priceEnvVar: "STRIPE_PREMIUM_PLUS_MONTHLY_PRICE_ID",
  },
  premium_plus_annual: {
    label: "Loombus Premium Pro Annual",
    tier: "premium_plus",
    interval: "annual",
    mode: "subscription",
    priceEnvVar: "STRIPE_PREMIUM_PLUS_ANNUAL_PRICE_ID",
  },
  extra_ai_pack: {
    label: "Loombus Extra AI Pack",
    tier: "add_on",
    interval: "one_time",
    mode: "payment",
    priceEnvVar: "STRIPE_EXTRA_AI_PACK_PRICE_ID",
    credits: 25,
  },
  floor_monthly: {
    label: "The Floor Monthly",
    tier: "floor",
    interval: "monthly",
    mode: "subscription",
    priceEnvVar: "STRIPE_FLOOR_MONTHLY_PRICE_ID",
  },
  floor_annual: {
    label: "The Floor Annual",
    tier: "floor",
    interval: "annual",
    mode: "subscription",
    priceEnvVar: "STRIPE_FLOOR_ANNUAL_PRICE_ID",
  },
} as const;

type CheckoutPlanKey = keyof typeof CHECKOUT_PLANS;
type MembershipCheckoutReservation = {
  user_id: string;
  reservation_id: string;
  plan_key: string;
  stripe_checkout_session_id: string | null;
  expires_at: string;
};

function isCheckoutPlanKey(value: string): value is CheckoutPlanKey {
  return value in CHECKOUT_PLANS;
}

const MEMBERSHIP_CHECKOUT_PLAN_KEYS = new Set<CheckoutPlanKey>([
  "premium_monthly",
  "premium_annual",
  "premium_plus_monthly",
  "premium_plus_annual",
]);

function isMembershipCheckoutPlanKey(planKey: CheckoutPlanKey) {
  return MEMBERSHIP_CHECKOUT_PLAN_KEYS.has(planKey);
}

function membershipCheckoutLiveAllowed() {
  return process.env.LOOMBUS_MEMBERSHIP_CHECKOUT_ALLOW_LIVE === "true";
}

function stripeKeyLooksLive() {
  return /^(sk|rk)_live_/.test(STRIPE_SECRET_KEY ?? "");
}

function getPriceId(planKey: CheckoutPlanKey) {
  const plan = CHECKOUT_PLANS[planKey];
  const primaryPriceId = process.env[plan.priceEnvVar];

  if (primaryPriceId) {
    return primaryPriceId;
  }

  if ("fallbackPriceEnvVar" in plan && plan.fallbackPriceEnvVar) {
    return process.env[plan.fallbackPriceEnvVar];
  }

  return undefined;
}

async function getMembershipCheckoutState(userId: string) {
  const resolved = await getResolvedGeneralSubscriptionForUser(userId);
  const providerSubscriptions = resolved.subscriptions.filter(
    (subscription) =>
      subscription.provider === "stripe" || subscription.provider === "apple"
  );
  const activeProviderSubscriptions = providerSubscriptions.filter(
    isGeneralSubscriptionActive
  );
  const existingStripeCustomerId = providerSubscriptions.find(
    (subscription) =>
      subscription.provider === "stripe" && subscription.provider_customer_id
  )?.provider_customer_id;

  return {
    activeProviderSubscriptions,
    existingStripeCustomerId: existingStripeCustomerId ?? null,
    isAdminOverride: resolved.isAdminOverride,
  };
}

function reservationExpired(reservation: MembershipCheckoutReservation) {
  const expiresAt = new Date(reservation.expires_at).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

async function loadMembershipCheckoutReservation(userId: string) {
  const admin = getBillingSupabaseAdmin();
  const { data, error } = await (
    admin.from("membership_checkout_reservations") as any
  )
    .select(
      "user_id,reservation_id,plan_key,stripe_checkout_session_id,expires_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to verify membership checkout reservation: ${error.message}`);
  }

  return (data ?? null) as MembershipCheckoutReservation | null;
}

async function deleteMembershipCheckoutReservation(
  userId: string,
  reservationId: string
) {
  const admin = getBillingSupabaseAdmin();
  const { error } = await (
    admin.from("membership_checkout_reservations") as any
  )
    .delete()
    .eq("user_id", userId)
    .eq("reservation_id", reservationId);

  if (error) {
    throw new Error(`Unable to clear membership checkout reservation: ${error.message}`);
  }
}

async function reserveMembershipCheckout(
  userId: string,
  planKey: CheckoutPlanKey
): Promise<MembershipCheckoutReservation> {
  const existing = await loadMembershipCheckoutReservation(userId);
  if (existing && !reservationExpired(existing)) return existing;

  if (existing) {
    await deleteMembershipCheckoutReservation(userId, existing.reservation_id);
  }

  const admin = getBillingSupabaseAdmin();
  const expiresAt = new Date(
    Date.now() + MEMBERSHIP_CHECKOUT_RESERVATION_MS
  ).toISOString();
  const { data, error } = await (
    admin.from("membership_checkout_reservations") as any
  )
    .insert({
      user_id: userId,
      plan_key: planKey,
      expires_at: expiresAt,
    })
    .select(
      "user_id,reservation_id,plan_key,stripe_checkout_session_id,expires_at"
    )
    .single();

  if (!error && data) return data as MembershipCheckoutReservation;

  if (error?.code === "23505") {
    const winner = await loadMembershipCheckoutReservation(userId);
    if (winner && !reservationExpired(winner)) return winner;
  }

  throw new Error(
    `Unable to reserve membership checkout: ${error?.message ?? "reservation unavailable"}`
  );
}

async function persistMembershipCheckoutSession(
  reservation: MembershipCheckoutReservation,
  sessionId: string
) {
  const admin = getBillingSupabaseAdmin();
  const { error } = await (
    admin.from("membership_checkout_reservations") as any
  )
    .update({
      stripe_checkout_session_id: sessionId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", reservation.user_id)
    .eq("reservation_id", reservation.reservation_id);

  if (error) {
    throw new Error(`Unable to persist membership checkout session: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
      planKey?: string;
    };

    const requestedPlanKey = body.planKey ?? "premium_monthly";

    if (!isCheckoutPlanKey(requestedPlanKey)) {
      return NextResponse.json(
        {
          error: "Invalid subscription plan selected.",
          code: "invalid_subscription_plan",
        },
        { status: 400 }
      );
    }

    const selectedPlan = CHECKOUT_PLANS[requestedPlanKey];
    const selectedPriceId = getPriceId(requestedPlanKey);

    if (!STRIPE_SECRET_KEY || !selectedPriceId) {
      return NextResponse.json(
        {
          error:
            "Checkout is not configured yet. Stripe keys and the selected plan price ID are required.",
          code: "stripe_not_configured",
          detail: `Missing Stripe configuration for ${selectedPlan.label}.`,
        },
        { status: 503 }
      );
    }

    let existingStripeCustomerId: string | null = null;
    if (isMembershipCheckoutPlanKey(requestedPlanKey)) {
      const membershipState = await getMembershipCheckoutState(user.id);
      existingStripeCustomerId = membershipState.existingStripeCustomerId;

      if (membershipState.isAdminOverride) {
        return NextResponse.json(
          {
            error:
              "Admin access already includes Loombus Premium Pro capabilities. A paid membership is not required for this account.",
            code: "membership_checkout_admin_not_required",
          },
          { status: 409 }
        );
      }

      if (membershipState.activeProviderSubscriptions.length > 0) {
        const providers = Array.from(
          new Set(
            membershipState.activeProviderSubscriptions.map(
              (subscription) => subscription.provider
            )
          )
        );
        const providerLabel = providers.includes("apple")
          ? providers.includes("stripe")
            ? "Apple or Stripe"
            : "Apple"
          : "Stripe";

        return NextResponse.json(
          {
            error:
              `You already have an active Loombus membership billed through ${providerLabel}. Manage your existing membership to change plan or billing interval.`,
            code: "membership_subscription_already_active",
            providers,
          },
          { status: 409 }
        );
      }
    }

    if (
      isMembershipCheckoutPlanKey(requestedPlanKey) &&
      stripeKeyLooksLive() &&
      !membershipCheckoutLiveAllowed()
    ) {
      return NextResponse.json(
        {
          error: "Live Loombus membership checkout is not enabled.",
          code: "membership_checkout_live_disabled",
        },
        { status: 503 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "https://loombus.com";

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    let membershipReservation: MembershipCheckoutReservation | null = null;

    if (isMembershipCheckoutPlanKey(requestedPlanKey)) {
      membershipReservation = await reserveMembershipCheckout(
        user.id,
        requestedPlanKey
      );

      if (membershipReservation.plan_key !== requestedPlanKey) {
        return NextResponse.json(
          {
            error:
              "A different Loombus membership checkout is already in progress. Finish that checkout or try this plan again after the current checkout expires.",
            code: "membership_checkout_already_in_progress",
          },
          { status: 409 }
        );
      }

      if (membershipReservation.stripe_checkout_session_id) {
        const existingSession = await stripe.checkout.sessions.retrieve(
          membershipReservation.stripe_checkout_session_id
        );

        if (existingSession.status === "open" && existingSession.url) {
          return NextResponse.json({ url: existingSession.url });
        }

        if (existingSession.status === "complete") {
          return NextResponse.json(
            {
              error:
                "Your membership checkout already completed and is being finalized. No second checkout was started.",
              code: "membership_checkout_already_completed",
            },
            { status: 409 }
          );
        }

        await deleteMembershipCheckoutReservation(
          user.id,
          membershipReservation.reservation_id
        );
        membershipReservation = await reserveMembershipCheckout(
          user.id,
          requestedPlanKey
        );
      }
    }

    const metadata = {
      user_id: user.id,
      product: requestedPlanKey.startsWith("floor_")
        ? "loombus_floor"
        : requestedPlanKey === "extra_ai_pack"
          ? "loombus_extra_ai_pack"
          : "loombus_premium_ai",
      plan_key: requestedPlanKey,
      plan_label: selectedPlan.label,
      tier: selectedPlan.tier,
      billing_interval: selectedPlan.interval,
      credits:
        "credits" in selectedPlan ? String(selectedPlan.credits) : "",
    };

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      mode: selectedPlan.mode,
      payment_method_types: ["card"],
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      success_url: requestedPlanKey.startsWith("floor_")
        ? `${origin}/the-floor/subscribe?checkout=success&plan=${requestedPlanKey}&session_id={CHECKOUT_SESSION_ID}`
        : `${origin}/premium?checkout=success&plan=${requestedPlanKey}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: requestedPlanKey.startsWith("floor_")
        ? `${origin}/the-floor/subscribe?checkout=cancelled&plan=${requestedPlanKey}`
        : `${origin}/premium?checkout=cancelled&plan=${requestedPlanKey}`,
      client_reference_id: user.id,
      ...(existingStripeCustomerId
        ? { customer: existingStripeCustomerId }
        : { customer_email: user.email ?? undefined }),
      metadata,
      ...(selectedPlan.mode === "subscription"
        ? {
            subscription_data: {
              metadata,
              ...(requestedPlanKey.startsWith("floor_")
                ? { trial_period_days: 7 }
                : {}),
            },
          }
        : {}),
      ...(membershipReservation
        ? {
            expires_at: Math.floor(
              new Date(membershipReservation.expires_at).getTime() / 1000
            ),
          }
        : {}),
    };

    const session = await stripe.checkout.sessions.create(
      checkoutParams,
      membershipReservation
        ? {
            idempotencyKey: `loombus-membership-${membershipReservation.reservation_id}`,
          }
        : undefined
    );

    if (membershipReservation) {
      await persistMembershipCheckoutSession(membershipReservation, session.id);
    }

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown checkout error";

    const stripeError =
      error && typeof error === "object" && "type" in error
        ? String((error as { type?: unknown }).type ?? "")
        : "";

    const stripeCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    let safeDetail = "Check Stripe checkout configuration in Vercel and Stripe.";

    if (stripeError === "StripeAuthenticationError") {
      safeDetail = "Stripe rejected the secret key. Check STRIPE_SECRET_KEY in Vercel.";
    } else if (
      stripeError === "StripeInvalidRequestError" &&
      message.toLowerCase().includes("no such price")
    ) {
      safeDetail =
        "Stripe could not find the selected plan price. Check the selected Stripe Price ID and make sure it is from the same Stripe mode as the secret key.";
    } else if (
      stripeError === "StripeInvalidRequestError" &&
      message.toLowerCase().includes("recurring")
    ) {
      safeDetail =
        "The selected Stripe price has the wrong billing mode. Subscription plans require recurring prices, and Extra AI Pack requires a one-time price.";
    } else if (stripeCode) {
      safeDetail = `Stripe checkout failed with code: ${stripeCode}. Check the Stripe price and key configuration.`;
    }

    console.error("Stripe checkout session creation failed:", {
      type: stripeError || "unknown",
      code: stripeCode || "unknown",
      message,
    });

    return NextResponse.json(
      {
        error: "Unable to start Premium checkout.",
        detail: safeDetail,
      },
      { status: 500 }
    );
  }
}
