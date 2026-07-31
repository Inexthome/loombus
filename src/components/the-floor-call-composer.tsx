"use client";

import {
  FLOOR_COMPARATOR_OPTIONS,
  formatFloorCallPrediction,
  type FloorComparator,
} from "@/lib/floor-shared";
import { supabase } from "@/lib/supabase/client";
import { Loader2, Plus, Send, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

const inputClass =
  "min-h-11 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-sm text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20";
const labelClass = "mb-1.5 block text-xs font-black text-[var(--loombus-text-muted)]";

export function FloorCallComposer({
  thesisId,
  thesisTicker,
  onPosted,
}: {
  thesisId: string;
  thesisTicker: string;
  onPosted: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [comparator, setComparator] = useState<FloorComparator>("gte");
  const [targetValue, setTargetValue] = useState("");
  const [targetValueHigh, setTargetValueHigh] = useState("");
  const [resolvesBy, setResolvesBy] = useState("");

  function reset() {
    setComparator("gte");
    setTargetValue("");
    setTargetValueHigh("");
    setResolvesBy("");
    setError("");
  }

  const parsedTargetValue = targetValue.trim() ? Number(targetValue) : null;
  const parsedTargetValueHigh =
    comparator === "range" && targetValueHigh.trim() ? Number(targetValueHigh) : null;
  const resolvesByIso = resolvesBy ? new Date(resolvesBy).toISOString() : null;

  const predictionPreview = useMemo(() => {
    if (parsedTargetValue === null || !Number.isFinite(parsedTargetValue)) return "";
    if (comparator === "range" && (parsedTargetValueHigh === null || !Number.isFinite(parsedTargetValueHigh))) {
      return "";
    }
    return formatFloorCallPrediction(
      thesisTicker,
      comparator,
      parsedTargetValue,
      parsedTargetValueHigh,
      resolvesByIso
    );
  }, [comparator, parsedTargetValue, parsedTargetValueHigh, resolvesByIso, thesisTicker]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch("/api/floor/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          thesisId,
          ticker: thesisTicker,
          comparator,
          targetValue,
          targetValueHigh: comparator === "range" ? targetValueHigh : null,
          resolvesBy: resolvesByIso ?? "",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to post your call.");
      reset();
      setOpen(false);
      await onPosted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to post your call.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 text-xs font-black text-[var(--loombus-text-muted)] hover:border-amber-300"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add a falsifiable call
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-[var(--loombus-text)]">New falsifiable call</span>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          aria-label="Close call composer"
          className="text-[var(--loombus-text-subtle)]"
        >
          <X className="size-4" />
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400">
          {error}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className={labelClass}>Comparator</span>
          <select
            value={comparator}
            onChange={(event) => setComparator(event.target.value as FloorComparator)}
            className={inputClass}
          >
            {FLOOR_COMPARATOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>{comparator === "range" ? "Low target" : "Target"}</span>
          <input
            value={targetValue}
            onChange={(event) => setTargetValue(event.target.value)}
            type="number"
            step="any"
            inputMode="decimal"
            required
            placeholder="150"
            className={inputClass}
          />
        </label>
        {comparator === "range" ? (
          <label className="block">
            <span className={labelClass}>High target</span>
            <input
              value={targetValueHigh}
              onChange={(event) => setTargetValueHigh(event.target.value)}
              type="number"
              step="any"
              inputMode="decimal"
              required
              placeholder="160"
              className={inputClass}
            />
          </label>
        ) : (
          <label className="block">
            <span className={labelClass}>Resolves by</span>
            <input
              value={resolvesBy}
              onChange={(event) => setResolvesBy(event.target.value)}
              type="date"
              required
              className={inputClass}
            />
          </label>
        )}
      </div>

      {comparator === "range" ? (
        <label className="block">
          <span className={labelClass}>Resolves by</span>
          <input
            value={resolvesBy}
            onChange={(event) => setResolvesBy(event.target.value)}
            type="date"
            required
            className={inputClass}
          />
        </label>
      ) : null}

      <div>
        <span className={labelClass}>This call will read</span>
        <p
          aria-live="polite"
          className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm font-bold leading-6 text-[var(--loombus-text)]"
        >
          {predictionPreview || "Fill in the fields above to preview your falsifiable claim."}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !predictionPreview || !resolvesBy}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-[#cbab5b] px-4 text-xs font-black text-[#17120a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-3.5" aria-hidden="true" />
          )}
          Post call
        </button>
      </div>
    </form>
  );
}
