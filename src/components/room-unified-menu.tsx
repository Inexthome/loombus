"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ProxyItem = {
  key: string;
  label: string;
  active: boolean;
  kind: "module" | "tool";
};

const TOOL_LABELS = [
  "Room Operations",
  "Report Room Content",
  "Room Studio",
  "Organization Console",
] as const;

function cleanLabel(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function recognizedToolLabel(value: string | null | undefined) {
  const cleaned = cleanLabel(value);
  const known = TOOL_LABELS.find((label) => cleaned.startsWith(label));
  if (known) return known;
  return cleaned.endsWith(" Organization") ? cleaned : "";
}

function tierButtons() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      "[data-loombus-tier-navigation='true'] button"
    )
  );
}

function toolControls() {
  const shell = document.querySelector<HTMLElement>(
    ".rooms-live-page .rooms-live-shell"
  );
  if (!shell) return [] as Array<HTMLButtonElement | HTMLAnchorElement>;

  return Array.from(
    shell.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>("button, a")
  ).filter((control) => Boolean(recognizedToolLabel(control.textContent)));
}

function itemKey(kind: ProxyItem["kind"], label: string) {
  return `${kind}:${label.toLowerCase()}`;
}

function itemsMatch(current: ProxyItem[], next: ProxyItem[]) {
  return (
    current.length === next.length &&
    current.every(
      (item, index) =>
        item.key === next[index]?.key &&
        item.label === next[index]?.label &&
        item.active === next[index]?.active &&
        item.kind === next[index]?.kind
    )
  );
}

export function RoomUnifiedMenu() {
  const [items, setItems] = useState<ProxyItem[]>([]);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [settled, setSettled] = useState(false);

  const sync = useCallback(() => {
    const next: ProxyItem[] = [];
    const seen = new Set<string>();

    for (const [index, button] of tierButtons().entries()) {
      const label = cleanLabel(button.textContent);
      if (!label || index <= 2) continue;
      const key = itemKey("module", label);
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({
        key,
        label,
        active: button.getAttribute("aria-pressed") === "true",
        kind: "module",
      });
    }

    for (const control of toolControls()) {
      const label = recognizedToolLabel(control.textContent);
      const key = itemKey("tool", label);
      if (!label || seen.has(key)) continue;
      seen.add(key);
      next.push({
        key,
        label,
        active:
          control.getAttribute("aria-expanded") === "true" ||
          control.getAttribute("aria-pressed") === "true",
        kind: "tool",
      });
    }

    setItems((current) => (itemsMatch(current, next) ? current : next));
    setModuleOpen(
      Boolean(
        document.querySelector(
          ".rooms-live-shell.is-room-tier-module-active"
        )
      )
    );
  }, []);

  useEffect(() => {
    let frame = 0;
    const settleTimer = window.setTimeout(() => setSettled(true), 2500);
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-pressed", "aria-expanded", "class", "hidden"],
    });

    return () => {
      observer.disconnect();
      window.clearTimeout(settleTimer);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sync]);

  const activate = useCallback((item: ProxyItem) => {
    const candidates =
      item.kind === "module" ? tierButtons() : toolControls();
    const target = candidates.find((candidate) => {
      const label =
        item.kind === "module"
          ? cleanLabel(candidate.textContent)
          : recognizedToolLabel(candidate.textContent);
      return label === item.label;
    });
    target?.click();
  }, []);

  const closeModule = useCallback(() => {
    const target = tierButtons().find((button) =>
      cleanLabel(button.textContent).toLowerCase().includes("discussion")
    );
    target?.click();
  }, []);

  return (
    <>
      {items.length > 0 || !settled ? (
        <nav className="room-unified-menu" aria-label="Room modules">
          <p>Modules</p>
          {items.length > 0 ? (
            items.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-current={item.active ? "page" : undefined}
                onClick={() => activate(item)}
              >
                <span>{item.label}</span>
              </button>
            ))
          ) : (
            <span className="room-unified-menu-loading">
              Loading Room modules…
            </span>
          )}
        </nav>
      ) : null}

      {moduleOpen ? (
        <button
          type="button"
          className="room-module-overlay-close"
          onClick={closeModule}
          aria-label="Close Room module and return to Discussions"
        >
          <X aria-hidden="true" />
          <span>Back to discussions</span>
        </button>
      ) : null}
    </>
  );
}
