"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ROOM_FEATURE_CLOSED_EVENT,
  ROOM_OPEN_FEATURE_EVENT,
  type RoomFeatureLaunch,
} from "@/components/room-feature-events";

const CORE_COMPATIBILITY_LABELS = [
  "Overview",
  "Discussions",
  "Calendar",
  "Announcements",
  "Members",
];

function normalizedText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function createCompatibilityNavigation(shell: HTMLElement) {
  const existing = shell.querySelector<HTMLElement>(
    ".room-workspace-tabs:not([data-loombus-tier-navigation='true'])"
  );
  if (existing) return existing;

  const navigation = document.createElement("nav");
  navigation.className = "room-workspace-tabs room-feature-compatibility-tabs";
  navigation.dataset.loombusRoomCompatibilityNavigation = "true";
  navigation.setAttribute("aria-hidden", "true");

  for (const label of CORE_COMPATIBILITY_LABELS) {
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.textContent = label;
    navigation.appendChild(button);
  }

  shell.prepend(navigation);
  return navigation;
}

function synchronizeCompatibilityNavigation() {
  document
    .querySelectorAll<HTMLElement>(".rooms-live-page .rooms-live-shell")
    .forEach(createCompatibilityNavigation);
}

function findButton(selector: string, label?: string) {
  const expected = normalizedText(label);
  return Array.from(document.querySelectorAll<HTMLButtonElement>(selector)).find(
    (button) => {
      if (!expected) return true;
      const current = normalizedText(button.textContent);
      return current === expected || current.startsWith(expected);
    }
  );
}

async function waitForButton(selector: string, label?: string, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const button = findButton(selector, label);
    if (button) return button;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  return null;
}

function dispatchClosed(id: string) {
  window.dispatchEvent(
    new CustomEvent(ROOM_FEATURE_CLOSED_EVENT, { detail: { id } })
  );
}

export function RoomFeatureBridge() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [activeTierFeature, setActiveTierFeature] =
    useState<Extract<RoomFeatureLaunch, { kind: "module" }> | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const activeTierRef = useRef(activeTierFeature);

  useEffect(() => {
    activeTierRef.current = activeTierFeature;
  }, [activeTierFeature]);

  useEffect(() => {
    setMounted(true);
    let scheduled = false;
    const synchronize = () => {
      scheduled = false;
      synchronizeCompatibilityNavigation();
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(synchronize);
    };

    synchronize();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document
        .querySelectorAll("[data-loombus-room-compatibility-navigation='true']")
        .forEach((node) => node.remove());
    };
  }, []);

  const closeTierFeature = useCallback((restoreFocus = true) => {
    const current = activeTierRef.current;
    const overviewButton = findButton(
      "[data-loombus-tier-navigation='true'] button",
      "Overview"
    );
    overviewButton?.click();
    activeTierRef.current = null;
    setActiveTierFeature(null);
    document.body.classList.remove("room-tier-overlay-open");
    if (current) dispatchClosed(current.id);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    const openFeature = async (event: Event) => {
      const detail = (event as CustomEvent<RoomFeatureLaunch>).detail;
      if (!detail?.id) return;
      triggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (activeTierRef.current) closeTierFeature(false);
      synchronizeCompatibilityNavigation();

      if (detail.kind === "module") {
        const button = await waitForButton(
          "[data-loombus-tier-navigation='true'] button",
          detail.label
        );
        if (!button) {
          dispatchClosed(detail.id);
          return;
        }
        button.click();
        activeTierRef.current = detail;
        setActiveTierFeature(detail);
        document.body.classList.add("room-tier-overlay-open");
        return;
      }

      let button: HTMLButtonElement | null = null;
      if (detail.kind === "foundation") {
        button = await waitForButton(
          detail.panel === "search"
            ? ".room-foundation-search-trigger"
            : ".room-foundation-inbox-trigger"
        );
      } else if (detail.kind === "studio") {
        button = await waitForButton(
          "[data-loombus-room-expansion-host='true'] button",
          "Room Studio"
        );
      } else if (detail.kind === "organization") {
        button = await waitForButton(
          "[data-loombus-room-expansion-host='true'] button",
          "Organization Console"
        );
      } else if (detail.kind === "operations") {
        button = await waitForButton(".room-operations-trigger");
      }

      button?.click();
      dispatchClosed(detail.id);
    };

    window.addEventListener(ROOM_OPEN_FEATURE_EVENT, openFeature as EventListener);
    return () =>
      window.removeEventListener(ROOM_OPEN_FEATURE_EVENT, openFeature as EventListener);
  }, [closeTierFeature]);

  useEffect(() => {
    if (!activeTierFeature) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeTierFeature();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeTierFeature, closeTierFeature]);

  useEffect(() => {
    if (activeTierRef.current) closeTierFeature(false);
  }, [closeTierFeature, pathname]);

  useEffect(
    () => () => {
      document.body.classList.remove("room-tier-overlay-open");
    },
    []
  );

  if (!mounted || !activeTierFeature) return null;

  return createPortal(
    <div className="room-tier-overlay-chrome" role="presentation">
      <button
        type="button"
        className="room-tier-overlay-backdrop"
        aria-label={`Close ${activeTierFeature.label}`}
        onClick={() => closeTierFeature()}
      />
      <div className="room-tier-overlay-label" aria-hidden="true">
        {activeTierFeature.label}
      </div>
      <button
        type="button"
        className="room-tier-overlay-close"
        aria-label={`Close ${activeTierFeature.label}`}
        onClick={() => closeTierFeature()}
      >
        <X aria-hidden="true" />
      </button>
    </div>,
    document.body
  );
}
