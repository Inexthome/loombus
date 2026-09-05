"use client";

import { useEffect } from "react";

type WorkspaceMode = "state" | "intelligence" | "points" | "evidence" | "reply";

const TOOLTIP_ATTR = "data-loombus-editorial-tooltip";

const TOOLTIP_COPY: Record<WorkspaceMode, string> = {
  state:
    "Understand the thread without replacing it. Loombus intelligence organizes the conversation while keeping the original post and replies visible.",
  intelligence:
    "Understand how the conversation is developing. Loombus ranks representative responses across the full discussion, then organizes major points, tensions, sourcing pressure, changed views, and unresolved questions.",
  points:
    "Conversations forming inside the conversation. Responses that develop their own branches are surfaced here so important sub-conversations are easier to find.",
  evidence:
    "Responses members are asking others to substantiate. Evidence signals surface the contributions that deserve closer sourcing and verification.",
  reply:
    "Write a reply that moves the discussion forward. Respond to the claim, add evidence, ask a precise question, or identify the next useful step.",
};

const AI_TOOL_COPY: Record<string, string> = {
  Overview: "Compress the discussion without flattening the important context.",
  "Key takeaways": "Surface the strongest conclusions, evidence, and unresolved questions.",
  "What changed": "See how the conversation evolved from the opening post to the latest replies.",
  Disagreement: "Separate genuine disagreement from different assumptions or definitions.",
  Structure: "Trace the major claims, supporting points, counterpoints, and branches.",
  "Related ideas": "Find adjacent questions and concepts worth carrying into another discussion.",
};

function ensureNamedTooltip(target: HTMLElement | null, key: string, label: string, copy: string) {
  if (!target) return;

  let trigger = target.querySelector<HTMLButtonElement>(`:scope > [${TOOLTIP_ATTR}='${key}']`);
  if (!trigger) {
    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "discussion-editorial-heading-help";
    trigger.setAttribute(TOOLTIP_ATTR, key);
    trigger.setAttribute("aria-label", `About ${label}`);

    const mark = document.createElement("span");
    mark.className = "discussion-editorial-heading-help-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "i";

    trigger.append(mark);
    target.append(trigger);
  }

  const tooltipId = `discussion-${key}-heading-help`;
  trigger.setAttribute("aria-describedby", tooltipId);

  let tooltip = trigger.querySelector<HTMLElement>(".discussion-editorial-heading-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("span");
    tooltip.id = tooltipId;
    tooltip.className = "discussion-editorial-heading-tooltip";
    tooltip.setAttribute("role", "tooltip");
    trigger.append(tooltip);
  }

  if (tooltip.textContent !== copy) tooltip.textContent = copy;
}

function ensureTooltip(target: HTMLElement | null, mode: WorkspaceMode, label: string) {
  ensureNamedTooltip(target, mode, label, TOOLTIP_COPY[mode]);
}

function removeVisibleCopy(container: HTMLElement | null) {
  if (!container) return;
  container.querySelector(":scope > h2")?.remove();
  container.querySelector(":scope > p:not(.discussion-v2-eyebrow)")?.remove();
}

function cleanActiveAiToolDescription() {
  const heading = document.querySelector<HTMLElement>(
    ".discussion-v2-ai-output-heading > div"
  );
  if (!heading) return;

  const title = heading.querySelector<HTMLElement>(":scope > h3");
  const label = title?.childNodes[0]?.textContent?.trim() || title?.textContent?.trim() || "";
  const copy = AI_TOOL_COPY[label];
  if (!title || !copy) return;

  heading.querySelector(":scope > p:last-child")?.remove();
  const key = `ai-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  ensureNamedTooltip(title, key, label, copy);
}

export function DiscussionEditorialCopyCleanup() {
  useEffect(() => {
    let scheduled = false;

    const apply = () => {
      scheduled = false;

      const stateHeading = document.querySelector<HTMLElement>(
        "#discussion-intelligence .discussion-v2-section-heading > div"
      );
      removeVisibleCopy(stateHeading);
      ensureTooltip(
        stateHeading?.querySelector<HTMLElement>(":scope > .discussion-v2-eyebrow") ?? null,
        "state",
        "State of the discussion"
      );

      const intelligenceHeading = document.querySelector<HTMLElement>(
        "[data-phase-five-intelligence-host='true'] .discussion-phase-five-heading > div"
      );
      removeVisibleCopy(intelligenceHeading);
      ensureTooltip(
        intelligenceHeading?.querySelector<HTMLElement>(":scope > .discussion-phase-five-eyebrow") ?? null,
        "intelligence",
        "Conversation intelligence"
      );

      const pointsHeading = document.querySelector<HTMLElement>(
        "#discussion-major-points .discussion-phase-four-panel-heading"
      );
      removeVisibleCopy(pointsHeading);
      ensureTooltip(
        pointsHeading?.querySelector<HTMLElement>(":scope > span") ?? null,
        "points",
        "Points"
      );

      const evidenceHeading = document.querySelector<HTMLElement>(
        "#discussion-evidence .discussion-phase-four-panel-heading"
      );
      removeVisibleCopy(evidenceHeading);
      ensureTooltip(
        evidenceHeading?.querySelector<HTMLElement>(":scope > span") ?? null,
        "evidence",
        "Evidence"
      );

      const replyHeading = document.querySelector<HTMLElement>(
        ".discussion-v2-composer-card .discussion-v2-section-heading > div"
      );
      removeVisibleCopy(replyHeading);
      ensureTooltip(
        replyHeading?.querySelector<HTMLElement>(":scope > .discussion-v2-eyebrow") ?? null,
        "reply",
        "Reply"
      );

      cleanActiveAiToolDescription();
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(apply);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();

    return () => observer.disconnect();
  }, []);

  return null;
}
