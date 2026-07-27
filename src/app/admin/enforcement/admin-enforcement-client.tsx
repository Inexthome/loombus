"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileWarning,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  Undo2,
  UserRoundCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  APPEAL_OUTCOME_LABELS,
  APPEAL_OUTCOMES,
  PUBLIC_REASON_LABELS,
  getActionLabel,
  type AppealOutcome,
} from "@/lib/enforcement-contract";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
};

type Decision = {
  id: string;
  subject_user_id: string | null;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  source_report_id: string | null;
  policy_document_id: string;
  policy_version: string;
  public_reason_code: keyof typeof PUBLIC_REASON_LABELS;
  primary_reason_code: string;
  severity: string;
  confidence: string;
  action_code: string;
  action_scope: string;
  member_explanation: string;
  internal_note: string | null;
  status: string;
  effective_at: string;
  expires_at: string | null;
  resolved_at: string | null;
  actor_user_id: string | null;
  reviewer_user_id: string | null;
  appeal_eligibility: string;
  appeal_deadline: string | null;
  notice_status: string;
  restoration_status: string;
  restoration_note: string | null;
  confidentiality: string;
  legal_hold: boolean;
  created_at: string;
};

type Appeal = {
  id: string;
  decision_id: string;
  appellant_user_id: string;
  statement: string;
  additional_context: string | null;
  has_new_information: boolean;
  status: string;
  outcome: AppealOutcome | null;
  assigned_reviewer_id: string | null;
  conflict_status: string;
  conflict_override_reason: string | null;
  member_outcome_message: string | null;
  internal_review_note: string | null;
  submitted_at: string;
  review_started_at: string | null;
  decided_at: string | null;
  closed_at: string | null;
};

type RestorationAttempt = {
  id: string;
  decision_id: string;
  appeal_id: string | null;
  adapter: string;
  status: string;
  result_message: string | null;
  exception_code: string | null;
  started_at: string;
  completed_at: string | null;
};

type QueueResponse = {
  currentAdminId: string;
  generatedAt: string;
  decisions: Decision[];
  appeals: Appeal[];
  profiles: Profile[];
  restorationAttempts: RestorationAttempt[];
};

type QueueFilter = "open" | "all" | "decided" | "restoration";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCode(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return value
    .replace(/^APL\./, "")
    .replace(/^RST\./, "")
    .replaceAll("_", " ")
    .toLowerCase();
}

function profileName(profile: Profile | null | undefined) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

function isOpenAppeal(appeal: Appeal) {
  return !["APL.DECIDED", "APL.CLOSED"].includes(appeal.status);
}

export default function AdminEnforcementClient() {
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);
  const [working, setWorking] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [conflictOverride, setConflictOverride] = useState("");
  const [outcome, setOutcome] = useState<AppealOutcome>("APL.OUTCOME_UPHELD");
  const [manualActionConfirmed, setManualActionConfirmed] = useState(false);

  const loadQueue = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fenforcement";
        return;
      }

      const response = await fetch("/api/admin/enforcement", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login?next=%2Fadmin%2Fenforcement";
        return;
      }
      if (response.status === 403) {
        setAuthorized(false);
        setMessage(result.error ?? "Admin access required.");
        return;
      }
      if (!response.ok) {
        setMessage(result.error ?? "Unable to load enforcement operations.");
        return;
      }

      const nextQueue = result as QueueResponse;
      setQueue(nextQueue);
      setAuthorized(true);
      setSelectedAppealId((current) => {
        if (current && nextQueue.appeals.some((appeal) => appeal.id === current)) {
          return current;
        }
        return nextQueue.appeals.find(isOpenAppeal)?.id ?? nextQueue.appeals[0]?.id ?? null;
      });
    } catch {
      setMessage("Unable to load enforcement operations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const profiles = useMemo(
    () => new Map((queue?.profiles ?? []).map((profile) => [profile.id, profile])),
    [queue]
  );
  const decisions = useMemo(
    () => new Map((queue?.decisions ?? []).map((decision) => [decision.id, decision])),
    [queue]
  );

  const visibleAppeals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (queue?.appeals ?? []).filter((appeal) => {
      if (filter === "open" && !isOpenAppeal(appeal)) return false;
      if (filter === "decided" && isOpenAppeal(appeal)) return false;
      if (filter === "restoration") {
        const decision = decisions.get(appeal.decision_id);
        if (!decision || !decision.restoration_status.startsWith("RST.")) return false;
        if (["RST.NOT_APPLICABLE", "RST.COMPLETED"].includes(decision.restoration_status)) {
          return false;
        }
      }
      if (!query) return true;
      const decision = decisions.get(appeal.decision_id);
      const appellant = profiles.get(appeal.appellant_user_id);
      return [
        appeal.id,
        appeal.statement,
        appeal.additional_context,
        appeal.status,
        appeal.outcome,
        profileName(appellant),
        appellant?.username,
        decision?.target_label,
        decision?.primary_reason_code,
        decision?.public_reason_code,
        decision?.action_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [decisions, filter, profiles, queue, searchQuery]);

  useEffect(() => {
    if (visibleAppeals.length === 0) {
      setSelectedAppealId(null);
      return;
    }
    if (!selectedAppealId || !visibleAppeals.some((appeal) => appeal.id === selectedAppealId)) {
      setSelectedAppealId(visibleAppeals[0].id);
    }
  }, [selectedAppealId, visibleAppeals]);

  const selectedAppeal = useMemo(
    () => queue?.appeals.find((appeal) => appeal.id === selectedAppealId) ?? null,
    [queue, selectedAppealId]
  );
  const selectedDecision = selectedAppeal
    ? decisions.get(selectedAppeal.decision_id) ?? null
    : null;

  useEffect(() => {
    setMemberMessage(selectedAppeal?.member_outcome_message ?? "");
    setInternalNote(selectedAppeal?.internal_review_note ?? "");
    setConflictOverride(selectedAppeal?.conflict_override_reason ?? "");
    setOutcome(selectedAppeal?.outcome ?? "APL.OUTCOME_UPHELD");
    setManualActionConfirmed(false);
  }, [selectedAppealId, selectedAppeal]);

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    if (!selectedAppeal || working) return;
    setWorking(action);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fenforcement";
        return;
      }

      const response = await fetch("/api/admin/enforcement/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action, appealId: selectedAppeal.id, ...extra }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error ?? "Unable to update appeal.");
        return;
      }

      setMessage("Appeal record updated.");
      await loadQueue(true);
    } catch {
      setMessage("Unable to update appeal.");
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <main className="admin-enforcement-page">
        <section className="admin-enforcement-state">
          <Loader2 aria-hidden="true" className="admin-enforcement-spin" />
          <p>Loading enforcement operations...</p>
        </section>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="admin-enforcement-page">
        <section className="admin-enforcement-state">
          <ShieldAlert aria-hidden="true" size={34} />
          <h1>Admin access required.</h1>
          <p>{message}</p>
          <Link href="/">Return to Loombus</Link>
        </section>
      </main>
    );
  }

  const openCount = (queue?.appeals ?? []).filter(isOpenAppeal).length;
  const decidedCount = (queue?.appeals ?? []).length - openCount;
  const restorationExceptions = (queue?.restorationAttempts ?? []).filter(
    (attempt) => attempt.status !== "RST.COMPLETED"
  ).length;

  return (
    <main className="admin-enforcement-page">
      <div className="admin-enforcement-shell">
        <header className="admin-enforcement-hero">
          <div>
            <Link href="/admin" className="admin-enforcement-back">
              <ArrowLeft aria-hidden="true" size={16} />
              Back to Admin Operations
            </Link>
            <p className="admin-enforcement-eyebrow">Enforcement and appeals</p>
            <h1>Separate the report, decision, appeal, and restoration.</h1>
            <p>
              Review member appeals without exposing reporter or victim identities, preserve
              active restrictions during review, and record a traceable outcome.
            </p>
          </div>
          <button type="button" onClick={() => void loadQueue(true)} disabled={refreshing}>
            {refreshing ? (
              <Loader2 aria-hidden="true" className="admin-enforcement-spin" size={17} />
            ) : (
              <RefreshCw aria-hidden="true" size={17} />
            )}
            {refreshing ? "Refreshing" : "Refresh queue"}
          </button>
        </header>

        <section className="admin-enforcement-metrics">
          <article><Scale size={19} /><span>Open appeals</span><strong>{openCount}</strong></article>
          <article><CheckCircle2 size={19} /><span>Decided</span><strong>{decidedCount}</strong></article>
          <article><ShieldAlert size={19} /><span>Decisions</span><strong>{queue?.decisions.length ?? 0}</strong></article>
          <article className={restorationExceptions ? "is-priority" : ""}>
            <FileWarning size={19} /><span>Restoration exceptions</span><strong>{restorationExceptions}</strong>
          </article>
        </section>

        {message ? (
          <div className="admin-enforcement-notice" role="status">
            <AlertTriangle size={18} />
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Dismiss">×</button>
          </div>
        ) : null}

        <section className="admin-enforcement-toolbar">
          <label>
            <Search aria-hidden="true" size={18} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search appeal, member, reason, target, or action"
            />
          </label>
          <div>
            {(["open", "all", "decided", "restoration"] as QueueFilter[]).map((value) => (
              <button
                type="button"
                key={value}
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </section>

        <section className="admin-enforcement-workspace">
          <aside className="admin-enforcement-queue">
            {visibleAppeals.length === 0 ? (
              <div className="admin-enforcement-empty">No appeals match this view.</div>
            ) : (
              visibleAppeals.map((appeal) => {
                const decision = decisions.get(appeal.decision_id);
                const appellant = profiles.get(appeal.appellant_user_id);
                return (
                  <button
                    type="button"
                    key={appeal.id}
                    className={selectedAppealId === appeal.id ? "is-selected" : ""}
                    onClick={() => setSelectedAppealId(appeal.id)}
                  >
                    <span>{formatCode(appeal.status)}</span>
                    <strong>{profileName(appellant)}</strong>
                    <p>{decision?.target_label || decision?.target_type || "Enforcement decision"}</p>
                    <small>{formatDate(appeal.submitted_at)}</small>
                  </button>
                );
              })
            )}
          </aside>

          {selectedAppeal && selectedDecision ? (
            <article className="admin-enforcement-detail">
              <div className="admin-enforcement-detail-head">
                <div>
                  <p>{PUBLIC_REASON_LABELS[selectedDecision.public_reason_code] ?? "Other policy concern"}</p>
                  <h2>{getActionLabel(selectedDecision.action_code)}</h2>
                  <span>{selectedDecision.target_label || selectedDecision.target_type}</span>
                </div>
                <span>{formatCode(selectedAppeal.status)}</span>
              </div>

              <section className="admin-enforcement-member-card">
                <UserRoundCheck aria-hidden="true" size={21} />
                <div>
                  <span>Appellant</span>
                  <strong>{profileName(profiles.get(selectedAppeal.appellant_user_id))}</strong>
                  <small>{selectedAppeal.appellant_user_id}</small>
                </div>
              </section>

              <dl className="admin-enforcement-facts">
                <div><dt>Decision</dt><dd>{selectedDecision.id}</dd></div>
                <div><dt>Appeal</dt><dd>{selectedAppeal.id}</dd></div>
                <div><dt>Reason code</dt><dd>{selectedDecision.primary_reason_code}</dd></div>
                <div><dt>Severity / confidence</dt><dd>{selectedDecision.severity} / {selectedDecision.confidence}</dd></div>
                <div><dt>Decision actor</dt><dd>{profileName(profiles.get(selectedDecision.actor_user_id || ""))}</dd></div>
                <div><dt>Assigned reviewer</dt><dd>{profileName(profiles.get(selectedAppeal.assigned_reviewer_id || ""))}</dd></div>
                <div><dt>Conflict status</dt><dd>{selectedAppeal.conflict_status}</dd></div>
                <div><dt>Restoration</dt><dd>{formatCode(selectedDecision.restoration_status)}</dd></div>
                <div><dt>Legal hold</dt><dd>{selectedDecision.legal_hold ? "Active" : "None"}</dd></div>
                <div><dt>Appeal deadline</dt><dd>{formatDate(selectedDecision.appeal_deadline)}</dd></div>
              </dl>

              <section className="admin-enforcement-copy-block">
                <span>Member-facing decision explanation</span>
                <p>{selectedDecision.member_explanation}</p>
              </section>
              <section className="admin-enforcement-copy-block">
                <span>Appeal statement</span>
                <p>{selectedAppeal.statement}</p>
                {selectedAppeal.additional_context ? <p>{selectedAppeal.additional_context}</p> : null}
                <small>{selectedAppeal.has_new_information ? "Member marked this as new information." : "No new-information claim."}</small>
              </section>

              {isOpenAppeal(selectedAppeal) ? (
                <section className="admin-enforcement-actions">
                  <div className="admin-enforcement-action-row">
                    <button
                      type="button"
                      onClick={() => void runAction("assign_reviewer", { reviewerId: queue?.currentAdminId })}
                      disabled={Boolean(working)}
                    >
                      <UserRoundCheck size={17} /> Assign to me
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction("start_review", { conflictOverrideReason: conflictOverride })}
                      disabled={Boolean(working)}
                    >
                      <Clock3 size={17} /> Start review
                    </button>
                  </div>

                  <label>
                    <span>Conflict override</span>
                    <textarea
                      value={conflictOverride}
                      onChange={(event) => setConflictOverride(event.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="Required when the reviewer made the original decision."
                    />
                  </label>

                  <label>
                    <span>Member-facing message</span>
                    <textarea
                      value={memberMessage}
                      onChange={(event) => setMemberMessage(event.target.value)}
                      rows={4}
                      maxLength={3000}
                      placeholder="Explain the request for information or final outcome without exposing confidential evidence."
                    />
                  </label>

                  <label>
                    <span>Internal review note</span>
                    <textarea
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                      rows={4}
                      maxLength={6000}
                      placeholder="Record evidence assessment, context, and review rationale."
                    />
                  </label>

                  <div className="admin-enforcement-request-row">
                    <button
                      type="button"
                      onClick={() => void runAction("request_information", { memberMessage })}
                      disabled={Boolean(working) || memberMessage.trim().length < 10}
                    >
                      Request information
                    </button>
                  </div>

                  <div className="admin-enforcement-outcome">
                    <label>
                      <span>Outcome</span>
                      <select value={outcome} onChange={(event) => setOutcome(event.target.value as AppealOutcome)}>
                        {APPEAL_OUTCOMES.map((value) => (
                          <option key={value} value={value}>{APPEAL_OUTCOME_LABELS[value]}</option>
                        ))}
                      </select>
                    </label>
                    {outcome === "APL.OUTCOME_MODIFIED" ? (
                      <label className="admin-enforcement-check">
                        <input
                          type="checkbox"
                          checked={manualActionConfirmed}
                          onChange={(event) => setManualActionConfirmed(event.target.checked)}
                        />
                        <span>I completed the modified product action separately.</span>
                      </label>
                    ) : null}
                    <button
                      type="button"
                      className="is-primary"
                      onClick={() =>
                        void runAction("resolve_appeal", {
                          outcome,
                          memberOutcomeMessage: memberMessage,
                          internalReviewNote: internalNote,
                          conflictOverrideReason: conflictOverride,
                          manualActionConfirmed,
                        })
                      }
                      disabled={Boolean(working) || memberMessage.trim().length < 10}
                    >
                      {working === "resolve_appeal" ? <Loader2 className="admin-enforcement-spin" size={17} /> : <Scale size={17} />}
                      Record outcome
                    </button>
                  </div>
                </section>
              ) : (
                <section className="admin-enforcement-closed">
                  <CheckCircle2 size={20} />
                  <div>
                    <h3>{selectedAppeal.outcome ? APPEAL_OUTCOME_LABELS[selectedAppeal.outcome] : "Appeal closed"}</h3>
                    <p>{selectedAppeal.member_outcome_message || "No member-facing outcome message was recorded."}</p>
                  </div>
                </section>
              )}

              {selectedDecision.restoration_note ? (
                <section className="admin-enforcement-restoration">
                  <Undo2 size={19} />
                  <div>
                    <span>{formatCode(selectedDecision.restoration_status)}</span>
                    <p>{selectedDecision.restoration_note}</p>
                  </div>
                </section>
              ) : null}
            </article>
          ) : (
            <article className="admin-enforcement-empty-detail">
              <Scale size={34} />
              <h2>Select an appeal.</h2>
              <p>Use the queue to review the decision, appellant context, conflict state, and restoration posture.</p>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
