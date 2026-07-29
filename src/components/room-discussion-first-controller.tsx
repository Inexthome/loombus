"use client";

import { useLayoutEffect } from "react";

function labelOf(element: Element) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function originalDiscussionButton() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".rooms-live-shell .room-workspace-tabs:not([data-loombus-tier-navigation='true']) button"
    )
  ).find((button) => labelOf(button) === "discussions");
}

function tierDiscussionButton() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      "[data-loombus-tier-navigation='true'] button"
    )
  ).find((button) => labelOf(button).includes("discussion"));
}

export function RoomDiscussionFirstController() {
  useLayoutEffect(() => {
    let completed = false;
    let frame = 0;
    let fallback = 0;

    const markReady = () => {
      document
        .querySelector<HTMLElement>(".rooms-live-page .rooms-live-shell")
        ?.setAttribute("data-room-discussion-ready", "true");
    };

    const activate = () => {
      if (completed) return;

      const original = originalDiscussionButton();
      if (original && original.getAttribute("aria-pressed") !== "true") {
        original.click();
      }

      const tier = tierDiscussionButton();
      if (!tier) return;

      if (tier.getAttribute("aria-pressed") !== "true") tier.click();
      completed = true;
      window.requestAnimationFrame(markReady);
    };

    const schedule = () => {
      if (frame || completed) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        activate();
      });
    };

    activate();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-pressed", "class"],
    });

    fallback = window.setTimeout(() => {
      completed = true;
      markReady();
    }, 2500);

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, []);

  return null;
}
