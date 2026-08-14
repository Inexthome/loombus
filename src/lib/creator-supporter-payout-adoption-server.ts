import "server-only";

import type Stripe from "stripe";
import {
  CreatorSupporterBillingError,
  refreshCreatorPayoutAccount,
} from "@/lib/creator-supporter-billing";
import {
  ensureMemberPayoutAccount,
  getMemberPayoutIdentity,
  MemberPayoutIdentityError,
} from "@/lib/member-payout-account-server";
import { createMemberPrivacyServiceClient } from "@/lib/member-privacy-server";

const CREATOR_SUPPORTER_TERMS_VERSION = "creator-supporters-2026-08";

function service() {
  const client = createMemberPrivacyServiceClient();
  if (!client) {
    throw new CreatorSupporterBillingError(
      "Creator supporter billing is not configured.",
      503,
      "creator_supporter_service_unavailable"
    );
  }
  return client;
}

function payoutIdentityError(error: unknown): never {
  if (error instanceof MemberPayoutIdentityError) {
    throw new CreatorSupporterBillingError(error.message, error.status, error.code);
  }
  throw error;
}

export async function prepareCreatorSupporterPayoutIdentity(input: {
  creatorId: string;
  acceptedIp: string | null;
}) {
  const client = service();
  const { data: existing, error: existingError } = await client
    .from("creator_payout_accounts")
    .select("creator_id, stripe_account_id")
    .eq("creator_id", input.creatorId)
    .maybeSingle();

  if (existingError) {
    throw new CreatorSupporterBillingError(
      `Unable to verify creator payout identity: ${existingError.message}`,
      503,
      "creator_payout_storage_failed"
    );
  }

  // If a legacy Creator Supporter identity exists, refresh it first. The
  // 3B.8C mirror trigger adopts that exact Stripe account into the canonical
  // table if a partial historical state left the canonical row missing.
  // This prevents creating a replacement account before noticing legacy state.
  if (existing?.stripe_account_id) {
    await refreshCreatorPayoutAccount(input.creatorId);
  }

  let canonical: Awaited<ReturnType<typeof ensureMemberPayoutAccount>>;
  try {
    canonical = await ensureMemberPayoutAccount(input.creatorId);
  } catch (error) {
    payoutIdentityError(error);
  }

  if (existing?.stripe_account_id && existing.stripe_account_id !== canonical.stripe_account_id) {
    throw new CreatorSupporterBillingError(
      "Creator Supporters and the canonical Loombus payout identity disagree. No new Stripe account was created.",
      409,
      "creator_payout_canonical_conflict"
    );
  }

  const terms = {
    platform_terms_version: CREATOR_SUPPORTER_TERMS_VERSION,
    platform_terms_accepted_at: new Date().toISOString(),
    platform_terms_ip: input.acceptedIp,
  };

  if (!existing) {
    const { error } = await client.from("creator_payout_accounts").insert({
      creator_id: input.creatorId,
      stripe_account_id: canonical.stripe_account_id,
      account_type: "express",
      country: canonical.country,
      default_currency: canonical.default_currency,
      details_submitted: canonical.details_submitted,
      charges_enabled: canonical.charges_enabled,
      payouts_enabled: canonical.payouts_enabled,
      requirements_due: canonical.requirements_due,
      ...terms,
    });

    if (error) {
      throw new CreatorSupporterBillingError(
        `Unable to adopt the shared payout identity for Creator Supporters: ${error.message}`,
        503,
        "creator_payout_adoption_failed"
      );
    }
  } else {
    const { error } = await client
      .from("creator_payout_accounts")
      .update(terms)
      .eq("creator_id", input.creatorId)
      .eq("stripe_account_id", canonical.stripe_account_id);

    if (error) {
      throw new CreatorSupporterBillingError(
        `Unable to record Creator Supporter payout terms: ${error.message}`,
        503,
        "creator_payout_terms_failed"
      );
    }
  }

  return canonical;
}

export async function syncAdoptedCreatorPayoutAccountEvent(account: Stripe.Account) {
  const client = service();
  const { data: local, error } = await client
    .from("creator_payout_accounts")
    .select("creator_id, stripe_account_id")
    .eq("stripe_account_id", account.id)
    .maybeSingle();

  if (error) {
    throw new CreatorSupporterBillingError(
      `Unable to resolve adopted Creator Supporter payout identity: ${error.message}`,
      503,
      "creator_payout_storage_failed"
    );
  }
  if (!local) return false;

  let canonical: Awaited<ReturnType<typeof getMemberPayoutIdentity>>;
  try {
    canonical = await getMemberPayoutIdentity(local.creator_id);
  } catch (identityError) {
    payoutIdentityError(identityError);
  }

  if (!canonical || canonical.stripe_account_id !== account.id) {
    throw new CreatorSupporterBillingError(
      "The adopted Creator Supporter payout identity conflicts with the canonical Loombus payout account.",
      409,
      "creator_payout_canonical_conflict"
    );
  }

  const { error: updateError } = await client
    .from("creator_payout_accounts")
    .update({
      account_type: "express",
      country: account.country ?? null,
      default_currency: account.default_currency ?? null,
      details_submitted: Boolean(account.details_submitted),
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      requirements_due: account.requirements?.currently_due ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("creator_id", local.creator_id)
    .eq("stripe_account_id", account.id);

  if (updateError) {
    throw new CreatorSupporterBillingError(
      `Unable to synchronize adopted Creator Supporter payout status: ${updateError.message}`,
      503,
      "creator_payout_storage_failed"
    );
  }

  return true;
}
