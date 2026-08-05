"use client";

import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import { Loader2, ShieldQuestion, Sparkles } from "lucide-react";
import { useState } from "react";

export type FloorAnalysisData = {
  id: string;
  steelman: string;
  redteam: string;
  blind_spots: string;
  model: string | null;
  created_at: string;
};

function analysisBlock(label: string, value: string) {
  const normalized = normalizePublicText(value).trim();
  if (!normalized) return null;
  return (
    <div>
      <span className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">
        {label}
      </span>
      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[var(--loombus-text-muted)]">
        {normalized}
      </p>
    </div>
  );
}

export function FloorAnalysisSection({
  thesisId,
  analysis,
  canRequestAnalysis,
  onAnalysisGenerated,
}: {
  thesisId: string;
  analysis: FloorAnalysisData | null;
  canRequestAnalysis: boolean;
  onAnalysisGenerated: () => void | Promise<void>;
}) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");

  async function requestAnalysis() {
    if (requesting) return;
    setRequesting(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch(`/api/floor/theses/${thesisId}/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to generate the analysis.");
      await onAnalysisGenerated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to generate the analysis.");
    } finally {
      setRequesting(false);
    }
  }

  if (!analysis && !canRequestAnalysis) return null;

  return (
    <div className="mt-4 border-t border-[var(--loombus-border-muted)] pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">
          AI red-team
        </span>
        {!analysis && canRequestAnalysis ? (
          <button
            type="button"
            onClick={requestAnalysis}
            disabled={requesting}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 text-xs font-black text-[var(--loombus-text-muted)] hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {requesting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-3.5" aria-hidden="true" />
            )}
            Request AI red-team analysis
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400">
          {error}
        </p>
      ) : null}

      {analysis ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {analysisBlock("Steelman", analysis.steelman)}
          {analysisBlock("Red-team", analysis.redteam)}
          {analysisBlock("Blind spots", analysis.blind_spots)}
        </div>
      ) : !canRequestAnalysis ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--loombus-text-subtle)]">
          <ShieldQuestion className="size-4" aria-hidden="true" />
          No AI analysis requested yet.
        </p>
      ) : null}
    </div>
  );
}
