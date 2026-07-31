import { FloorCallComposer } from "@/components/the-floor-call-composer";
import { FloorAnalysisSection, type FloorAnalysisData } from "@/components/the-floor-analysis-section";
import { normalizePublicText } from "@/lib/public-text";
import {
  floorComparatorLabel,
  floorHorizonLabel,
  floorStanceLabel,
  formatFloorCallTarget,
  type FloorComparator,
  type FloorHorizon,
  type FloorStance,
} from "@/lib/floor-shared";

export type FloorCallCardData = {
  id: string;
  prediction: string;
  comparator: FloorComparator;
  target_value: number | null;
  target_value_high: number | null;
  resolves_by: string;
  status: "pending" | "resolved" | "void";
  outcome: "correct" | "incorrect" | "partial" | null;
  outcome_note: string | null;
  resolved_value: number | null;
  created_at: string;
};

export type FloorThesisCardData = {
  id: string;
  ticker: string;
  stance: FloorStance;
  conviction: number;
  horizon: FloorHorizon;
  entry_zone_low: number | null;
  entry_zone_high: number | null;
  exit_plan: string;
  thesis: string;
  catalysts: string;
  risks: string;
  created_at: string;
  author_name: string;
  calls: FloorCallCardData[];
  analysis: FloorAnalysisData | null;
};

const STANCE_STYLES: Record<FloorStance, string> = {
  long: "bg-emerald-500/10 text-emerald-400",
  short: "bg-rose-500/10 text-rose-400",
  neutral: "bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)]",
};

const CALL_STATUS_STYLES: Record<string, string> = {
  pending: "bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]",
  correct: "bg-emerald-500/10 text-emerald-400",
  incorrect: "bg-rose-500/10 text-rose-400",
  partial: "bg-amber-500/10 text-amber-400",
  void: "bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-subtle)]",
};

function callStatusLabel(call: FloorCallCardData) {
  if (call.status === "pending") return "Pending";
  if (call.status === "void") return "Void";
  if (call.outcome === "correct") return "Correct";
  if (call.outcome === "incorrect") return "Incorrect";
  if (call.outcome === "partial") return "Partial";
  return "Resolved";
}

function callStatusKey(call: FloorCallCardData) {
  if (call.status === "pending") return "pending";
  if (call.status === "void") return "void";
  return call.outcome ?? "pending";
}

function formatEntryZone(low: number | null, high: number | null) {
  if (low !== null && high !== null) return `${low} – ${high}`;
  if (low !== null) return `${low}+`;
  if (high !== null) return `Up to ${high}`;
  return null;
}

function textBlock(label: string, value: string) {
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

export function FloorThesisCard({
  thesis,
  canAddCall,
  onCallPosted,
  canRequestAnalysis,
  onAnalysisGenerated,
}: {
  thesis: FloorThesisCardData;
  canAddCall: boolean;
  onCallPosted: () => void | Promise<void>;
  canRequestAnalysis: boolean;
  onAnalysisGenerated: () => void | Promise<void>;
}) {
  const entryZone = formatEntryZone(thesis.entry_zone_low, thesis.entry_zone_high);

  return (
    <article className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10 transition hover:border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black text-[var(--loombus-gold)]">
          {thesis.ticker}
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${STANCE_STYLES[thesis.stance]}`}>
          {floorStanceLabel(thesis.stance)}
        </span>
        <span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-bold text-[var(--loombus-text-muted)]">
          {floorHorizonLabel(thesis.horizon)}
        </span>
        <span className="ml-auto flex items-center gap-1" aria-label={`Conviction ${thesis.conviction} of 5`}>
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={index}
              className={`size-1.5 rounded-full ${
                index < thesis.conviction ? "bg-[var(--loombus-gold)]" : "bg-[var(--loombus-surface-muted)]"
              }`}
              aria-hidden="true"
            />
          ))}
        </span>
      </div>

      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-[var(--loombus-text)]">
        {normalizePublicText(thesis.thesis)}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {entryZone ? textBlock("Entry zone", entryZone) : null}
        {textBlock("Exit plan", thesis.exit_plan)}
        {textBlock("Catalysts", thesis.catalysts)}
        {textBlock("Risks", thesis.risks)}
      </div>

      <div className="mt-4 border-t border-[var(--loombus-border-muted)] pt-4">
        <span className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">
          Falsifiable calls
        </span>
        {thesis.calls.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-2">
            {thesis.calls.map((call) => (
              <li
                key={call.id}
                className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-black ${CALL_STATUS_STYLES[callStatusKey(call)]}`}
                  >
                    {callStatusLabel(call)}
                  </span>
                  <span className="text-xs font-bold text-[var(--loombus-text-subtle)]">
                    {floorComparatorLabel(call.comparator)} resolves{" "}
                    {new Date(call.resolves_by).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--loombus-text)]">
                  {normalizePublicText(call.prediction)}
                </p>
                <p className="mt-1 text-xs font-bold text-[var(--loombus-text-muted)]">
                  Target: {formatFloorCallTarget(call.comparator, call.target_value, call.target_value_high)}
                  {call.status === "resolved" && call.resolved_value !== null
                    ? ` · Resolved at ${call.resolved_value}`
                    : ""}
                </p>
                {call.outcome_note ? (
                  <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">
                    {normalizePublicText(call.outcome_note)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--loombus-text-subtle)]">
            No falsifiable calls attached yet.
          </p>
        )}
        {canAddCall ? (
          <div className="mt-3">
            <FloorCallComposer thesisId={thesis.id} thesisTicker={thesis.ticker} onPosted={onCallPosted} />
          </div>
        ) : null}
      </div>

      <FloorAnalysisSection
        thesisId={thesis.id}
        analysis={thesis.analysis}
        canRequestAnalysis={canRequestAnalysis}
        onAnalysisGenerated={onAnalysisGenerated}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--loombus-border-muted)] pt-4 text-xs font-bold text-[var(--loombus-text-muted)]">
        <span>{thesis.author_name}</span>
        <span aria-hidden="true">·</span>
        <span>{new Date(thesis.created_at).toLocaleDateString()}</span>
      </div>
    </article>
  );
}
