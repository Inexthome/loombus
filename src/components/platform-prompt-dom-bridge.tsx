"use client";

import { useEffect } from "react";
import { showLoombusPrompt } from "@/lib/loombus-prompt";

const feedbackSelector = [
  "[role='alert']",
  "[data-loombus-prompt]",
  "[data-error-message]",
  "[data-success-message]",
].join(",");

function readFeedback(element: Element) {
  if (element.closest("[data-loombus-prompt-ignore]")) return null;
  if (element.closest("[class*='fixed'][class*='z-[160]']")) return null;

  const message = element.textContent?.trim();
  if (!message || message.length > 420) return null;

  const explicitTone = element.getAttribute("data-loombus-prompt");
  const tone =
    explicitTone === "success" || element.hasAttribute("data-success-message")
      ? "success"
      : explicitTone === "info"
        ? "info"
        : "error";

  return { message, tone } as const;
}

export function PlatformPromptDomBridge() {
  useEffect(() => {
    const seen = new WeakMap<Element, string>();

    const inspect = (root: ParentNode) => {
      const elements = root instanceof Element && root.matches(feedbackSelector)
        ? [root]
        : [...root.querySelectorAll(feedbackSelector)];

      for (const element of elements) {
        const feedback = readFeedback(element);
        if (!feedback) continue;
        if (seen.get(element) === feedback.message) continue;
        seen.set(element, feedback.message);

        showLoombusPrompt({
          message: feedback.message,
          tone: feedback.tone,
          autoDismissMs: feedback.tone === "error" ? undefined : 6500,
        });
      }
    };

    inspect(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const parent = mutation.target.parentElement;
          if (parent) inspect(parent);
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) inspect(node);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
