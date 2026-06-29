"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";

const AI_OUTPUT_ID = "loombus-create-ai-suggestion-output";
const WIRED_ATTR = "data-loombus-ai-wired";
const REVIEW_CTA_ATTR = "data-loombus-review-cta-restored";

function setTextWithOptionalIcon(element: HTMLElement, text: string) {
  const icon = element.querySelector("svg")?.cloneNode(true);
  element.textContent = "";
  if (icon) element.appendChild(icon);
  element.append(` ${text}`);
}

function restoreReviewDraftButton(publishLink: HTMLAnchorElement) {
  if (publishLink.getAttribute(REVIEW_CTA_ATTR) === "true") return;
  publishLink.setAttribute(REVIEW_CTA_ATTR, "true");

  const reviewLink = publishLink.cloneNode(true) as HTMLAnchorElement;
  reviewLink.removeAttribute(REVIEW_CTA_ATTR);
  reviewLink.setAttribute("aria-label", "Review draft");
  reviewLink.className = "rounded-2xl border border-slate-200 px-4 py-2 text-center text-sm font-black text-amber-800 transition hover:border-amber-300 hover:bg-amber-50";
  reviewLink.removeAttribute("style");
  setTextWithOptionalIcon(reviewLink, "Review draft");

  publishLink.parentElement?.insertBefore(reviewLink, publishLink);
}

function getCreateValues() {
  const textInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')).filter((input) => !input.closest('[hidden]'));
  const title = textInputs[0]?.value?.trim() ?? "";
  const body = document.querySelector<HTMLTextAreaElement>("textarea")?.value?.trim() ?? "";
  const topic = DISCUSSION_TOPICS.find((candidate) => {
    return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some((button) => button.textContent?.trim() === candidate);
  }) ?? "";

  return { title, topic, body };
}

function findAiSection(button: HTMLButtonElement) {
  return button.closest("section") as HTMLElement | null;
}

function writeAiOutput(section: HTMLElement, title: string, message: string, body?: string) {
  let output = section.querySelector<HTMLDivElement>(`#${AI_OUTPUT_ID}`);
  if (!output) {
    output = document.createElement("div");
    output.id = AI_OUTPUT_ID;
    output.className = "mt-3 rounded-2xl border border-amber-200 bg-white p-4 text-xs leading-6 text-slate-700 shadow-sm";
    section.appendChild(output);
  }

  output.innerHTML = "";

  const heading = document.createElement("p");
  heading.className = "font-black text-amber-900";
  heading.textContent = title;
  output.appendChild(heading);

  const note = document.createElement("p");
  note.className = "mt-1 font-semibold text-slate-600";
  note.textContent = message;
  output.appendChild(note);

  if (body?.trim()) {
    const pre = document.createElement("pre");
    pre.className = "mt-3 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 font-sans text-xs leading-6 text-slate-800";
    pre.textContent = body.trim();
    output.appendChild(pre);
  }
}

async function runAiSuggestion(kind: "quality" | "rewrite", section: HTMLElement) {
  const values = getCreateValues();

  if (!values.title || !values.body || values.body.length < 8) {
    writeAiOutput(section, "Add more context first", "Enter a clear title and at least a short body before using AI suggestions.");
    return;
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    window.location.href = "/login";
    return;
  }

  writeAiOutput(section, kind === "quality" ? "Checking discussion quality..." : "Generating clarity suggestions...", "Your typed discussion body will not be replaced.");

  try {
    const response = await fetch(kind === "quality" ? "/api/discussions/quality-check" : "/api/discussions/rewrite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(values),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      writeAiOutput(section, "AI suggestions unavailable", result.error ?? "Unable to run this AI tool right now.");
      return;
    }

    if (kind === "quality") {
      writeAiOutput(section, "Discussion quality suggestions", "Review these suggestions before publishing. Your typed body was not changed.", result.qualityCheck ?? "No quality suggestions returned.");
      return;
    }

    writeAiOutput(section, "Clarity suggestions", "This is a suggested clearer version only. Your typed discussion body was not changed.", result.rewrite ?? "No clarity suggestion returned.");
  } catch {
    writeAiOutput(section, "AI suggestions unavailable", "Unable to reach the AI suggestion service right now.");
  }
}

function wireButton(button: HTMLButtonElement, kind: "quality" | "rewrite") {
  if (button.getAttribute(WIRED_ATTR) === kind) return;
  button.setAttribute(WIRED_ATTR, kind);

  if (kind === "rewrite") {
    setTextWithOptionalIcon(button, "Clarity suggestions");
    button.title = "Suggestions only. This will not rewrite your typed discussion body.";
    button.setAttribute("aria-label", "Get clarity suggestions");
  }

  button.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const section = findAiSection(button);
      if (!section) return;

      void runAiSuggestion(kind, section);
    },
    { capture: true }
  );
}

function applyCreatePolish() {
  for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href="/v2/create/review"]'))) {
    if (/review draft/i.test(link.textContent ?? "")) {
      restoreReviewDraftButton(link);
      setTextWithOptionalIcon(link, "Publish");
      link.setAttribute("aria-label", "Publish discussion");
    }
  }

  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const qualityButton = buttons.find((button) => /discussion quality check/i.test(button.textContent ?? ""));
  const rewriteButton = buttons.find((button) => /rewrite for clarity|clarity suggestions/i.test(button.textContent ?? ""));

  if (qualityButton) wireButton(qualityButton, "quality");
  if (rewriteButton) wireButton(rewriteButton, "rewrite");

  const aiSection = rewriteButton?.closest("section") ?? qualityButton?.closest("section");
  const description = Array.from(aiSection?.querySelectorAll<HTMLParagraphElement>("p") ?? []).find((paragraph) => /rewrite the body/i.test(paragraph.textContent ?? ""));
  if (description) {
    description.textContent = "Check discussion quality or get AI clarity suggestions before review. Suggestions never replace your typed body.";
  }
}

export default function CreatePublicPolish() {
  useEffect(() => {
    applyCreatePolish();
    const observer = new MutationObserver(applyCreatePolish);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
