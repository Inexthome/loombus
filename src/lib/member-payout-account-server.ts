import "server-only";

import Stripe from "stripe";
import { logAuditEvent } from "@/lib/audit-log";
import { createMemberPrivacyServiceClient } from "@/lib/member-privacy-server";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class MemberPayoutIdentityError extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 500,
    code = "member_payout_identity_error"
  ) {
    super(message);
    this.name = "MemberPayoutIdentityError";
    this.status = status;
    this.code = code;
  }
}

export type MemberPayoutIdentityRow = {
  member_id: string;
  stripe_account_id: string;
  account_type: string;
  country: string | null;
  default_currency: string | null;
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements_due: string[];
  created_at: string;
  updated_at: string;
};

function service() {
  const client = createMemberPrivacyServiceClient();
  if (!client) {
    throw new MemberPayoutIdentityError(
      "Shared payout identity storage is not configured.",
      503,
      "member_payout_identity_service_unavailable"
    );
  }
  return client;
}

function stripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new MemberPayoutIdentityError(
      "Stripe payout onboarding is not configured.",
      503,
      "member_payout_identity_stripe_unavailable"
    );
  }
  return new Stripe(STRIPE_SECRET_KEY);
}

function safeOrigin(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Unsupported protocol.");
    }
    return parsed.origin;
  } catch {
    return "https://loombus.com";
  }
}

function metadataMemberId(account: Stripe.Account) {
  const candidates = [
    account.metadata?.member_id,
    account.metadata?.user_id,
    account.metadata?.creator_id,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && UUID_PATTERN.test(value)) return value;
  }
  return null;
}

export async function getMemberPayoutIdentity(memberId: string) {
  if (!UUID_PATTERN.test(memberId)) return null;
  const { data, error } = await service()
    .from("member_payout_accounts")
    .select(
      "member_id, stripe_account_id, account_type, country, default_currency, details_submitted, charges_enabled, payouts_enabled, requirements_due, created_at, updated_at"
    )
    .eq("member_id", memberId)
    .maybeSingle();

  if (error) {
    throw new MemberPayoutIdentityError(
      `Unable to read shared payout identity: ${error.message}`,
      503,
      "member_payout_identity_read_failed"
    );
  }

  return (data ?? null) as MemberPayoutIdentityRow | null;
}

export async function syncMemberPayoutAccountEvent(account: Stripe.Account) {
  const client = service();
  const { data: byStripe, error: stripeLookupError } = await client
    .from("member_payout_accounts")
    .select("member_id, stripe_account_id")
    .eq("stripe_account_id", account.id)
    .maybeSingle();

  if (stripeLookupError) {
    throw new MemberPayoutIdentityError(
      `Unable to resolve Stripe payout identity: ${stripeLookupError.message}`,
      503,
      "member_payout_identity_lookup_failed"
    );
  }

  const metadataId = metadataMemberId(account);
  if (byStripe?.member_id && metadataId && byStripe.member_id !== metadataId) {
    throw new MemberPayoutIdentityError(
      "Stripe payout account metadata conflicts with the canonical Loombus member identity.",
      409,
      "member_payout_identity_metadata_conflict"
    );
  }

  const memberId = byStripe?.member_id ?? metadataId;
  if (!memberId) return false;

  const { data: byMember, error: memberLookupError } = await client
    .from("member_payout_accounts")
    .select("member_id, stripe_account_id")
    .eq("member_id", memberId)
    .maybeSingle();

  if (memberLookupError) {
    throw new MemberPayoutIdentityError(
      `Unable to verify canonical payout identity: ${memberLookupError.message}`,
      503,
      "member_payout_identity_lookup_failed"
    );
  }

  if (byMember?.stripe_account_id && byMember.stripe_account_id !== account.id) {
    throw new MemberPayoutIdentityError(
      "This Loombus member already has a different canonical Stripe payout account.",
      409,
      "member_payout_identity_account_conflict"
    );
  }

  const now = new Date().toISOString();
  const { error: upsertError } = await client
    .from("member_payout_accounts")
    .upsert(
      {
        member_id: memberId,
        stripe_account_id: account.id,
        account_type: "express",
        country: account.country ?? null,
        default_currency: account.default_currency ?? null,
        details_submitted: Boolean(account.details_submitted),
        charges_enabled: Boolean(account.charges_enabled),
        payouts_enabled: Boolean(account.payouts_enabled),
        requirements_due: account.requirements?.currently_due ?? [],
        updated_at: now,
      },
      { onConflict: "member_id" }
    );

  if (upsertError) {
    throw new MemberPayoutIdentityError(
      `Unable to synchronize shared payout identity: ${upsertError.message}`,
      503,
      "member_payout_identity_sync_failed"
    );
  }

  return true;
}

export async function refreshMemberPayoutAccount(memberId: string) {
  const existing = await getMemberPayoutIdentity(memberId);
  if (!existing) return null;

  const account = await stripe().accounts.retrieve(existing.stripe_account_id);
  if (account.deleted) {
    throw new MemberPayoutIdentityError(
      "The connected Stripe payout account is unavailable.",
      409,
      "member_payout_identity_account_deleted"
    );
  }

  await syncMemberPayoutAccountEvent(account);
  return getMemberPayoutIdentity(memberId);
}

export async function ensureMemberPayoutAccount(memberId: string) {
  if (!UUID_PATTERN.test(memberId)) {
    throw new MemberPayoutIdentityError(
      "Invalid Loombus payout identity.",
      400,
      "member_payout_identity_invalid"
    );
  }

  const existing = await getMemberPayoutIdentity(memberId);
  if (existing) {
    const refreshed = await refreshMemberPayoutAccount(memberId);
    if (!refreshed) {
      throw new MemberPayoutIdentityError(
        "The connected Stripe payout identity could not be verified.",
        503,
        "member_payout_identity_refresh_failed"
      );
    }
    return refreshed;
  }

  // The stable member-scoped idempotency key protects concurrent onboarding
  // attempts from creating two Stripe Express accounts before the canonical
  // database row is visible to both requests.
  const account = await stripe().accounts.create(
    {
      type: "express",
      capabilities: { transfers: { requested: true } },
      metadata: {
        member_id: memberId,
        loombus_identity: "member_payout",
      },
    },
    { idempotencyKey: `loombus-member-payout-v1:${memberId}` }
  );

  await syncMemberPayoutAccountEvent(account);
  const stored = await getMemberPayoutIdentity(memberId);
  if (!stored) {
    throw new MemberPayoutIdentityError(
      "Loombus could not persist the Stripe payout identity.",
      503,
      "member_payout_identity_persist_failed"
    );
  }

  await logAuditEvent({
    actor_id: memberId,
    action: "member_payout.account_created",
    target_type: "member_payout_account",
    target_id: memberId,
    metadata: { stripe_account_id: account.id, account_type: "express" },
  });

  return stored;
}

export async function createMemberPayoutOnboarding(input: {
  memberId: string;
  origin: string;
}) {
  const identity = await ensureMemberPayoutAccount(input.memberId);
  const origin = safeOrigin(input.origin);
  const link = await stripe().accountLinks.create({
    account: identity.stripe_account_id,
    refresh_url: `${origin}/appointments/professional-payout?payout=refresh`,
    return_url: `${origin}/appointments/professional-payout?payout=return`,
    type: "account_onboarding",
  });

  await logAuditEvent({
    actor_id: input.memberId,
    action: "professional_booking.payout_onboarding_started",
    target_type: "member_payout_account",
    target_id: input.memberId,
    metadata: { stripe_account_id: identity.stripe_account_id },
  });

  return { url: link.url };
}

export async function createMemberPayoutDashboardLink(memberId: string) {
  const identity = await refreshMemberPayoutAccount(memberId);
  if (!identity) {
    throw new MemberPayoutIdentityError(
      "Connect Stripe before opening the payout dashboard.",
      409,
      "member_payout_identity_setup_required"
    );
  }
  if (!identity.details_submitted) {
    throw new MemberPayoutIdentityError(
      "Complete Stripe payout onboarding before opening the payout dashboard.",
      409,
      "member_payout_identity_setup_incomplete"
    );
  }

  const link = await stripe().accounts.createLoginLink(identity.stripe_account_id);
  return { url: link.url };
}
