"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ProxyItem = {
  key: string;
  label: string;
  active: boolean;
  kind: "module" | "tool";
};

const TOOL_LABELS = new Set([
  "Room Operations",
  "Report Room Content",
  "Room Studio",
  "Organization Console",
]);

function cleanLabel(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
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
  ).filter((control) => {
    const label = cleanLabel(control.textContent);
    return TOOL_LABELS.has(label) || label.endsWith(" Organization");
  });
}

function itemKey(kind: ProxyItem["kind"], label: string) {
  return `${kind}:${label.toLowerCase()}`;
}

export function RoomUnifiedMenu() {
  const [items, setItems] = useState<ProxyItem[]>([]);
  const [moduleOpen, setModuleOpen] = useState(false);

  const sync = useCallback(() => {
    const next: ProxyItem[] = [];
    const seen = new Set<string>();

    for (const button of tierButtons()) {
      const label = cleanLabel(button.textContent);
      if (!label || label.toLowerCase() === "overview") continue;
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
      const label = cleanLabel(control.textContent);
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

    setItems(next);
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
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sync]);

  const discussionLabel = useMemo(
    () =>
      items.find(
        (item) =>
          item.kind === "module" &&
          item.label.toLowerCase().includes("discussion")
      )?.label ?? "Discussions",
    [items]
  );

  const activate = useCallback((item: ProxyItem) => {
    const candidates =
      item.kind === "module" ? tierButtons() : toolControls();
    const target = candidates.find(
      (candidate) => cleanLabel(candidate.textContent) === item.label
    );
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
      <nav className="room-unified-menu" aria-label="Room menu">
        <p>Room menu</p>
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
          <span className="room-unified-menu-loading">Loading Room menu…</span>
        )}
      </nav>

      {moduleOpen ? (
        <button
          type="button"
          className="room-module-overlay-close"
          onClick={closeModule}
          aria-label={`Close Room module and return to ${discussionLabel}`}
        >
          <X aria-hidden="true" />
          <span>Back to discussions</span>
        </button>
      ) : null}
    </>
  );
}
