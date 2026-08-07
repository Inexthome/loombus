"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect } from "react";

type LoombusPromptTone = "error" | "success" | "info";

type LoombusPromptProps = {
  message: string;
  title?: string;
  tone?: LoombusPromptTone;
  onClose?: () => void;
  autoDismissMs?: number;
  actionHref?: string;
  actionLabel?: string;
};

const toneClasses: Record<LoombusPromptTone, string> = {
  error:
    "border-red-900/80 bg-red-950 text-red-50 shadow-red-950/35",
  success:
    "border-[color-mix(in_srgb,var(--loombus-gold)_55%,var(--loombus-border))] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-black/25",
  info:
    "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-black/25",
};

const iconClasses: Record<LoombusPromptTone, string> = {
  error: "bg-red-900/70 text-red-100",
  success: "bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]",
  info: "bg-[var(--loombus-page-bg)] text-[var(--loombus-text-muted)]",
};

export function LoombusPrompt({
  message,
  title,
  tone = "error",
  onClose,
  autoDismissMs,
  actionHref,
  actionLabel,
}: LoombusPromptProps) {
  useEffect(() => {
    if (!message || !onClose || !autoDismissMs) return;

    const timeout = window.setTimeout(onClose, autoDismissMs);
    return () => window.clearTimeout(timeout);
  }, [autoDismissMs, message, onClose]);

  if (!message) return null;

  const Icon =
    tone === "error" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[160] grid place-items-center p-4"
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <div
        role={tone === "error" ? "alert" : "status"}
        className={`pointer-events-auto relative w-[min(92vw,30rem)] rounded-2xl border px-4 py-4 shadow-2xl backdrop-blur-xl ${toneClasses[tone]}`}
      >
        {onClose ? (
          <button
            type="button"
            aria-label="Close message"
            onClick={onClose}
            className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full border border-current/20 bg-black/10 opacity-80 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)]"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}

        <div className="flex items-start gap-3 pr-7">
          <span
            className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${iconClasses[tone]}`}
          >
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            {title ? (
              <strong className="block text-sm font-black leading-5">{title}</strong>
            ) : null}
            <p className={`${title ? "mt-1" : ""} text-sm font-semibold leading-6`}>
              {message}
            </p>
            {actionHref && actionLabel ? (
              <Link
                href={actionHref}
                className="mt-3 inline-flex rounded-full border border-current/25 px-3 py-1.5 text-sm font-black no-underline transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)]"
              >
                {actionLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
