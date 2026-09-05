"use client";

import { useEffect, useRef, useState } from "react";

type MobileDiscussionAction = "reply" | "save" | "share" | "more";

function triggerOriginalAction(action: MobileDiscussionAction) {
  const bar = document.querySelector<HTMLElement>(".discussion-v2-mobile-bar");
  if (!bar) return;

  const buttons = Array.from(bar.querySelectorAll<HTMLButtonElement>("button"));
  let target: HTMLButtonElement | undefined;

  if (action === "reply") {
    target = buttons[0];
  } else if (action === "save") {
    target = buttons.find((button) => {
      const label = (button.getAttribute("aria-label") ?? "").toLowerCase();
      return label.includes("save discussion") || label.includes("saved discussion");
    });
  } else if (action === "share") {
    target = buttons.find(
      (button) => (button.getAttribute("aria-label") ?? "").toLowerCase() === "share discussion"
    );
  } else {
    target = buttons.find((button) =>
      (button.getAttribute("aria-label") ?? "")
        .toLowerCase()
        .includes("open more discussion actions")
    );
  }

  target?.click();
}

export function DiscussionMobileReplyLabel() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const run = (action: MobileDiscussionAction) => {
    setOpen(false);
    triggerOriginalAction(action);
  };

  return (
    <div ref={rootRef} className="discussion-mobile-action-menu" data-open={open ? "true" : "false"}>
      <div className="discussion-mobile-action-menu-items" role="menu" aria-hidden={!open}>
        <button type="button" role="menuitem" tabIndex={open ? 0 : -1} onClick={() => run("reply")}>
          Reply
        </button>
        <button type="button" role="menuitem" tabIndex={open ? 0 : -1} onClick={() => run("save")}>
          Save
        </button>
        <button type="button" role="menuitem" tabIndex={open ? 0 : -1} onClick={() => run("share")}>
          Share
        </button>
        <button type="button" role="menuitem" tabIndex={open ? 0 : -1} onClick={() => run("more")}>
          More
        </button>
      </div>

      <button
        type="button"
        className="discussion-mobile-action-menu-toggle"
        aria-label={open ? "Close discussion actions" : "Open discussion actions"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">•••</span>
      </button>
    </div>
  );
}
