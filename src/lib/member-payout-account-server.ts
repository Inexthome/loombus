import "server-only";

import type Stripe from "stripe";
import { createMemberPrivacyServiceClient } from "@/lib/member-privacy-server";

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

type MemberPayoutIdentityRow = {
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
