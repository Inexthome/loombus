"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type HelperGroup = {
  title: string;
  optionCount: number;
};

const HELPER_ROW_SELECTOR = ".discussion-v2-helper-row";
const HELPER_GROUP_SELECTOR = ".discussion-v2-helper-group";
const HOST_ATTR = "data-mobile-reply-helper-host";

function readHelperGroups(row: HTMLElement): HelperGroup[] {
  return Array.from(row.querySelectorAll<HTMLElement>(HELPER_GROUP_SELECTOR))
    .map((group) => ({
      title: group.querySelector<HTMLElement>(":scope > span")?.textContent?.trim() ?? "",
      optionCount: group.querySelectorAll<HTMLButtonElement>(":scope > button").length,
    }))
    .filter((group) => group.title && group.optionCount > 0);
}

export default function DiscussionMobileReplyHelperMenus() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [groups, setGroups] = useState<HelperGroup[]>([]);
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    const mount = () => {
      if (cancelled) return false;
      const row = document.querySelector<HTMLElement>(HELPER_ROW_SELECTOR);
      if (!row?.parentElement) return false;

      let nextHost = row.parentElement.querySelector<HTMLElement>(`:scope > [${HOST_ATTR}='true']`);
      if (!nextHost) {
        nextHost = document.createElement("div");
        nextHost.setAttribute(HOST_ATTR, "true");
        row.insertAdjacentElement("beforebegin", nextHost);
      }

      setGroups(readHelperGroups(row));
      setHost(nextHost);
      return true;
    };

    if (!mount()) {
      observer = new MutationObserver(() => {
        if (mount()) {
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      setOpenGroup(null);
      document.querySelectorAll<HTMLElement>(`[${HOST_ATTR}='true']`).forEach((node) => node.remove());
    };
  }, []);

  useEffect(() => {
    if (openGroup === null) return;

    const closeOnOutsideTap = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroup(null);
    };

    document.addEventListener("pointerdown", closeOnOutsideTap, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideTap, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openGroup]);

  const selectOption = (groupIndex: number, optionIndex: number) => {
    const row = document.querySelector<HTMLElement>(HELPER_ROW_SELECTOR);
    const group = row?.querySelectorAll<HTMLElement>(HELPER_GROUP_SELECTOR)[groupIndex];
    const button = group?.querySelectorAll<HTMLButtonElement>(":scope > button")[optionIndex];
    setOpenGroup(null);
    button?.click();
  };

  if (!host || groups.length === 0) return null;

  return createPortal(
    <div ref={rootRef} className="discussion-mobile-reply-helper-menus" aria-label="Reply starters">
      {groups.map((group, groupIndex) => {
        const isOpen = openGroup === groupIndex;
        const menuId = `discussion-mobile-reply-helper-${groupIndex}`;
        return (
          <div key={group.title} className="discussion-mobile-reply-helper-group">
            <button
              type="button"
              className="discussion-mobile-reply-helper-trigger"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls={menuId}
              onClick={() => setOpenGroup((current) => (current === groupIndex ? null : groupIndex))}
            >
              <span>{group.title}</span>
              <ChevronDown aria-hidden="true" size={14} />
            </button>

            {isOpen ? (
              <div id={menuId} className="discussion-mobile-reply-helper-menu" role="menu" aria-label={`${group.title} reply starters`}>
                {Array.from({ length: group.optionCount }, (_, optionIndex) => (
                  <button
                    key={`${group.title}-${optionIndex + 1}`}
                    type="button"
                    role="menuitem"
                    onClick={() => selectOption(groupIndex, optionIndex)}
                  >
                    {group.title} {optionIndex + 1}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>,
    host
  );
}
