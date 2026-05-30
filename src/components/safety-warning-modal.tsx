"use client";

export type SafetyWarningState = {
  message: string;
  category?: string | null;
} | null;

export function getSafetyWarningFromResult(result: unknown): SafetyWarningState {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null;
  }

  const record = result as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";

  if (code !== "content_safety_blocked" && code !== "content_safety_warning") {
    return null;
  }

  const message =
    typeof record.error === "string" && record.error.trim()
      ? record.error.trim()
      : "This content may violate Loombus safety rules. Please revise before posting.";

  const category =
    typeof record.category === "string" && record.category.trim()
      ? record.category.trim()
      : null;

  return {
    message,
    category,
  };
}

export function SafetyWarningModal({
  warning,
  onClose,
}: {
  warning: SafetyWarningState;
  onClose: () => void;
}) {
  if (!warning) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-warning-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[1.75rem] border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
          Safety warning
        </p>

        <h2 id="safety-warning-title" className="text-xl font-semibold tracking-tight">
          Please revise before posting.
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          {warning.message}
        </p>

        {warning.category && (
          <p className="mt-3 rounded-2xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-zinc-500">
            Category: {warning.category}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Revise content
          </button>
        </div>
      </div>
    </div>
  );
}
