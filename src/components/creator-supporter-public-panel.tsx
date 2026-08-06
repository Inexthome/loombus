"use client";

import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import {
  Check,
  CreditCard,
  DoorOpen,
  HeartHandshake,
  Loader2,
  LockKeyhole,
  RotateCcw,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import "./creator-supporter-public-panel.css";

type PublicTier = {
  id: string;
  name: string;
  description: string;
  benefits: string[] | null;
  room_id: string | null;
  position: number;
  access_mode: "free" | "paid";
  price_cents: number | null;
  currency: string | null;
  billing_interval: string | null;
};

type PublicProgramPayload = {
  active: boolean;
  isOwner?: boolean;
  creator?: {
    id: string;
    fullName: string | null;
    username: string | null;
  };
  program?: {
    headline: string;
    welcomeMessage: string;
    acceptingNewSupporters: boolean;
    billingHold: boolean;
    billingHoldReason: string | null;
  };
  tiers?: PublicTier[];
  membership?: {
    id: string;
    tierId: string | null;
    joinedAt: string;
  } | null;
  subscription?: {
    id: string;
    tierId: string;
    status: string;
    billingHold: boolean;
    billingHoldReason: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    amountCents: number;
    currency: string;
    lastPaymentStatus: string | null;
  } | null;
  supporterCount?: number;
  refundRequestPending?: boolean;
  paidCheckout?: { ready: boolean; webOnly: boolean };
  error?: string;
};

function money(cents: number | null | undefined) {
  if (!cents) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function CreatorSupporterPublicPanel({ username }: { username: string }) {
  const [payload, setPayload] = useState<PublicProgramPayload | null>(null);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [native, setNative] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadProgram() {
    const token = await getToken();
    if (!token) return;
    const response = await fetch(
      `/api/creator/supporter-program/public?username=${encodeURIComponent(username)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    const result = (await response.json().catch(() => ({}))) as PublicProgramPayload;
    if (!response.ok) {
      setPayload(null);
      return;
    }
    setPayload(result);
    setSelectedTierId(
      result.subscription?.tierId ??
        result.membership?.tierId ??
        result.tiers?.[0]?.id ??
        ""
    );
  }

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    setNative(isNative);

    async function initialize() {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session_id");
      if (!isNative && sessionId?.startsWith("cs_")) {
        const token = await getToken();
        if (token) {
          setWorking(true);
          const response = await fetch(
            `/api/creator/supporter-checkout?sessionId=${encodeURIComponent(sessionId)}`,
            { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
          );
          const result = await response.json().catch(() => ({}));
          setMessage(
            response.ok
              ? "Your paid supporter subscription is active."
              : result.error ?? "Checkout could not be verified yet."
          );
          setWorking(false);
        }
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("session_id");
        cleanUrl.searchParams.delete("supporter_checkout");
        window.history.replaceState({}, "", cleanUrl);
      } else if (params.get("supporter_checkout") === "cancelled") {
        setMessage("Checkout was cancelled. No subscription was created.");
      }
      await loadProgram();
    }

    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  async function updateFreeMembership(action: "join" | "change_tier" | "leave") {
    if (!payload?.creator || working) return;
    setWorking(true);
    setMessage("");
    const token = await getToken();
    if (!token) {
      window.location.href = `/login?next=/u/${encodeURIComponent(username)}`;
      return;
    }
    const response = await fetch("/api/creator/supporter-membership", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        creatorId: payload.creator.id,
        tierId: selectedTierId,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setWorking(false);
    if (!response.ok) {
      setMessage(result.error ?? "Unable to update supporter access.");
      return;
    }
    setMessage(
      action === "leave"
        ? result.paidSubscription
          ? "Your paid subscription will end after the current billing period."
          : "You left this supporter program."
        : payload.membership
          ? "Your free supporter tier was updated."
          : "You joined this free supporter tier."
    );
    await loadProgram();
  }

  async function startPaidCheckout() {
    if (!payload?.creator || native || working) return;
    setWorking(true);
    setMessage("");
    const token = await getToken();
    if (!token) {
      window.location.href = `/login?next=/u/${encodeURIComponent(username)}`;
      return;
    }
    const response = await fetch("/api/creator/supporter-checkout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        creatorId: payload.creator.id,
        tierId: selectedTierId,
        purchaseSurface: "web",
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.checkoutUrl) {
      setWorking(false);
      setMessage(result.error ?? "Unable to start paid checkout.");
      return;
    }
    window.location.href = result.checkoutUrl;
  }

  async function subscriptionAction(action: "cancel" | "resume" | "request_refund") {
    if (!payload?.creator || working || native) return;
    if (action === "request_refund" && refundReason.trim().length < 5) {
      setMessage("Provide a short reason for the refund request.");
      return;
    }
    setWorking(true);
    setMessage("");
    const token = await getToken();
    if (!token) return;
    const response = await fetch("/api/creator/supporter-subscription", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        creatorId: payload.creator.id,
        reason: refundReason,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setWorking(false);
    if (!response.ok) {
      setMessage(result.error ?? "Unable to update the subscription.");
      return;
    }
    setMessage(
      action === "cancel"
        ? "Renewal cancelled. Access remains through the current paid period."
        : action === "resume"
          ? "Monthly renewal resumed."
          : "Refund request submitted for manual review."
    );
    if (action === "request_refund") {
      setRefundOpen(false);
      setRefundReason("");
    }
    await loadProgram();
  }

  if (!payload?.active || !payload.program || !payload.tiers?.length) return null;

  const selectedTier = payload.tiers.find((tier) => tier.id === selectedTierId);
  const isMember = Boolean(payload.membership);
  const hasPaidSubscription = Boolean(
    payload.subscription &&
      ["incomplete", "trialing", "active", "past_due", "unpaid"].includes(
        payload.subscription.status
      )
  );
  const currentTier = payload.tiers.find(
    (tier) =>
      tier.id === (payload.subscription?.tierId ?? payload.membership?.tierId)
  );
  const selectedPaid = selectedTier?.access_mode === "paid";

  return (
    <section className="creator-supporter-public-panel" aria-label="Creator supporter program">
      <header>
        <div>
          <p>Creator Supporters</p>
          <h2>{payload.program.headline}</h2>
          {payload.program.welcomeMessage ? (
            <span>{payload.program.welcomeMessage}</span>
          ) : null}
        </div>
        <div className="creator-supporter-public-count">
          <Users aria-hidden="true" />
          <strong>{payload.supporterCount ?? 0}</strong>
          <span>supporters</span>
        </div>
      </header>

      {payload.isOwner ? (
        <div className="creator-supporter-public-owner">
          <HeartHandshake aria-hidden="true" />
          <span>This is your supporter program.</span>
          <Link href="/profile?section=creator">Manage program</Link>
        </div>
      ) : (
        <>
          <div className="creator-supporter-public-tiers">
            {payload.tiers.map((tier) => {
              const selected = selectedTierId === tier.id;
              const current = currentTier?.id === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  className={selected ? "is-selected" : ""}
                  aria-pressed={selected}
                  onClick={() => setSelectedTierId(tier.id)}
                >
                  <span className="creator-supporter-public-tier-check">
                    {selected ? <Check aria-hidden="true" /> : null}
                  </span>
                  <strong>{tier.name}</strong>
                  <span className="creator-supporter-public-price">
                    {tier.access_mode === "paid"
                      ? `${money(tier.price_cents)}/month`
                      : "Free"}
                  </span>
                  {current ? <small className="is-current">Current tier</small> : null}
                  <p>{tier.description}</p>
                  {tier.benefits?.length ? (
                    <ul>
                      {tier.benefits.map((benefit) => (
                        <li key={benefit}>
                          <Check aria-hidden="true" /> {benefit}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {tier.room_id ? (
                    <small className="creator-supporter-public-room">
                      <LockKeyhole aria-hidden="true" /> Includes private Room access
                    </small>
                  ) : null}
                </button>
              );
            })}
          </div>

          {payload.program.billingHold ? (
            <p className="creator-supporter-public-alert">
              New subscriptions are paused while this creator program is reviewed.
            </p>
          ) : null}

          <div className="creator-supporter-public-actions">
            {selectedPaid ? (
              hasPaidSubscription ? (
                <button type="button" className="is-primary" disabled>
                  <CreditCard aria-hidden="true" />
                  Joined · {currentTier?.name ?? "Paid supporter"}
                </button>
              ) : native ? (
                <button type="button" className="is-primary" disabled>
                  <CreditCard aria-hidden="true" /> Paid signup available on Loombus web
                </button>
              ) : (
                <button
                  type="button"
                  className="is-primary"
                  disabled={
                    working ||
                    !payload.paidCheckout?.ready ||
                    !payload.program.acceptingNewSupporters
                  }
                  onClick={() => void startPaidCheckout()}
                >
                  {working ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <CreditCard aria-hidden="true" />
                  )}
                  Subscribe for {money(selectedTier?.price_cents)}/month
                </button>
              )
            ) : (
              <button
                type="button"
                className="is-primary"
                disabled={
                  working ||
                  !selectedTierId ||
                  hasPaidSubscription ||
                  payload.membership?.tierId === selectedTierId
                }
                onClick={() =>
                  void updateFreeMembership(isMember ? "change_tier" : "join")
                }
              >
                {working ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <HeartHandshake aria-hidden="true" />
                )}
                {payload.membership?.tierId === selectedTierId
                  ? `Joined · ${currentTier?.name ?? "Supporter"}`
                  : isMember
                    ? "Change free tier"
                    : "Join free supporter tier"}
              </button>
            )}

            {isMember && !hasPaidSubscription ? (
              <button
                type="button"
                className="is-secondary"
                disabled={working}
                onClick={() => void updateFreeMembership("leave")}
              >
                <DoorOpen aria-hidden="true" /> Leave program
              </button>
            ) : null}
          </div>

          {hasPaidSubscription ? (
            <div className="creator-supporter-public-subscription">
              <div>
                <CreditCard aria-hidden="true" />
                <span>
                  <strong>{money(payload.subscription?.amountCents)}/month</strong>
                  <small>
                    Status: {payload.subscription?.status}
                    {payload.subscription?.currentPeriodEnd
                      ? ` · current period ends ${new Date(
                          payload.subscription.currentPeriodEnd
                        ).toLocaleDateString()}`
                      : ""}
                  </small>
                </span>
              </div>
              {native ? (
                <p>Billing changes are managed on the Loombus web experience.</p>
              ) : (
                <div>
                  {payload.subscription?.cancelAtPeriodEnd ? (
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => void subscriptionAction("resume")}
                    >
                      <RotateCcw aria-hidden="true" /> Resume renewal
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => void subscriptionAction("cancel")}
                    >
                      <DoorOpen aria-hidden="true" /> Cancel renewal
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={working || payload.refundRequestPending}
                    onClick={() => setRefundOpen((current) => !current)}
                  >
                    Request refund review
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {refundOpen && !native ? (
            <div className="creator-supporter-public-refund">
              <label>
                <span>Refund review reason</span>
                <textarea
                  value={refundReason}
                  onChange={(event) => setRefundReason(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Explain why you are requesting a refund review."
                />
              </label>
              <button
                type="button"
                disabled={working || refundReason.trim().length < 5}
                onClick={() => void subscriptionAction("request_refund")}
              >
                Submit refund request
              </button>
            </div>
          ) : null}
        </>
      )}

      <p className="creator-supporter-public-boundary">
        Free tiers do not charge you. Paid tiers renew monthly until cancelled. Paid signup is web-only in this release, and refund requests require manual review.
      </p>
      {message ? (
        <p className="creator-supporter-public-message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
