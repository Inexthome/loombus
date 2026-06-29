"use client";

import { useEffect } from "react";

const AI_SUGGESTION_NOTE_ID = "loombus-create-ai-suggestion-note";

function setLinkText(link: HTMLAnchorElement, text: string) {
  const icon = link.querySelector("svg")?.cloneNode(true);
  link.textContent = "";
  if (icon) link.appendChild(icon);
  link.append(` ${text}`);
}

export default function CreatePublicPolish() {
  useEffect(() => {
    const publishLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href="/v2/create/review"]'));

    for (const link of publishLinks) {
      if (/review draft/i.test(link.textContent ?? "")) {
        setLinkText(link, "Publish");
        link.setAttribute("aria-label", "Publish discussion");
      }
    }

    const rewriteButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => /rewrite for clarity/i.test(button.textContent ?? ""));

    if (!rewriteButton) return;

    rewriteButton.textContent = "Clarity suggestions";
    rewriteButton.title = "Suggestions only. This will not rewrite your typed discussion body.";
    rewriteButton.setAttribute("aria-label", "Get clarity suggestions");

    const stopRewrite = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const section = rewriteButton.closest("section");
      if (!section || section.querySelector(`#${AI_SUGGESTION_NOTE_ID}`)) return;

      const note = document.createElement("p");
      note.id = AI_SUGGESTION_NOTE_ID;
      note.className = "mt-3 text-xs font-bold text-amber-950";
      note.textContent = "AI clarity tools are being audited for Premium suggestions only. Your typed discussion body was not changed.";
      section.appendChild(note);
    };

    rewriteButton.addEventListener("click", stopRewrite, { capture: true });
    return () => rewriteButton.removeEventListener("click", stopRewrite, { capture: true });
  }, []);

  return null;
}
