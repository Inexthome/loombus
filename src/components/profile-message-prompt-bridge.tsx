"use client";

import { useEffect, useState } from "react";
import { LoombusPrompt } from "@/components/loombus-prompt";

const PROFILE_MESSAGE_SELECTOR =
  ".profile-workspace-content form > p.text-sm.text-zinc-400";

function classifyTone(message: string) {
  const normalized = message.toLowerCase();
  if (
    /success|updated|saved|copied|discarded/.test(normalized) &&
    !/unable|failed|require|must|cannot|can't|invalid|choose|complete/.test(normalized)
  ) {
    return "success" as const;
  }
  return "error" as const;
}

export function ProfileMessagePromptBridge() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let source: HTMLElement | null = null;
    let sourceObserver: MutationObserver | null = null;

    function syncMessage() {
      const next = source?.textContent?.trim() ?? "";
      setMessage(next);
    }

    function connect() {
      const nextSource = document.querySelector<HTMLElement>(PROFILE_MESSAGE_SELECTOR);
      if (nextSource === source) return;

      sourceObserver?.disconnect();
      source = nextSource;

      if (source) {
        source.setAttribute("data-loombus-prompt-source", "true");
        syncMessage();
        sourceObserver = new MutationObserver(syncMessage);
        sourceObserver.observe(source, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
    }

    connect();
    const documentObserver = new MutationObserver(connect);
    documentObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      documentObserver.disconnect();
      sourceObserver?.disconnect();
    };
  }, []);

  if (!message) return null;

  return (
    <LoombusPrompt
      message={message}
      tone={classifyTone(message)}
      onClose={() => setMessage("")}
      autoDismissMs={7000}
    />
  );
}
