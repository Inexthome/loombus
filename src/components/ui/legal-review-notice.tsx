export function LegalReviewNotice({ label }: { label: string }) {
  return (
    <div className="mb-10 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-5 text-sm leading-relaxed text-amber-200">
      <p>
        Important: This {label} is a platform-protection draft for Loombus and
        should be reviewed by a qualified attorney before broad public launch,
        paid subscription enforcement, or large-scale user growth.
      </p>
    </div>
  );
}
