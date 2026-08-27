"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, UserCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { Conversation } from "@/app/messages/messages-v2-model";
import {
  formatConversationTime,
  getConversationName,
  getConversationPreview,
} from "@/app/messages/messages-v2-model";

const DESKTOP_MESSAGES_BUTTON_SELECTOR =
  '.loombus-desktop-flat-topbar [aria-label="Messages"]';

type TrayPosition = {
  top: number;
  right: number;
};

export function DesktopMessagesPreviewTrayController() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<TrayPosition | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const trayRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setConversations([]);
        return;
      }

      const response = await fetch("/api/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      setConversations(response.ok ? ((payload.conversations ?? []) as Conversation[]) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOpen(false);
    setPosition(null);
  }, [pathname]);

  useEffect(() => {
    function getMessagesButton() {
      return document.querySelector<HTMLElement>(DESKTOP_MESSAGES_BUTTON_SELECTOR);
    }

    function syncExpandedState(nextOpen: boolean) {
      getMessagesButton()?.setAttribute("aria-expanded", String(nextOpen));
    }

    function syncTrayPosition(button = getMessagesButton()) {
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }

    function closeTray() {
      setOpen(false);
      setPosition(null);
      syncExpandedState(false);
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const messagesButton = target?.closest<HTMLElement>(DESKTOP_MESSAGES_BUTTON_SELECTOR);

      if (messagesButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        syncTrayPosition(messagesButton);
        setOpen((current) => {
          const next = !current;
          syncExpandedState(next);
          if (next) void loadConversations();
          else setPosition(null);
          return next;
        });
        return;
      }

      if (open && !trayRef.current?.contains(target as Node)) closeTray();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !open) return;
      closeTray();
      getMessagesButton()?.focus();
    }

    function handleViewportChange() {
      if (open) syncTrayPosition();
    }

    function handleMessagesChanged() {
      if (open) void loadConversations();
    }

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("loombus:messages-changed", handleMessagesChanged);
    syncExpandedState(open);
    if (open) syncTrayPosition();

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("loombus:messages-changed", handleMessagesChanged);
    };
  }, [loadConversations, open]);

  if (!open || !position) return null;

  const previewConversations = conversations.slice(0, 6);
  const unreadCount = conversations.filter((conversation) => conversation.hasUnread).length;

  return (
    <div
      ref={trayRef}
      className="fixed z-[171] hidden w-[360px] overflow-hidden border border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-[0_14px_38px_rgb(0_0_0/.14)] md:block"
      style={{ top: position.top, right: position.right }}
      role="dialog"
      aria-label="Messages preview"
    >
      <div className="flex min-h-12 items-center justify-between gap-4 border-b border-[var(--loombus-border)] px-4 py-2.5">
        <div>
          <strong className="text-sm font-extrabold">Messages</strong>
          {unreadCount > 0 ? (
            <span className="ml-2 text-xs font-semibold text-[var(--loombus-gold)]">
              {unreadCount} unread
            </span>
          ) : null}
        </div>
        <Link href="/messages" className="text-xs font-bold text-[var(--loombus-gold)] no-underline">
          View all
        </Link>
      </div>

      <div className="max-h-[min(62vh,520px)] overflow-y-auto">
        {loading ? (
          <p className="m-0 px-4 py-8 text-center text-xs text-[var(--loombus-text-muted)]">
            Loading conversations…
          </p>
        ) : previewConversations.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-5 py-9 text-center">
            <MessageCircle size={22} aria-hidden="true" className="text-[var(--loombus-text-muted)]" />
            <strong className="text-sm">No conversations yet</strong>
            <span className="text-xs text-[var(--loombus-text-muted)]">Your recent messages will appear here.</span>
          </div>
        ) : (
          previewConversations.map((conversation) => {
            const name = getConversationName(conversation);
            return (
              <Link
                key={conversation.id}
                href={`/messages?conversation=${encodeURIComponent(conversation.id)}`}
                className="flex min-h-[66px] items-center gap-3 border-b border-[var(--loombus-border)] px-4 py-2.5 text-inherit no-underline last:border-b-0 hover:bg-[var(--loombus-surface-muted)]"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)]">
                  {conversation.otherAvatarUrl ? (
                    <img src={conversation.otherAvatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle aria-hidden="true" className="h-full w-full p-2 text-[var(--loombus-text-muted)]" />
                  )}
                  {conversation.hasUnread ? (
                    <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--loombus-surface)] bg-[var(--loombus-gold)]" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <strong className="truncate text-[.78rem] font-bold">{name}</strong>
                    <time className="shrink-0 text-[.64rem] text-[var(--loombus-text-muted)]">
                      {formatConversationTime(conversation.lastMessageAt)}
                    </time>
                  </div>
                  <p className={`m-0 mt-0.5 truncate text-[.7rem] ${conversation.hasUnread ? "font-semibold text-[var(--loombus-text)]" : "text-[var(--loombus-text-muted)]"}`}>
                    {getConversationPreview(conversation)}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <Link
        href="/messages"
        className="flex min-h-11 items-center justify-center border-t border-[var(--loombus-border)] px-4 text-xs font-bold text-[var(--loombus-gold)] no-underline hover:bg-[var(--loombus-surface-muted)]"
      >
        Open messages
      </Link>
    </div>
  );
}
