"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  LifeBuoy,
  Lock,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const [draft, setDraft] = useState<RoomBuilderDraft>(DEFAULT_DRAFT);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

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

  const selectedModel = useMemo(() => getRoomModel(draft.modelId), [draft.modelId]);
  const selectedPlan = useMemo(() => getRoomPlan(draft.planId), [draft.planId]);
  const trimmedName = draft.roomName.trim();
  const trimmedDescription = draft.description.trim();
  const nameIsValid = trimmedName.length >= 3;
  const descriptionIsValid = trimmedDescription.length >= 10;
  const formIsValid = nameIsValid && descriptionIsValid;

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
      setStatusMessage("Complete the room name and purpose before reviewing the setup.");
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
    const confirmed = window.confirm("Clear this room setup draft and start again?");
    if (!confirmed) return;

    setDraft(DEFAULT_DRAFT);
    setIsReviewing(false);
    setShowErrors(false);
    setStatusMessage("Room setup draft cleared.");
    window.localStorage.removeItem(ROOM_BUILDER_DRAFT_KEY);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            >
              <ArrowLeft aria-hidden="true" size={16} />
              Edit room setup
            </button>
            <button type="button" onClick={clearDraft} className="rooms-v2-clear-button">
              <RotateCcw aria-hidden="true" size={15} />
              Clear draft
            </button>
          </div>

          <section className="rooms-v2-builder-hero rooms-v2-review-hero">
            <div>
              <p className="rooms-v2-eyebrow">Review room setup</p>
              <h1>Confirm the blueprint before any future provisioning step.</h1>
              <p>
                This review is a planning artifact. It does not create a room, membership,
                subscription, checkout session, calendar, invitation, or database record.
              </p>
            </div>
            <span className="rooms-v2-draft-badge">
              <Lock aria-hidden="true" size={15} />
              Saved on this device
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
              <p className="rooms-v2-eyebrow">Planning tier</p>
              <div className="rooms-v2-plan-heading">
                <div>
                  <h2>{selectedPlan.name}</h2>
                  <p>{selectedPlan.detail}</p>
                </div>
                <strong>{selectedPlan.price}</strong>
              </div>
              <p className="rooms-v2-plan-boundary">
                {selectedPlan.paid
                  ? "Displayed for product planning only. No checkout is connected."
                  : "The free planning tier also does not provision a room yet."}
              </p>
            </article>
          </section>

          <section className="rooms-v2-section rooms-v2-review-blueprint">
            <RoomsSectionHeading
              eyebrow="Workspace blueprint"
              title="The private room is designed around five connected operating surfaces."
              description="These modules describe the intended room structure; they are not represented as live account data."
            />
            <RoomWorkspaceBlueprint />
          </section>

          <section className="rooms-v2-boundary-review">
            <div>
              <span><ShieldCheck aria-hidden="true" size={22} /></span>
              <div>
                <p className="rooms-v2-eyebrow">Current production boundary</p>
                <h2>Nothing has been created or charged.</h2>
              </div>
            </div>
            <div className="rooms-v2-boundary-review-list">
              {[
                "No room record or owner membership",
                "No invitations, members, or role assignments",
                "No announcements, discussions, files, or events",
                "No subscription, Stripe checkout, or payment",
              ].map((item) => (
                <p key={item}>
                  <CheckCircle2 aria-hidden="true" size={16} />
                  {item}
                </p>
              ))}
            </div>
          </section>

          <div className="rooms-v2-review-actions">
            <button type="button" onClick={copySetupSummary} className="rooms-v2-button rooms-v2-button-primary">
              <Clipboard aria-hidden="true" size={16} />
              Copy setup summary
            </button>
            <button type="button" onClick={() => setIsReviewing(false)} className="rooms-v2-button rooms-v2-button-quiet">
              Edit setup
            </button>
            <Link href="/support" className="rooms-v2-button rooms-v2-button-quiet">
              <LifeBuoy aria-hidden="true" size={16} />
              Contact support
            </Link>
          </div>
          {statusMessage ? <p className="rooms-v2-status-message" role="status">{statusMessage}</p> : null}

          <button type="button" disabled className="rooms-v2-provision-button">
            Room provisioning is not connected yet
          </button>
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
            <p className="rooms-v2-eyebrow">Room setup planner</p>
            <h1>Define the private space before connecting its backend.</h1>
            <p>
              Choose the room model, review a planning tier, and define its identity. Your draft is
              saved on this device so the setup can be reviewed without pretending the room already exists.
            </p>
          </div>
          <span className="rooms-v2-draft-badge">
            <Lock aria-hidden="true" size={15} />
            Device-only draft
          </span>
        </section>

        <section className="rooms-v2-builder-grid">
          <div className="rooms-v2-builder-main">
            <section className="rooms-v2-builder-step">
              <div className="rooms-v2-step-heading">
                <span>01</span>
                <div>
                  <p className="rooms-v2-eyebrow">Room model</p>
                  <h2>What kind of group will use this room?</h2>
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
                  <p className="rooms-v2-eyebrow">Planning tier</p>
                  <h2>Estimate the room size and operating scope.</h2>
                  <p>Prices are preserved from the existing room planner; no billing flow is connected.</p>
                </div>
              </div>
              <div className="rooms-v2-plan-grid">
                {ROOM_PLANS.map((plan) => {
                  const selected = plan.id === draft.planId;
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
                        {plan.paid ? "Checkout not connected" : "Provisioning not connected"}
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
                  <h2>Name the room and state its purpose clearly.</h2>
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
                    <small>Enter a room name with at least 3 characters.</small>
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
                    placeholder="What is this private room for?"
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
                  <dt>Planning tier</dt>
                  <dd>{selectedPlan.name}</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>{selectedPlan.members}</dd>
                </div>
                <div>
                  <dt>Preview price</dt>
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
              <p>Room content is intended to remain inside its membership and role boundary.</p>
              <ul>
                <li>No public Discussion is created</li>
                <li>No owner or member record is created</li>
                <li>No calendar event or invitation is created</li>
                <li>No subscription or payment is started</li>
              </ul>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
