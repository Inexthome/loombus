"use client";

import { useEffect } from "react";

const URL_PATTERN =
  /\b(?:(?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?:\/[^\s<>"']*)?)/gi;
const EXCLUDED_ANCESTORS =
  "a, button, input, textarea, select, option, code, pre, script, style, [contenteditable='true']";

function countCharacter(value: string, character: string) {
  return [...value].filter((candidate) => candidate === character).length;
}

function splitTrailingPunctuation(rawValue: string) {
  let urlText = rawValue;
  let trailing = "";

  while (urlText && ".,!?;:".includes(urlText.at(-1) ?? "")) {
    trailing = `${urlText.at(-1)}${trailing}`;
    urlText = urlText.slice(0, -1);
  }

  const pairedClosers: Array<[string, string]> = [
    [")", "("],
    ["]", "["],
    ["}", "{"],
  ];

  for (const [closer, opener] of pairedClosers) {
    while (
      urlText.endsWith(closer) &&
      countCharacter(urlText, closer) > countCharacter(urlText, opener)
    ) {
      trailing = `${closer}${trailing}`;
      urlText = urlText.slice(0, -1);
    }
  }

  return { urlText, trailing };
}

function createSafeAnchor(urlText: string) {
  const normalized = /^https?:\/\//i.test(urlText)
    ? urlText
    : `https://${urlText}`;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const anchor = document.createElement("a");
    anchor.href = parsed.href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer nofollow ugc";
    anchor.textContent = urlText;
    anchor.dataset.loombusAutoLinked = "true";
    anchor.className =
      "break-words font-semibold text-[#b45309] underline decoration-[#b45309]/40 underline-offset-2 transition hover:text-[#92400e] focus:outline-none focus:ring-2 focus:ring-[#b45309]/50 dark:text-amber-300 dark:hover:text-amber-200";
    return anchor;
  } catch {
    return null;
  }
}

function linkifyTextNode(node: Text) {
  const parent = node.parentElement;
  const value = node.nodeValue;

  if (!parent || !value || parent.closest(EXCLUDED_ANCESTORS)) {
    return;
  }

  URL_PATTERN.lastIndex = 0;
  if (!URL_PATTERN.test(value)) {
    return;
  }

  URL_PATTERN.lastIndex = 0;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let changed = false;

  for (const match of value.matchAll(URL_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const rawValue = match[0];

    if (matchIndex > 0 && value[matchIndex - 1] === "@") {
      continue;
    }

    const { urlText, trailing } = splitTrailingPunctuation(rawValue);
    const anchor = createSafeAnchor(urlText);
    if (!anchor) continue;

    fragment.append(value.slice(lastIndex, matchIndex));
    fragment.append(anchor);
    if (trailing) fragment.append(trailing);
    lastIndex = matchIndex + rawValue.length;
    changed = true;
  }

  if (!changed) return;

  fragment.append(value.slice(lastIndex));
  node.parentNode?.replaceChild(fragment, node);
}

function linkifyRoot(root: Node) {
  if (root instanceof Text) {
    linkifyTextNode(root);
    return;
  }

  if (!(root instanceof Element) || root.matches(EXCLUDED_ANCESTORS)) {
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode instanceof Text) {
      textNodes.push(currentNode);
    }
    currentNode = walker.nextNode();
  }

  for (const textNode of textNodes) {
    linkifyTextNode(textNode);
  }
}

export function DiscussionAutoLinker() {
  useEffect(() => {
    const root = document.querySelector(".discussion-feed-route");
    if (!root) return;

    linkifyRoot(root);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") {
          linkifyRoot(record.target);
          continue;
        }

        for (const node of record.addedNodes) {
          linkifyRoot(node);
        }
      }
    });

    observer.observe(root, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
