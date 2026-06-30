"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect } from "react";

const REPLY_STARTERS = [
  {
    label: "Clarify claim",
    title: "Ask the author to make the main point clearer.",
  },
  {
    label: "Ask example",
    title: "Request a concrete example before debating the point.",
  },
  {
    label: "Ask source",
    title: "Ask for evidence, source, or context behind the claim.",
  },
];

const HELP_COPY: Record<string, string> = {
  "State of the discussion":
    "This panel shows the thread status, replies, saves, views, and reader activity so you can understand the discussion before replying.",
  "AI Tools":
    "AI tools help Premium users summarize the thread, extract key takeaways, map disagreements, understand conversation structure, and find related ideas. They do not replace the original discussion.",
};

function isDiscussionDetailPath(pathname: string | null) {
  if (!pathname?.startsWith("/v2/discussions/")) return false;
  return pathname.split("/").filter(Boolean).length === 3;
}

function hideLegacyV1Links() {
  document.querySelectorAll<HTMLAnchorElement>('a[href^="/discussions/"]').forEach((link) => {
    if (link.textContent?.trim().toLowerCase() === "open v1 page") {
      link.remove();
    }
  });
}

function labelReplyStarters() {
  const replyForm = document.getElementById("v2-reply-form");
  if (!replyForm) return;

  const promptButtons = Array.from(replyForm.querySelectorAll<HTMLButtonElement>("button")).filter(
    (button) => button.textContent?.trim() === "Prompt"
  );

  promptButtons.forEach((button, index) => {
    const starter = REPLY_STARTERS[index];
    if (!starter) return;

    button.textContent = starter.label;
    button.title = starter.title;
    button.setAttribute("aria-label", `${starter.label}: ${starter.title}`);
  });
}

function activateHelpIcons() {
  for (const [headingText, helpText] of Object.entries(HELP_COPY)) {
    const heading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find(
      (node) => node.textContent?.trim() === headingText
    );

    const container = heading?.parentElement;
    if (!container || container.dataset.helpActivated === "true") continue;

    const icon = container.querySelector<HTMLElement>("svg");
    if (!icon) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "rounded-full p-1 text-slate-400 transition hover:bg-slate-50 hover:text-amber-800";
    button.setAttribute("aria-label", `Explain ${headingText}`);
    button.setAttribute("aria-expanded", "false");

    icon.replaceWith(button);
    button.appendChild(icon);

    const panel = document.createElement("div");
    panel.className =
      "mt-3 hidden rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900";
    panel.textContent = helpText;

    const section = container.closest("section");
    section?.insertBefore(panel, container.nextSibling);

    button.addEventListener("click", () => {
      const isHidden = panel.classList.toggle("hidden");
      button.setAttribute("aria-expanded", String(!isHidden));
    });

    container.dataset.helpActivated = "true";
  }
}

function applyPolish() {
  hideLegacyV1Links();
  labelReplyStarters();
  activateHelpIcons();
}

export function DiscussionDetailRuntimePolish({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!isDiscussionDetailPath(pathname)) return;

    applyPolish();
    const observer = new MutationObserver(() => applyPolish());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname]);

  return <>{children}</>;
}
