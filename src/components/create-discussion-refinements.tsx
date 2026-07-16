"use client";

import { useEffect } from "react";

type ModeKey =
  | "open_discussion"
  | "debate"
  | "research_question"
  | "problem_solving";

type ModeGuidance = {
  buttonLabel: string;
  heading: string;
  summary: string;
  purposeLabel: string;
  purposePlaceholder: string;
  purposeHelp: string;
  bodyPlaceholder: string;
  bodyHelp: string;
  prompts: string[];
  template: string;
};

const MODE_GUIDANCE: Record<ModeKey, ModeGuidance> = {
  open_discussion: {
    buttonLabel: "Open Discussion",
    heading: "Open Discussion structure",
    summary:
      "Give members enough context to understand the subject, then end with a focused question or invitation.",
    purposeLabel: "Discussion Purpose",
    purposePlaceholder: "What should members explore, clarify, or contribute?",
    purposeHelp:
      "Explain the kind of thoughtful response you want from the community.",
    bodyPlaceholder:
      "Provide the background, explain why the subject matters, and state the main question you want members to discuss.",
    bodyHelp: "Include context, stakes, examples, and the main question.",
    prompts: ["Relevant context", "Why it matters", "Main question or invitation"],
    template: "Context:\n\nWhy this matters:\n\nQuestion for the community:\n",
  },
  debate: {
    buttonLabel: "Debate",
    heading: "Debate structure",
    summary:
      "Frame a clear claim and represent the competing positions fairly so replies can compare reasoning directly.",
    purposeLabel: "Debate Goal",
    purposePlaceholder: "What should the debate clarify or test?",
    purposeHelp:
      "State what a productive comparison of the two positions should accomplish.",
    bodyPlaceholder:
      "State the central claim, explain Position A and Position B fairly, and identify the evidence or reasoning members should examine.",
    bodyHelp:
      "Avoid framing one side as obviously correct before the discussion begins.",
    prompts: ["Central claim", "Position A", "Position B", "Evidence requested"],
    template:
      "Central claim:\n\nPosition A:\n\nPosition B:\n\nEvidence or reasoning requested:\n",
  },
  research_question: {
    buttonLabel: "Research Question",
    heading: "Research Question structure",
    summary:
      "Separate what is already known from what remains uncertain and invite sources, evidence, and careful qualification.",
    purposeLabel: "Research Goal",
    purposePlaceholder: "What should the research discussion help establish?",
    purposeHelp:
      "Describe the knowledge gap or uncertainty you want members to investigate.",
    bodyPlaceholder:
      "State the research question, summarize what is already known, include relevant sources, and explain what remains unresolved.",
    bodyHelp: "Distinguish evidence, assumptions, and open questions.",
    prompts: [
      "Research question",
      "What is already known",
      "Sources or evidence",
      "What remains unresolved",
    ],
    template:
      "Research question:\n\nWhat is already known:\n\nSources or evidence:\n\nWhat remains unresolved:\n",
  },
  problem_solving: {
    buttonLabel: "Problem Solving",
    heading: "Problem Solving structure",
    summary:
      "Define the practical problem, show what has already been attempted, and make the constraints and desired outcome explicit.",
    purposeLabel: "Desired Outcome",
    purposePlaceholder: "What useful result should this discussion produce?",
    purposeHelp:
      "Describe the decision, solution, or next step you hope the community can help identify.",
    bodyPlaceholder:
      "Define the problem, list attempted solutions, explain the constraints, and describe the outcome you need.",
    bodyHelp: "Concrete constraints help members propose realistic solutions.",
    prompts: ["Problem", "What has been attempted", "Constraints", "Desired outcome"],
    template:
      "Problem:\n\nWhat has been attempted:\n\nConstraints:\n\nDesired outcome:\n",
  },
};

const MODE_ENTRIES = Object.entries(MODE_GUIDANCE) as Array<
  [ModeKey, ModeGuidance]
>;

function findCreateRoot() {
  return Array.from(document.querySelectorAll<HTMLElement>("main")).find(
    (main) => main.querySelector("h1")?.textContent?.trim() === "Create Discussion"
  );
}

function findButton(root: Element, label: string) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim().startsWith(label)
  );
}

function selectedMode(root: Element): ModeKey {
  for (const [mode, guidance] of MODE_ENTRIES) {
    const button = findButton(root, guidance.buttonLabel);
    if (
      button?.className.includes("border-amber-400") ||
      button?.getAttribute("aria-pressed") === "true"
    ) {
      return mode;
    }
  }
  return "open_discussion";
}

function replaceVisibleText(element: Element, value: string) {
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      if (node.textContent.trim() !== value.trim()) node.textContent = value;
      return;
    }
  }
  element.append(document.createTextNode(value));
}

function setTextIfDifferent(element: Element | null | undefined, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}

function setControlledTextareaValue(
  textarea: HTMLTextAreaElement,
  value: string
) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}

function findPurposeInput(root: Element) {
  return Array.from(root.querySelectorAll<HTMLInputElement>("input")).find(
    (input) =>
      input.dataset.loombusPurposeInput === "true" ||
      input.placeholder.includes("hope to achieve") ||
      input.closest("label")?.textContent?.includes("Discussion Purpose")
  );
}

function findBodyTextarea(root: Element) {
  return Array.from(root.querySelectorAll<HTMLTextAreaElement>("textarea")).find(
    (textarea) =>
      textarea.dataset.loombusBodyInput === "true" ||
      textarea.placeholder.includes("Provide context")
  );
}

function ensureGuidanceCard(root: Element) {
  const existing = root.querySelector<HTMLElement>(
    '[data-loombus-mode-guidance="true"]'
  );
  if (existing) return existing;

  const modeButton = findButton(root, "Open Discussion");
  const modeSection = modeButton?.parentElement?.parentElement;
  if (!modeSection) return null;

  const card = document.createElement("section");
  card.dataset.loombusModeGuidance = "true";
  card.className =
    "rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4";

  const heading = document.createElement("h3");
  heading.dataset.loombusGuideHeading = "true";
  heading.className = "text-sm font-black text-[var(--loombus-text)]";

  const summary = document.createElement("p");
  summary.dataset.loombusGuideSummary = "true";
  summary.className =
    "mt-1 text-xs font-semibold leading-5 text-[var(--loombus-text-muted)]";

  const prompts = document.createElement("ul");
  prompts.dataset.loombusGuidePrompts = "true";
  prompts.className =
    "mt-3 grid gap-2 text-xs font-bold text-[var(--loombus-text-muted)] sm:grid-cols-2";

  const insert = document.createElement("button");
  insert.type = "button";
  insert.dataset.loombusInsertStructure = "true";
  insert.className =
    "mt-4 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-2 text-xs font-black text-[var(--loombus-text)] transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50";
  insert.textContent = "Use this structure";

  card.append(heading, summary, prompts, insert);
  modeSection.insertAdjacentElement("afterend", card);
  return card;
}

function renameDraftTools(root: Element) {
  for (const heading of Array.from(root.querySelectorAll("h2"))) {
    if (heading.textContent?.includes("AI draft tools")) {
      replaceVisibleText(heading, "Draft Guidance");
    }
  }

  for (const paragraph of Array.from(root.querySelectorAll("p"))) {
    if (
      paragraph.textContent?.includes(
        "Check discussion quality or get AI clarity suggestions"
      )
    ) {
      paragraph.textContent =
        "Check discussion quality or improve its structure before review. Guidance never replaces your typed body.";
    }
  }

  for (const button of Array.from(root.querySelectorAll("button"))) {
    const text = button.textContent?.trim();
    if (text === "Discussion quality check") {
      replaceVisibleText(button, "Check discussion quality");
    } else if (text === "Clarity suggestions") {
      replaceVisibleText(button, "Improve structure");
    }
  }
}

function ensureAttachmentNotice(root: Element) {
  if (root.querySelector('[data-loombus-attachment-draft-notice="true"]')) {
    return;
  }

  const heading = Array.from(root.querySelectorAll("p")).find((paragraph) =>
    paragraph.textContent?.trim().startsWith("Attach supporting context")
  );
  if (!heading) return;

  const notice = document.createElement("p");
  notice.dataset.loombusAttachmentDraftNotice = "true";
  notice.className =
    "mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100";
  notice.textContent =
    "Attachments are staged on this device and are not retained if you refresh or leave this page.";
  heading.insertAdjacentElement("afterend", notice);
}

function applyMode(root: Element) {
  const mode = selectedMode(root);
  const guidance = MODE_GUIDANCE[mode];
  const card = ensureGuidanceCard(root);
  const purpose = findPurposeInput(root);
  const body = findBodyTextarea(root);

  if (card && card.dataset.loombusSelectedMode !== mode) {
    card.dataset.loombusSelectedMode = mode;
    setTextIfDifferent(
      card.querySelector('[data-loombus-guide-heading="true"]'),
      guidance.heading
    );
    setTextIfDifferent(
      card.querySelector('[data-loombus-guide-summary="true"]'),
      guidance.summary
    );

    const promptList = card.querySelector<HTMLElement>(
      '[data-loombus-guide-prompts="true"]'
    );
    if (promptList) {
      promptList.replaceChildren(
        ...guidance.prompts.map((prompt) => {
          const item = document.createElement("li");
          item.className =
            "rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-2";
          item.textContent = prompt;
          return item;
        })
      );
    }
  }

  if (purpose) {
    purpose.dataset.loombusPurposeInput = "true";
    purpose.placeholder = guidance.purposePlaceholder;
    const label = purpose.closest("label");
    const labelText = label?.querySelector("span");
    const help = label?.querySelector("p");
    if (labelText) replaceVisibleText(labelText, `${guidance.purposeLabel} `);
    setTextIfDifferent(help, guidance.purposeHelp);
  }

  if (body) {
    body.dataset.loombusBodyInput = "true";
    body.placeholder = guidance.bodyPlaceholder;
    setTextIfDifferent(body.closest("label")?.querySelector("p"), guidance.bodyHelp);
  }

  const insert = card?.querySelector<HTMLButtonElement>(
    '[data-loombus-insert-structure="true"]'
  );
  if (insert && body) {
    insert.disabled = body.value.trim().length > 0;
    insert.title = insert.disabled
      ? "Clear the body before inserting a structure."
      : `Insert the ${guidance.buttonLabel} structure into the body.`;
    insert.onclick = () => {
      if (body.value.trim()) return;
      setControlledTextareaValue(body, guidance.template);
      insert.disabled = true;
    };
  }
}

export function CreateDiscussionRefinements() {
  useEffect(() => {
    const root = findCreateRoot();
    if (!root) return;

    const apply = () => {
      renameDraftTools(root);
      ensureAttachmentNotice(root);
      applyMode(root);
    };

    const handleClick = (event: Event) => {
      const button = (event.target as Element | null)?.closest("button");
      if (
        button &&
        MODE_ENTRIES.some(([, guidance]) =>
          button.textContent?.trim().startsWith(guidance.buttonLabel)
        )
      ) {
        window.setTimeout(apply, 0);
      }
    };

    const handleInput = (event: Event) => {
      if (event.target instanceof HTMLTextAreaElement) applyMode(root);
    };

    root.addEventListener("click", handleClick, true);
    root.addEventListener("input", handleInput, true);
    apply();
    const hydrationTimer = window.setTimeout(apply, 800);

    return () => {
      window.clearTimeout(hydrationTimer);
      root.removeEventListener("click", handleClick, true);
      root.removeEventListener("input", handleInput, true);
    };
  }, []);

  return null;
}
