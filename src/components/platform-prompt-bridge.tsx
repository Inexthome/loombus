"use client";

import { useCallback, useEffect, useState } from "react";
import { LoombusPrompt } from "@/components/loombus-prompt";

type PromptTone = "error" | "success" | "info";

type PromptDetail = {
  message: string;
  title?: string;
  tone?: PromptTone;
  autoDismissMs?: number;
  actionHref?: string;
  actionLabel?: string;
};

declare global {
  interface WindowEventMap {
    "loombus:prompt": CustomEvent<PromptDetail>;
  }
}

export function showLoombusPrompt(detail: PromptDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("loombus:prompt", { detail }));
}

export function PlatformPromptBridge() {
  const [prompt, setPrompt] = useState<PromptDetail | null>(null);
  const close = useCallback(() => setPrompt(null), []);

  useEffect(() => {
    const handlePrompt = (event: CustomEvent<PromptDetail>) => {
      const detail = event.detail;
      if (!detail?.message?.trim()) return;
      setPrompt({ ...detail, message: detail.message.trim() });
    };

    window.addEventListener("loombus:prompt", handlePrompt);
    return () => window.removeEventListener("loombus:prompt", handlePrompt);
  }, []);

  if (!prompt) return null;

  return (
    <LoombusPrompt
      message={prompt.message}
      title={prompt.title}
      tone={prompt.tone ?? "error"}
      onClose={close}
      autoDismissMs={prompt.autoDismissMs}
      actionHref={prompt.actionHref}
      actionLabel={prompt.actionLabel}
    />
  );
}
