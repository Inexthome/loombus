"use client";

import { useCallback, useEffect, useState } from "react";
import { LoombusPrompt } from "@/components/loombus-prompt";
import type { LoombusPromptDetail } from "@/lib/loombus-prompt";

declare global {
  interface WindowEventMap {
    "loombus:prompt": CustomEvent<LoombusPromptDetail>;
  }
}

export function PlatformPromptBridge() {
  const [prompt, setPrompt] = useState<LoombusPromptDetail | null>(null);
  const close = useCallback(() => setPrompt(null), []);

  useEffect(() => {
    const handlePrompt = (event: CustomEvent<LoombusPromptDetail>) => {
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
      tone={prompt.tone ?? "info"}
      onClose={close}
      autoDismissMs={prompt.autoDismissMs}
      actionHref={prompt.actionHref}
      actionLabel={prompt.actionLabel}
      compact={prompt.compact}
    />
  );
}
