"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  APPEAL_ELIGIBLE_STATES,
  APPEAL_OUTCOME_LABELS,
  type MemberEnforcementDecision,
} from "@/lib/enforcement-contract";
import { supabase } from "@/lib/supabase/client";

type ProfileSummary = {
  id: string;
  username: string | null;
  full_name: string | null;
  account_status: string | null;
  enforcement_reason: string | null;
  enforced_at: string | null;
  suspended_until: string | null;
};

type HistoryResponse = {
  generatedAt: string;
  profile: ProfileSummary;
  decisions: MemberEnforcementDecision[];
};

function formatDate(value: string | null | undefined, includeTime = true) {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not specified";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function formatCode(value: string) {
  return value
    .replace(/^APL\./, "")
    .replace(/^RST\./, "")
    .replaceAll("_", " ")
    .toLowerCase();
}

function statusTone(status: string) {
  if (["reversed", "expired"].includes(status)) return "success";
  if (["upheld", "active"].includes(status)) return "attention";
  if (["remanded", "modified"].includes(status)) return "warning";
  return "muted";
}

function canAppeal(decision: MemberEnforcementDecision) {
  if (decision.appeal) return false;
  if (!APPEAL_ELIGIBLE_STATES.has(decision.appealEligibility)) return false;
  if (!decision.appealDeadline) return true;
  return new Date(decision.appealDeadline).getTime() >= Date.now();
}

export default function AccountEnforcementClient() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [appealStatement, setAppealStatement] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [hasNewInformation, setHasNewInformation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadHistory = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login?next=%2Faccount%2Fenforcement";
        return;
      }

      const response = await fetch("/api/account/enforcement", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login?next=%2Faccount%2Fenforcement";
        return;
      }

      if (!response.ok) {
        setMessage(result.error ?? "Unable to load account decisions.");
        return;
      }

      const nextData = result as HistoryResponse;
      setData(nextData);
      setSelectedDecisionId((current) => {
        if (current && nextData.decisions.some((decision) => decision.id === current)) {
          return current;
        }
        return nextData.decisions[0]?.id ?? null;
      });
    } catch {
      setMessage("Unable to load account decisions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const selectedDecision = useMemo(
    () => data?.decisions.find((decision) => decision.id === selectedDecisionId) ?? null,
    [data, selectedDecisionId]
  );

  useEffect(() => {
    setAppealStatement("");
    setAdditionalContext("");
    setHasNewInformation(false);
  }, [selectedDecisionId]);

  async function submitAppeal() {
    if (!selectedDecision || submitting) return;
    if (appealStatement.trim().length < 20) {
      setMessage("Explain the reason for your appeal in at least 20 characters.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login?next=%2Faccount%2Fenforcement";
        return;
      }

      const response = await fetch("/api/account/enforcement/appeals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          decisionId: selectedDecision.id,
          statement: appealStatement.trim(),
          additionalContext: additionalContext.trim(),
          hasNewInformation,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to submit appeal.");
        return;
      }

      setMessage("Your appeal was submitted.");
      await loadHistory(true);
    } catch {
      setMessage("Unable to submit appeal.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="account-enforcement-page">
        <section className="account-enforcement-state">
          <Loader2 aria-hidden="true" className="account-enforcement-spin" />
          <p>Loading your account decisions...</p>
        </section>
      </main>
    );
  }

  const decisions = data?.decisions ?? [];

  return (
    <main className="account-enforcement-page">
      <div className="account-enforcement-shell">
        <header className="account-enforcement-hero">
          <div>
            <Link href="/settings" className="account-enforcement-back">
              <ArrowLeft aria-hidden="true" size={16} />
              Back to Settings
            </Link>
            <p className="account-enforcement-eyebrow">Account decisions</p>
            <h1>Understand the action and request review.</h1>
            <p>
              Review Loombus enforcement decisions connected to your account, see
              the current effect, and submit one appeal where review is available.
            </p>
          </div>
          <button
            type="button"
            className="account-enforcement-refresh"
            onClick={() => void loadHistory(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 aria-hidden="true" className="account-enforcement-spin" size={17} />
            ) : (
              <RefreshCw aria-hidden="true" size={17} />
            )}
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </header>

        {message ? (
          <div className="account-enforcement-notice" role="status">
            <AlertTriangle aria-hidden="true" size={18} />
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">
              ×
            </button>
          </div>
        ) : null}

        <section className="account-enforcement-summary" aria-label="Account standing">
          <article>
            <ShieldCheck aria-hidden="true" size={20} />
            <div>
              <span>Current account status</span>
              <strong>{data?.profile.account_status?.replaceAll("_", " ") ?? "active"}</strong>
            </div>
          </article>
          <article>
            <FileText aria-hidden="true" size={20} />
            <div>
              <span>Recorded decisions</span>
              <strong>{decisions.length.toLocaleString()}</strong>
            </div>
          </article>
          <article>
            <Scale aria-hidden="true" size={20} />
            <div>
              <span>Open appeals</span>
              <strong>
                {decisions
                  .filter((decision) =>
                    decision.appeal &&
                    !["APL.DECIDED", "APL.CLOSED"].includes(decision.appeal.status)
                  )
                  .length.toLocaleString()}
              </strong>
            </div>
          </article>
        </section>

        {decisions.length === 0 ? (
          <section className="account-enforcement-empty">
            <CheckCircle2 aria-hidden="true" size={34} />
            <h2>No enforcement decisions are recorded.</h2>
            <p>Your account does not currently have a canonical Loombus enforcement history.</p>
            <Link href="/discussions">Return to Discussions</Link>
          </section>
        ) : (
          <section className="account-enforcement-workspace">
            <aside className="account-enforcement-list" aria-label="Enforcement decisions">
              {decisions.map((decision) => (
                <button
                  type="button"
                  key={decision.id}
                  className={`account-enforcement-list-item${
                    selectedDecisionId === decision.id ? " is-selected" : ""
                  }`}
                  onClick={() => setSelectedDecisionId(decision.id)}
                >
                  <span className={`account-enforcement-status is-${statusTone(decision.status)}`}>
                    {decision.status.replaceAll("_", " ")}
                  </span>
                  <strong>{decision.actionLabel}</strong>
                  <span>{decision.targetLabel}</span>
                  <small>{formatDate(decision.effectiveAt)}</small>
                </button>
              ))}
            </aside>

            {selectedDecision ? (
              <article className="account-enforcement-detail">
                <div className="account-enforcement-detail-head">
                  <div>
                    <p>{selectedDecision.publicReasonLabel}</p>
                    <h2>{selectedDecision.actionLabel}</h2>
                    <span>{selectedDecision.targetLabel}</span>
                  </div>
                  <span className={`account-enforcement-status is-${statusTone(selectedDecision.status)}`}>
                    {selectedDecision.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="account-enforcement-explanation">
                  <ShieldAlert aria-hidden="true" size={20} />
                  <div>
                    <span>Why Loombus took this action</span>
                    <p>{selectedDecision.memberExplanation}</p>
                  </div>
                </div>

                <dl className="account-enforcement-facts">
                  <div>
                    <dt>Decision ID</dt>
                    <dd>{selectedDecision.id}</dd>
                  </div>
                  <div>
                    <dt>Effective</dt>
                    <dd>{formatDate(selectedDecision.effectiveAt)}</dd>
                  </div>
                  <div>
                    <dt>Ends</dt>
                    <dd>{formatDate(selectedDecision.expiresAt)}</dd>
                  </div>
                  <div>
                    <dt>Policy reference</dt>
                    <dd>
                      {selectedDecision.policyDocumentId} · {selectedDecision.policyVersion}
                    </dd>
                  </div>
                  <div>
                    <dt>Appeal eligibility</dt>
                    <dd>{formatCode(selectedDecision.appealEligibility)}</dd>
                  </div>
                  <div>
                    <dt>Appeal deadline</dt>
                    <dd>{formatDate(selectedDecision.appealDeadline)}</dd>
                  </div>
                  <div>
                    <dt>Restoration</dt>
                    <dd>{formatCode(selectedDecision.restorationStatus)}</dd>
                  </div>
                </dl>

                {selectedDecision.appeal ? (
                  <section className="account-enforcement-appeal-card">
                    <div className="account-enforcement-section-title">
                      <Scale aria-hidden="true" size={19} />
                      <div>
                        <span>Appeal status</span>
                        <h3>{formatCode(selectedDecision.appeal.status)}</h3>
                      </div>
                    </div>
                    {selectedDecision.appeal.outcome ? (
                      <p>
                        Outcome: {APPEAL_OUTCOME_LABELS[selectedDecision.appeal.outcome]}
                      </p>
                    ) : null}
                    {selectedDecision.appeal.memberOutcomeMessage ? (
                      <p>{selectedDecision.appeal.memberOutcomeMessage}</p>
                    ) : null}
                    <small>Submitted {formatDate(selectedDecision.appeal.submittedAt)}</small>
                  </section>
                ) : canAppeal(selectedDecision) ? (
                  <section className="account-enforcement-appeal-form">
                    <div className="account-enforcement-section-title">
                      <Scale aria-hidden="true" size={19} />
                      <div>
                        <span>Request review</span>
                        <h3>Submit an appeal</h3>
                      </div>
                    </div>
                    <label>
                      <span>Why should this decision be changed?</span>
                      <textarea
                        value={appealStatement}
                        onChange={(event) => setAppealStatement(event.target.value)}
                        maxLength={6000}
                        rows={6}
                        placeholder="Explain the context, possible error, or reason the action should be reviewed."
                      />
                      <small>{appealStatement.length.toLocaleString()} / 6,000</small>
                    </label>
                    <label>
                      <span>Additional context</span>
                      <textarea
                        value={additionalContext}
                        onChange={(event) => setAdditionalContext(event.target.value)}
                        maxLength={6000}
                        rows={4}
                        placeholder="Add details that help the reviewer understand the situation. Do not re-upload harmful material."
                      />
                      <small>{additionalContext.length.toLocaleString()} / 6,000</small>
                    </label>
                    <label className="account-enforcement-checkbox">
                      <input
                        type="checkbox"
                        checked={hasNewInformation}
                        onChange={(event) => setHasNewInformation(event.target.checked)}
                      />
                      <span>This appeal includes information not available in the original review.</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void submitAppeal()}
                      disabled={submitting || appealStatement.trim().length < 20}
                    >
                      {submitting ? (
                        <Loader2 aria-hidden="true" className="account-enforcement-spin" size={18} />
                      ) : (
                        <Scale aria-hidden="true" size={18} />
                      )}
                      {submitting ? "Submitting appeal" : "Submit appeal"}
                    </button>
                  </section>
                ) : (
                  <section className="account-enforcement-appeal-card is-muted">
                    <CalendarClock aria-hidden="true" size={19} />
                    <div>
                      <h3>Appeal is not currently available.</h3>
                      <p>
                        The eligibility state is {formatCode(selectedDecision.appealEligibility)}.
                        Contact Support for technical problems with this record.
                      </p>
                    </div>
                  </section>
                )}

                {selectedDecision.events.length > 0 ? (
                  <section className="account-enforcement-timeline">
                    <div className="account-enforcement-section-title">
                      <Clock3 aria-hidden="true" size={19} />
                      <div>
                        <span>Decision history</span>
                        <h3>Timeline</h3>
                      </div>
                    </div>
                    {selectedDecision.events.map((event) => (
                      <div key={event.id}>
                        <span />
                        <p>{event.message || formatCode(event.eventType)}</p>
                        <small>{formatDate(event.createdAt)}</small>
                      </div>
                    ))}
                  </section>
                ) : null}
              </article>
            ) : null}
          </section>
        )}

        <footer className="account-enforcement-footer">
          <p>
            Appeal review does not automatically pause an active safety restriction. Reporter,
            victim, witness, and confidential evidence details are not shown here.
          </p>
          <Link href="/support">Contact Support</Link>
        </footer>
      </div>
    </main>
  );
}
