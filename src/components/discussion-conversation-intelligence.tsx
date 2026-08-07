"use client";

import { useState } from "react";
import Link from "next/link";
import { BrainCircuit, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type IntelligenceItem = { replyId: string; title: string; note: string };
type Intelligence = {
  summary: string;
  majorPoints: IntelligenceItem[];
  counterpoints: IntelligenceItem[];
  evidenceToVerify: IntelligenceItem[];
  changedViews: IntelligenceItem[];
  openQuestions: string[];
};

type Result = {
  intelligence?: Intelligence;
  error?: string;
  cached?: boolean;
  candidateCount?: number;
  generatedAt?: string;
};

const SECTIONS: Array<{ key: keyof Pick<Intelligence, "majorPoints" | "counterpoints" | "evidenceToVerify" | "changedViews">; label: string; description: string }> = [
  { key: "majorPoints", label: "Major points", description: "High-signal ideas and branches shaping the conversation." },
  { key: "counterpoints", label: "Counterpoints", description: "Substantive tensions or competing positions supported by the discussion." },
  { key: "evidenceToVerify", label: "Evidence to verify", description: "Claims receiving sourcing pressure or needing stronger substantiation." },
  { key: "changedViews", label: "Changed views", description: "Contributions that received explicit Changed View signals." },
];

export function DiscussionConversationIntelligence({ discussionId, canUsePremium }: { discussionId: string; canUsePremium: boolean }) {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!canUsePremium || loading) return;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setResult({ error: "Sign in to use conversation intelligence." });
        return;
      }
      const response = await fetch("/api/discussions/conversation-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discussionId }),
      });
      const payload = (await response.json().catch(() => ({}))) as Result;
      if (!response.ok) {
        setResult({ error: payload.error ?? "Unable to build conversation intelligence." });
        return;
      }
      setResult(payload);
    } finally {
      setLoading(false);
    }
  }

  const intelligence = result?.intelligence;

  return (
    <section id="discussion-conversation-intelligence" className="discussion-phase-five-card">
      <header className="discussion-phase-five-heading">
        <div>
          <span className="discussion-phase-five-eyebrow"><BrainCircuit size={15} aria-hidden="true" /> Conversation intelligence</span>
          <h2>See what the conversation is actually doing.</h2>
          <p>Loombus ranks representative responses across the full discussion, then organizes the strongest points, tensions, sourcing pressure, changed views, and unresolved questions.</p>
        </div>
        {canUsePremium ? (
          <button type="button" className="discussion-phase-five-generate" disabled={loading} onClick={() => void generate()}>
            {loading ? <LoaderCircle className="is-spinning" size={16} /> : intelligence ? <RefreshCw size={16} /> : <Sparkles size={16} />}
            {loading ? "Building…" : intelligence ? "Refresh intelligence" : "Build intelligence"}
          </button>
        ) : (
          <Link href="/premium" className="discussion-phase-five-generate">View Premium</Link>
        )}
      </header>

      {!canUsePremium ? (
        <div className="discussion-phase-five-empty">Conversation intelligence uses the existing Premium AI entitlement.</div>
      ) : result?.error ? (
        <div className="discussion-phase-five-error">{result.error}</div>
      ) : !intelligence ? (
        <div className="discussion-phase-five-empty">Generate this view when a discussion becomes too large to understand by scrolling alone. Nothing here replaces the original responses.</div>
      ) : (
        <div className="discussion-phase-five-content">
          {intelligence.summary ? <p className="discussion-phase-five-summary">{intelligence.summary}</p> : null}
          <div className="discussion-phase-five-grid">
            {SECTIONS.map((section) => (
              <section key={section.key}>
                <h3>{section.label}</h3>
                <p>{section.description}</p>
                {intelligence[section.key].length ? (
                  <ol>
                    {intelligence[section.key].map((item) => (
                      <li key={`${section.key}-${item.replyId}`}>
                        <strong>{item.title}</strong>
                        <span>{item.note}</span>
                      </li>
                    ))}
                  </ol>
                ) : <small>No strong signal for this category yet.</small>}
              </section>
            ))}
          </div>
          <section className="discussion-phase-five-questions">
            <h3>Open questions</h3>
            {intelligence.openQuestions.length ? (
              <ul>{intelligence.openQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
            ) : <small>No unresolved questions were strong enough to surface.</small>}
          </section>
          <footer>
            <span>{result?.cached ? "Cached analysis" : "Fresh analysis"}</span>
            <span>{result?.candidateCount ?? 0} representative responses evaluated</span>
          </footer>
        </div>
      )}
    </section>
  );
}
