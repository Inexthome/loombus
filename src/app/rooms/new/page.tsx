"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  CreditCard,
  LifeBuoy,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  RoomModelCard,
  RoomWorkspaceBlueprint,
  RoomsSectionHeading,
} from "../rooms-v2-components";
import {
  type RoomModel,
  type RoomModelId,
  type RoomPlanId,
  ROOM_MODELS,
  ROOM_PLANS,
  buildRoomSetupSummary,
  getRoomModel,
  getRoomPlan,
} from "../rooms-v2-model";

const ROOM_BUILDER_DRAFT_KEY = "loombus:room-builder-draft-v2";

type RoomBuilderDraft = {
  modelId: RoomModelId;
  planId: RoomPlanId;
  roomName: string;
  description: string;
};

type CheckoutConfig = {
  coreReady: boolean;
  monthlyOnly: boolean;
  plans: Partial<Record<RoomPlanId, boolean>>;
  checks: {
    stripeSecretKey: boolean;
    stripeWebhookSecret: boolean;
    siteUrl: boolean;
    supabaseServiceRole: boolean;
  };
};

type ProvisionResponse = {
  roomId?: string;
  checkoutUrl?: string;
  error?: string;
  code?: string;
};

const DEFAULT_DRAFT: RoomBuilderDraft = {
  modelId: "business-team",
  planId: "free",
  roomName: "Business Team",
  description: ROOM_MODELS[0].description,
};

function isRoomModelId(value: unknown): value is RoomModelId {
  return typeof value === "string" && ROOM_MODELS.some((model) => model.id === value);
}

function isRoomPlanId(value: unknown): value is RoomPlanId {
  return typeof value === "string" && ROOM_PLANS.some((plan) => plan.id === value);
}

export default function NewRoomPage() {
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<RoomBuilderDraft>(DEFAULT_DRAFT);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutConfig | null>(null);
  const [checkingCheckout, setCheckingCheckout] = useState(true);
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ROOM_BUILDER_DRAFT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<RoomBuilderDraft>;
        if (
          isRoomModelId(parsed.modelId) &&
          isRoomPlanId(parsed.planId) &&
          typeof parsed.roomName === "string" &&
          typeof parsed.description === "string"
        ) {
          setDraft({
            modelId: parsed.modelId,
            planId: parsed.planId,
            roomName: parsed.roomName,
            description: parsed.description,
          });
        }
      }
    } catch {
      window.localStorage.removeItem(ROOM_BUILDER_DRAFT_KEY);
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    window.localStorage.setItem(ROOM_BUILDER_DRAFT_KEY, JSON.stringify(draft));
  }, [draft, draftLoaded]);

  useEffect(() => {
    if (searchParams.get("checkout") === "cancelled") {
      setStatusMessage("Room checkout was canceled. Your setup is still saved on this device.");
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadCheckoutConfig() {
      setCheckingCheckout(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        if (!cancelled) setCheckingCheckout(false);
        return;
      }

      try {
        const response = await fetch("/api/rooms/checkout-config", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const result = (await response.json().catch(() => ({}))) as CheckoutConfig;
        if (!cancelled && response.ok) setCheckoutConfig(result);
      } finally {
        if (!cancelled) setCheckingCheckout(false);
      }
    }

    void loadCheckoutConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedModel = useMemo(() => getRoomModel(draft.modelId), [draft.modelId]);
  const selectedPlan = useMemo(() => getRoomPlan(draft.planId), [draft.planId]);
  const trimmedName = draft.roomName.trim();
  const trimmedDescription = draft.description.trim();
  const nameIsValid = trimmedName.length >= 3;
  const descriptionIsValid = trimmedDescription.length >= 10;
  const formIsValid = nameIsValid && descriptionIsValid;
  const paidPlanReady =
    !selectedPlan.paid ||
    Boolean(checkoutConfig?.coreReady && checkoutConfig.plans[selectedPlan.id]);

  function selectRoomModel(model: RoomModel) {
    setDraft((current) => ({
      ...current,
      modelId: model.id,
      roomName: model.shortTitle,
      description: model.description,
    }));
    setShowErrors(false);
    setStatusMessage("");
  }

  function continueToReview() {
    if (!formIsValid) {
      setShowErrors(true);
      setStatusMessage("Complete the Room name and purpose before reviewing the setup.");
      return;
    }

    setShowErrors(false);
    setStatusMessage("");
    setIsReviewing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function copySetupSummary() {
    const summary = buildRoomSetupSummary({
      model: selectedModel,
      plan: selectedPlan,
      roomName: trimmedName,
      description: trimmedDescription,
    });

    try {
      await navigator.clipboard.writeText(summary);
      setStatusMessage("Room setup summary copied.");
    } catch {
      setStatusMessage("The setup summary could not be copied on this device.");
    }
  }

  function clearDraft() {
    const confirmed = window.confirm("Clear this Room setup draft and start again?");
    if (!confirmed) return;

    setDraft(DEFAULT_DRAFT);
    setIsReviewing(false);
    setShowErrors(false);
    setStatusMessage("Room setup draft cleared.");
    window.localStorage.removeItem(ROOM_BUILDER_DRAFT_KEY);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function provisionRoom() {
    if (provisioning || !formIsValid) return;

    if (selectedPlan.paid && !paidPlanReady) {
      setStatusMessage(
        "This monthly Room plan is missing one or more Stripe or server settings. Review the Vercel environment configuration before checkout."
      );
      return;
    }

    setProvisioning(true);
    setStatusMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = `/login?next=${encodeURIComponent("/rooms/new")}`;
        return;
      }

      const response = await fetch("/api/rooms/provision", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelId: draft.modelId,
          planId: draft.planId,
          roomName: trimmedName,
          description: trimmedDescription,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as ProvisionResponse;

      if (!response.ok) {
        setStatusMessage(result.error ?? "Loombus could not create this Room.");
        return;
      }

      window.localStorage.removeItem(ROOM_BUILDER_DRAFT_KEY);

      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      if (result.roomId) {
        window.location.assign(`/rooms/${encodeURIComponent(result.roomId)}?created=1`);
        return;
      }

      setStatusMessage("Room provisioning completed without a destination.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Loombus could not create this Room."
      );
    } finally {
      setProvisioning(false);
    }
  }

  if (isReviewing) {
    return (
      <main className="rooms-v2-page rooms-v2-builder-page">
        <div className="rooms-v2-shell rooms-v2-review-shell">
          <div className="rooms-v2-builder-topbar">
            <button
              type="button"
              onClick={() => setIsReviewing(false)}
              className="rooms-v2-back-button"
              disabled={provisioning}
            >
              <ArrowLeft aria-hidden="true" size={16} />
              Edit Room setup
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="rooms-v2-clear-button"
              disabled={provisioning}
            >
              <RotateCcw aria-hidden="true" size={15} />
              Clear draft
            </button>
          </div>

          <section className="rooms-v2-builder-hero rooms-v2-review-hero">
            <div>
              <p className="rooms-v2-eyebrow">Review Room setup</p>
              <h1>Confirm the private workspace before creation.</h1>
              <p>
                Free Rooms are created immediately. Paid monthly plans open Stripe Checkout,
                and the Room is provisioned only after Stripe confirms an active subscription.
              </p>
            </div>
            <span className="rooms-v2-draft-badge">
              <Lock aria-hidden="true" size={15} />
              Private by default
            </span>
          </section>

          <section className="rooms-v2-review-grid">
            <article className="rooms-v2-review-identity">
              <p className="rooms-v2-eyebrow">Room identity</p>
              <h2>{trimmedName}</h2>
              <p>{trimmedDescription}</p>
              <div className="rooms-v2-review-tags">
                <span>{selectedModel.title}</span>
                <span>{selectedPlan.name}</span>
                <span>{selectedPlan.members}</span>
              </div>
            </article>

            <article className="rooms-v2-review-card">
              <p className="rooms-v2-eyebrow">Monthly plan</p>
              <div className="rooms-v2-plan-heading">
                <div>
                  <h2>{selectedPlan.name}</h2>
                  <p>{selectedPlan.detail}</p>
                </div>
                <strong>{selectedPlan.price}</strong>
              </div>
              <p className="rooms-v2-plan-boundary">
                {selectedPlan.paid
                  ? paidPlanReady
                    ? "Monthly Stripe checkout is configured for this plan. Annual Room billing is not offered yet."
                    : "This plan is missing required Stripe or server configuration."
                  : "No payment is required. The private Room opens after creation."}
              </p>
            </article>
          </section>

          <section className="rooms-v2-section rooms-v2-review-blueprint">
            <RoomsSectionHeading
              eyebrow="Workspace blueprint"
              title="The private Room opens with five connected operating surfaces."
              description="Discussions, announcements, calendar, resources, and members remain inside the verified Room boundary."
            />
            <RoomWorkspaceBlueprint />
          </section>

          <section className="rooms-v2-boundary-review">
            <div>
              <span><ShieldCheck aria-hidden="true" size={22} /></span>
              <div>
                <p className="rooms-v2-eyebrow">Provisioning boundary</p>
                <h2>{selectedPlan.paid ? "Payment must complete before the paid Room exists." : "The free Room will be created now."}</h2>
              </div>
            </div>
            <div className="rooms-v2-boundary-review-list">
              <p><CheckCircle2 aria-hidden="true" size={16} />Private Room record and owner membership</p>
              <p><CheckCircle2 aria-hidden="true" size={16} />No public Discussions publishing</p>
              <p><CheckCircle2 aria-hidden="true" size={16} />Server-verified ownership and billing metadata</p>
              <p><CheckCircle2 aria-hidden="true" size={16} />Monthly billing only in this release</p>
            </div>
          </section>

          <div className="rooms-v2-review-actions">
            <button
              type="button"
              onClick={() => void provisionRoom()}
              disabled={provisioning || (selectedPlan.paid && (!paidPlanReady || checkingCheckout))}
              className="rooms-v2-button rooms-v2-button-primary"
            >
              {provisioning ? (
                <Loader2 aria-hidden="true" size={16} className="is-spinning" />
              ) : selectedPlan.paid ? (
                <CreditCard aria-hidden="true" size={16} />
              ) : (
                <CheckCircle2 aria-hidden="true" size={16} />
              )}
              {provisioning
                ? "Preparing Room…"
                : selectedPlan.paid
                  ? "Continue to monthly checkout"
                  : "Create free Room"}
            </button>
            <button
              type="button"
              onClick={copySetupSummary}
              className="rooms-v2-button rooms-v2-button-quiet"
              disabled={provisioning}
            >
              <Clipboard aria-hidden="true" size={16} />
              Copy setup summary
            </button>
            <Link href="/support" className="rooms-v2-button rooms-v2-button-quiet">
              <LifeBuoy aria-hidden="true" size={16} />
              Contact support
            </Link>
          </div>
          {statusMessage ? <p className="rooms-v2-status-message" role="status">{statusMessage}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="rooms-v2-page rooms-v2-builder-page">
      <div className="rooms-v2-shell">
        <div className="rooms-v2-builder-topbar">
          <Link href="/rooms" className="rooms-v2-back-button">
            <ArrowLeft aria-hidden="true" size={16} />
            Back to Rooms
          </Link>
          <button type="button" onClick={clearDraft} className="rooms-v2-clear-button">
            <RotateCcw aria-hidden="true" size={15} />
            Clear draft
          </button>
        </div>

        <section className="rooms-v2-builder-hero">
          <div>
            <p className="rooms-v2-eyebrow">Create a private Room</p>
            <h1>Choose the group model, monthly plan, and private identity.</h1>
            <p>
              Your setup draft stays on this device until you create the Room. Free opens
              immediately. Paid monthly plans continue through Stripe Checkout.
            </p>
          </div>
          <span className="rooms-v2-draft-badge">
            <Lock aria-hidden="true" size={15} />
            Device-saved draft
          </span>
        </section>

        <section className="rooms-v2-builder-grid">
          <div className="rooms-v2-builder-main">
            <section className="rooms-v2-builder-step">
              <div className="rooms-v2-step-heading">
                <span>01</span>
                <div>
                  <p className="rooms-v2-eyebrow">Room model</p>
                  <h2>What kind of group will use this Room?</h2>
                </div>
              </div>
              <div className="rooms-v2-model-grid rooms-v2-builder-model-grid">
                {ROOM_MODELS.map((model) => (
                  <RoomModelCard
                    key={model.id}
                    model={model}
                    selected={model.id === draft.modelId}
                    onSelect={selectRoomModel}
                  />
                ))}
              </div>
            </section>

            <section className="rooms-v2-builder-step">
              <div className="rooms-v2-step-heading">
                <span>02</span>
                <div>
                  <p className="rooms-v2-eyebrow">Monthly plan</p>
                  <h2>Choose the Room size and operating scope.</h2>
                  <p>Annual Room subscriptions can be added later. This release uses monthly Stripe prices only.</p>
                </div>
              </div>
              <div className="rooms-v2-plan-grid">
                {ROOM_PLANS.map((plan) => {
                  const selected = plan.id === draft.planId;
                  const configured =
                    !plan.paid ||
                    Boolean(checkoutConfig?.coreReady && checkoutConfig.plans[plan.id]);

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setDraft((current) => ({ ...current, planId: plan.id }));
                        setStatusMessage("");
                      }}
                      className={`rooms-v2-plan-card${selected ? " is-selected" : ""}`}
                    >
                      <div className="rooms-v2-plan-heading">
                        <div>
                          <strong>{plan.name}</strong>
                          <span>{plan.members}</span>
                        </div>
                        <b>{plan.price}</b>
                      </div>
                      <p>{plan.detail}</p>
                      <span className="rooms-v2-plan-note">
                        {plan.paid
                          ? checkingCheckout
                            ? "Checking monthly checkout"
                            : configured
                              ? "Monthly Stripe checkout ready"
                              : "Checkout configuration incomplete"
                          : "No payment required"}
                      </span>
                      {selected ? (
                        <span className="rooms-v2-selected-mark">
                          <Check aria-hidden="true" size={13} />
                          Selected
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rooms-v2-builder-step">
              <div className="rooms-v2-step-heading">
                <span>03</span>
                <div>
                  <p className="rooms-v2-eyebrow">Room identity</p>
                  <h2>Name the private space and explain its purpose.</h2>
                </div>
              </div>
              <div className="rooms-v2-identity-form">
                <label>
                  <span>Room name</span>
                  <input
                    type="text"
                    value={draft.roomName}
                    maxLength={80}
                    aria-invalid={showErrors && !nameIsValid}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, roomName: event.target.value }));
                      setStatusMessage("");
                    }}
                    placeholder="Room name"
                  />
                  {showErrors && !nameIsValid ? (
                    <small>Enter a Room name with at least 3 characters.</small>
                  ) : null}
                </label>
                <label>
                  <span>Room purpose</span>
                  <textarea
                    value={draft.description}
                    maxLength={600}
                    rows={6}
                    aria-invalid={showErrors && !descriptionIsValid}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, description: event.target.value }));
                      setStatusMessage("");
                    }}
                    placeholder="What is this private Room for?"
                  />
                  <div className="rooms-v2-field-meta">
                    {showErrors && !descriptionIsValid ? (
                      <small>Enter a purpose with at least 10 characters.</small>
                    ) : <span />}
                    <span>{draft.description.length}/600</span>
                  </div>
                </label>
              </div>
            </section>
          </div>

          <aside className="rooms-v2-builder-sidebar">
            <section className="rooms-v2-builder-summary">
              <p className="rooms-v2-eyebrow">Current setup</p>
              <h2>{trimmedName || selectedModel.shortTitle}</h2>
              <p>{selectedModel.title}</p>
              <dl>
                <div>
                  <dt>Plan</dt>
                  <dd>{selectedPlan.name}</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>{selectedPlan.members}</dd>
                </div>
                <div>
                  <dt>Monthly price</dt>
                  <dd>{selectedPlan.price}</dd>
                </div>
                <div>
                  <dt>Calendar use</dt>
                  <dd>{selectedModel.calendarUse}</dd>
                </div>
              </dl>
              <button type="button" onClick={continueToReview} className="rooms-v2-button rooms-v2-button-primary">
                Review setup
                <ArrowRight aria-hidden="true" size={17} />
              </button>
              {statusMessage ? <p className="rooms-v2-status-message" role="status">{statusMessage}</p> : null}
            </section>

            <section className="rooms-v2-builder-boundary">
              <div>
                <Lock aria-hidden="true" size={20} />
                <h2>Private by default</h2>
              </div>
              <p>Room content remains inside verified membership and role boundaries.</p>
              <ul>
                <li>No public Discussion is created</li>
                <li>Free Rooms create the owner membership immediately</li>
                <li>Paid Rooms are created only after Stripe confirms payment</li>
                <li>Monthly billing only in this release</li>
              </ul>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
