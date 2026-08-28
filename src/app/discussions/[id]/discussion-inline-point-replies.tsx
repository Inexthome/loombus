"use client";

import { LoaderCircle, Reply as ReplyIcon, Send, X } from "lucide-react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { ClipboardEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import "./discussion-inline-point-replies.css";

type PortalTarget = {
  replyId: string;
  host: HTMLElement;
};

type CreateReplyResponse = {
  error?: string;
  reply?: { id?: string };
};

const LAST_POINT_REPLY_KEY = "loombus:last-point-reply";
const RESTORE_POINT_THREAD_KEY = "loombus:restore-point-thread";

function replyIdFromElement(element: Element | null) {
  if (!element) return null;

  const explicit =
    element.getAttribute("data-reply-id") ||
    element.closest<HTMLElement>("[data-reply-id]")?.dataset.replyId ||
    element.closest<HTMLElement>("[data-parent-reply-id]")?.dataset.parentReplyId;
  if (explicit) return explicit;

  const idOwner = element.closest<HTMLElement>('[id^="reply-"]');
  return idOwner?.id.startsWith("reply-") ? idOwner.id.slice("reply-".length) : null;
}

function scrollToReply(replyId: string) {
  const target = document.getElementById(`reply-${replyId}`);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

function openFocusedThread(replyId: string) {
  const trigger = document.querySelector<HTMLButtonElement>(
    `[data-loombus-open-thread="${CSS.escape(replyId)}"]`,
  );
  if (!trigger) return false;
  trigger.click();
  return true;
}

export default function DiscussionInlinePointReplies() {
  const params = useParams();
  const discussionId = String(params.id ?? "");
  const [targets, setTargets] = useState<PortalTarget[]>([]);
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pastedCharacterCounts, setPastedCharacterCounts] = useState<Record<string, number>>({});
  const [busyReplyId, setBusyReplyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pinnedReplyId, setPinnedReplyId] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    if (!discussionId) return;
    let alive = true;
    void supabase
      .from("discussions")
      .select("pinned_reply_id")
      .eq("id", discussionId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) {
          setPinnedReplyId(
            (data as { pinned_reply_id?: string | null } | null)?.pinned_reply_id ?? null,
          );
        }
      });
    return () => {
      alive = false;
    };
  }, [discussionId]);

  useEffect(() => {
    if (!discussionId) return;

    const scan = () => {
      const next: PortalTarget[] = [];
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(".discussion-v2-reply-card"),
      );

      for (const card of cards) {
        let replyId = replyIdFromElement(card);
        if (!replyId && card.classList.contains("is-pinned")) replyId = pinnedReplyId;
        if (!replyId) continue;

        card.dataset.replyId = replyId;
        let host = card.querySelector<HTMLElement>(
          ":scope > .discussion-inline-point-reply-host",
        );
        if (!host) {
          host = document.createElement("div");
          host.className = "discussion-inline-point-reply-host";
          host.dataset.replyId = replyId;
          card.appendChild(host);
        }
        next.push({ replyId, host });
      }

      setTargets((current) => {
        if (
          current.length === next.length &&
          current.every(
            (item, index) =>
              item.replyId === next[index]?.replyId && item.host === next[index]?.host,
          )
        ) {
          return current;
        }
        return next;
      });
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [discussionId, pinnedReplyId]);

  useEffect(() => {
    if (!discussionId) return;
    const restoreReplyId = window.sessionStorage.getItem(RESTORE_POINT_THREAD_KEY);
    if (!restoreReplyId) return;

    let restored = false;
    const restore = () => {
      if (restored) return;
      if (!openFocusedThread(restoreReplyId)) return;
      restored = true;
      window.sessionStorage.removeItem(RESTORE_POINT_THREAD_KEY);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#reply-${restoreReplyId}`,
      );
      window.setTimeout(() => scrollToReply(restoreReplyId), 50);
    };

    restore();
    if (restored) return;

    const observer = new MutationObserver(restore);
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      if (!restored) {
        window.sessionStorage.removeItem(RESTORE_POINT_THREAD_KEY);
        scrollToReply(restoreReplyId);
      }
    }, 6000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [discussionId]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const button = target.closest<HTMLButtonElement>("button");
      if (!button) return;
      const label =
        button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";

      if (
        label === "respond to point" ||
        label === "reply to a point" ||
        label === "reply to point"
      ) {
        const card = button.closest<HTMLElement>(".discussion-v2-reply-card");
        const replyId = replyIdFromElement(card);
        if (!replyId) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setOpenReplyId((current) => (current === replyId ? null : replyId));
        setErrors((current) => ({ ...current, [replyId]: "" }));
        window.sessionStorage.setItem(LAST_POINT_REPLY_KEY, replyId);
        window.setTimeout(() => textareaRefs.current[replyId]?.focus(), 0);
        return;
      }

      if (label === "back to reply") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const contextual =
          replyIdFromElement(button) ||
          replyIdFromElement(
            document.querySelector(
              ".discussion-thread-focused-list [data-thread-context='true']",
            ),
          );
        const remembered = window.sessionStorage.getItem(LAST_POINT_REPLY_KEY);
        const hashReply = window.location.hash.startsWith("#reply-")
          ? window.location.hash.slice("#reply-".length)
          : null;
        const replyId = contextual || remembered || hashReply;

        if (replyId) {
          openFocusedThread(replyId);
          if (scrollToReply(replyId)) {
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${window.location.search}#reply-${replyId}`,
            );
          }
        }
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (!openReplyId) return;
    window.setTimeout(() => textareaRefs.current[openReplyId]?.focus(), 0);
  }, [openReplyId]);

  const targetMap = useMemo(
    () => new Map(targets.map((target) => [target.replyId, target.host])),
    [targets],
  );

  function handlePointReplyPaste(event: ClipboardEvent<HTMLTextAreaElement>, replyId: string) {
    const pastedText = event.clipboardData.getData("text");
    setPastedCharacterCounts((current) => ({
      ...current,
      [replyId]: (current[replyId] ?? 0) + pastedText.length,
    }));
  }

  async function submitPointReply(event: FormEvent<HTMLFormElement>, replyId: string) {
    event.preventDefault();
    if (busyReplyId) return;

    const body = drafts[replyId]?.trim() ?? "";
    if (!body) {
      setErrors((current) => ({ ...current, [replyId]: "Reply cannot be empty." }));
      textareaRefs.current[replyId]?.focus();
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(
        `/discussions/${discussionId}#reply-${replyId}`,
      )}`;
      return;
    }

    setBusyReplyId(replyId);
    setErrors((current) => ({ ...current, [replyId]: "" }));

    try {
      const response = await fetch("/api/replies/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          discussionId,
          body: normalizePublicText(body),
          referencedReplyId: replyId,
          pastedCharacterCount: pastedCharacterCounts[replyId] ?? 0,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as CreateReplyResponse;
      if (!response.ok) {
        setErrors((current) => ({
          ...current,
          [replyId]: result.error ?? "Unable to post reply.",
        }));
        return;
      }

      setDrafts((current) => ({ ...current, [replyId]: "" }));
      setPastedCharacterCounts((current) => ({ ...current, [replyId]: 0 }));
      setOpenReplyId(null);
      window.sessionStorage.setItem(LAST_POINT_REPLY_KEY, replyId);
      window.sessionStorage.setItem(RESTORE_POINT_THREAD_KEY, replyId);
      window.dispatchEvent(
        new CustomEvent("loombus:discussion-metrics-changed", {
          detail: { discussionId },
        }),
      );

      const nextUrl = `${window.location.pathname}${window.location.search}#reply-${replyId}`;
      window.history.replaceState(null, "", nextUrl);
      window.location.reload();
    } catch {
      setErrors((current) => ({
        ...current,
        [replyId]: "Unable to post reply. Try again.",
      }));
    } finally {
      setBusyReplyId(null);
    }
  }

  return (
    <>
      {Array.from(targetMap.entries()).map(([replyId, host]) =>
        createPortal(
          openReplyId === replyId ? (
            <form
              className="discussion-inline-point-reply"
              aria-label="Reply to this point"
              onSubmit={(event) => void submitPointReply(event, replyId)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.requestSubmit();
                }
              }}
            >
              <div className="discussion-inline-point-reply-heading">
                <span>
                  <ReplyIcon aria-hidden="true" size={14} /> Reply to this point
                </span>
                <button
                  type="button"
                  className="discussion-inline-point-reply-close"
                  aria-label="Close point reply composer"
                  onClick={() => setOpenReplyId(null)}
                >
                  <X aria-hidden="true" size={15} />
                </button>
              </div>
              <textarea
                ref={(node) => {
                  textareaRefs.current[replyId] = node;
                }}
                value={drafts[replyId] ?? ""}
                rows={3}
                placeholder="Add a focused response to this point…"
                onPaste={(event) => handlePointReplyPaste(event, replyId)}
                onChange={(event) => {
                  const value = event.target.value;
                  setDrafts((current) => ({ ...current, [replyId]: value }));
                  if (errors[replyId]) {
                    setErrors((current) => ({ ...current, [replyId]: "" }));
                  }
                }}
                aria-describedby={
                  errors[replyId] ? `point-reply-error-${replyId}` : undefined
                }
              />
              {errors[replyId] ? (
                <p
                  id={`point-reply-error-${replyId}`}
                  className="discussion-inline-point-reply-error"
                  role="alert"
                >
                  {errors[replyId]}
                </p>
              ) : null}
              <div className="discussion-inline-point-reply-actions">
                <span>⌘/Ctrl + Enter to post</span>
                <button
                  type="button"
                  onClick={() => setOpenReplyId(null)}
                  disabled={busyReplyId === replyId}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="is-primary"
                  disabled={busyReplyId === replyId || !drafts[replyId]?.trim()}
                >
                  {busyReplyId === replyId ? (
                    <LoaderCircle className="is-spinning" aria-hidden="true" size={15} />
                  ) : (
                    <Send aria-hidden="true" size={15} />
                  )}
                  Reply
                </button>
              </div>
            </form>
          ) : null,
          host,
          replyId,
        ),
      )}
    </>
  );
}
