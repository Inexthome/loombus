import { normalizePublicText } from "@/lib/public-text";
import { floorHorizonLabel, floorStanceLabel, type FloorHorizon, type FloorStance } from "@/lib/floor-shared";

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
};

const STANCE_STYLES: Record<FloorStance, string> = {
  long: "bg-emerald-500/10 text-emerald-400",
  short: "bg-rose-500/10 text-rose-400",
  neutral: "bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)]",
};

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

export function FloorThesisCard({ thesis }: { thesis: FloorThesisCardData }) {
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

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--loombus-border-muted)] pt-4 text-xs font-bold text-[var(--loombus-text-muted)]">
        <span>{thesis.author_name}</span>
        <span aria-hidden="true">·</span>
        <span>{new Date(thesis.created_at).toLocaleDateString()}</span>
      </div>
    </article>
  );
}
