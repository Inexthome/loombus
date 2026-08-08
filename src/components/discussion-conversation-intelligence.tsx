"use client";

import { useState } from "react";
import Link from "next/link";
import { BrainCircuit, ChevronDown, ChevronUp, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type IntelligenceItem = { replyId: string; title: string; note: string; responseCount?: number; signalCount?: number };
type Intelligence = {
  summary: string;
  majorPoints: IntelligenceItem[];
  counterpoints: IntelligenceItem[];
  evidenceToVerify: IntelligenceItem[];
  changedViews: IntelligenceItem[];
  openQuestions: string[];
};
type Result = { intelligence?: Intelligence; error?: string; code?: string; cached?: boolean; candidateCount?: number; generatedAt?: string };

const SECTIONS: Array<{ key: keyof Pick<Intelligence, "majorPoints" | "counterpoints" | "evidenceToVerify" | "changedViews">; label: string; description: string }> = [
  { key: "majorPoints", label: "Major points", description: "High-signal ideas and branches shaping the conversation." },
  { key: "counterpoints", label: "Counterpoints", description: "Substantive tensions or competing positions supported by the discussion." },
  { key: "evidenceToVerify", label: "Evidence to verify", description: "Claims receiving sourcing pressure or needing stronger substantiation." },
  { key: "changedViews", label: "Changed views", description: "Contributions that received explicit Changed View signals." },
];

export function DiscussionConversationIntelligence({ discussionId }: { discussionId: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const premiumRequired = result?.code === "premium_required";

  async function generate() {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setResult({ error: "Sign in to use conversation intelligence." }); return; }
      const response = await fetch("/api/discussions/conversation-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discussionId }),
      });
      const payload = (await response.json().catch(() => ({}))) as Result;
      if (!response.ok) { setResult({ error: payload.error ?? "Unable to build conversation intelligence.", code: payload.code }); return; }
      setResult(payload);
    } finally { setLoading(false); }
  }

  function openSource(item: IntelligenceItem) {
    const target = document.getElementById(`reply-${item.replyId}`);
    const branch = target?.querySelector<HTMLButtonElement>(".discussion-thread-branch-button");
    if ((item.responseCount ?? 0) > 0 && branch) {
      branch.click();
      return;
    }
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const intelligence = result?.intelligence;
  return (
    <section id="discussion-conversation-intelligence" className="discussion-phase-five-card">
      <header className="discussion-phase-five-heading">
        <div>
          <span className="discussion-phase-five-eyebrow"><BrainCircuit size={15} aria-hidden="true" /> Conversation intelligence</span>
          <h2>Understand how the conversation is developing.</h2>
          <p>Loombus ranks representative responses across the full discussion, then organizes major points, tensions, sourcing pressure, changed views, and unresolved questions.</p>
        </div>
        {premiumRequired ? <Link href="/premium" className="discussion-phase-five-generate">View Premium</Link> : (
          <button type="button" className="discussion-phase-five-generate" disabled={loading} onClick={() => void generate()}>
            {loading ? <LoaderCircle className="is-spinning" size={16} /> : intelligence ? <RefreshCw size={16} /> : <Sparkles size={16} />}
            {loading ? "Building…" : intelligence ? "Refresh intelligence" : "Build intelligence"}
          </button>
        )}
      </header>
      {result?.error ? <div className="discussion-phase-five-error">{result.error}</div> : !intelligence ? (
        <div className="discussion-phase-five-empty">Generate this view when a discussion becomes too large to understand by scrolling alone. Nothing here replaces the original responses.</div>
      ) : (
        <div className="discussion-phase-five-content">
          {intelligence.summary ? <p className="discussion-phase-five-summary">{intelligence.summary}</p> : null}
          <div className="discussion-phase-five-status">
            <span>{result?.candidateCount ?? 0} representative responses evaluated</span>
            <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {expanded ? "Hide intelligence" : "View intelligence"}
            </button>
          </div>
          {expanded ? <>
            <div className="discussion-phase-five-grid">
              {SECTIONS.map((section) => <section key={section.key}><h3>{section.label}</h3><p>{section.description}</p>{intelligence[section.key].length ? <ol>{intelligence[section.key].map((item) => <li key={`${section.key}-${item.replyId}`}><strong>{item.title}</strong><span>{item.note}</span><button type="button" className="discussion-phase-five-source" onClick={() => openSource(item)}>{(item.responseCount ?? 0) > 0 ? `${item.responseCount} ${(item.responseCount ?? 0) === 1 ? "response" : "responses"} · View point` : "View source response"}{(item.signalCount ?? 0) > 0 ? ` · ${item.signalCount} ${(item.signalCount ?? 0) === 1 ? "signal" : "signals"}` : ""}</button></li>)}</ol> : <small>No strong signal for this category yet.</small>}</section>)}
            </div>
            <section className="discussion-phase-five-questions"><h3>Open questions</h3>{intelligence.openQuestions.length ? <ul>{intelligence.openQuestions.map((question) => <li key={question}>{question}</li>)}</ul> : <small>No unresolved questions were strong enough to surface.</small>}</section>
          </> : null}
          <footer><span>{result?.cached ? "Cached analysis" : "Fresh analysis"}</span></footer>
        </div>
      )}
    </section>
  );
}
