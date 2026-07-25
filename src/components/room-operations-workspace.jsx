"use client";

import { Flag, Loader2, Shield, X } from "lucide-react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoomOperationsPanel } from "@/components/room-operations-panel";
import { supabase } from "@/lib/supabase/client";

const PAGE_SIZE = 24;

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function findHost() {
  const shell = document.querySelector(".rooms-live-page .rooms-live-shell");
  if (!shell) return null;
  let host = shell.querySelector("[data-loombus-room-operations-host='true']");
  if (!host) {
    host = document.createElement("div");
    host.dataset.loombusRoomOperationsHost = "true";
    const foundation = shell.querySelector(
      "[data-loombus-room-foundation-host='true']"
    );
    if (foundation) foundation.after(host);
    else shell.prepend(host);
  }
  return host;
}

function initialView(access) {
  if (access?.canModerate) return "moderation";
  return "report";
}

export function RoomOperationsWorkspace() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [host, setHost] = useState(null);
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [activeView, setActiveView] = useState(null);
  const [payloads, setPayloads] = useState({});
  const [loadingView, setLoadingView] = useState("");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);

  const triggerRef = useRef(null);
  const headingRef = useRef(null);
  const resultsRef = useRef(null);
  const requestAbortRef = useRef(null);

  useEffect(() => {
    let frame = 0;
    const scan = () => {
      frame = 0;
      setHost(findHost());
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(scan);
    };
    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      requestAbortRef.current?.abort();
      if (frame) cancelAnimationFrame(frame);
      document
        .querySelector("[data-loombus-room-operations-host='true']")
        ?.remove();
    };
  }, []);

  const request = useCallback(
    async (view, init, extra) => {
      if (!roomId) throw new Error("Room could not be identified.");
      const accessToken = await token();
      if (!accessToken) throw new Error("Sign in again before continuing.");
      const queryParams = new URLSearchParams(extra);
      queryParams.set("view", view);
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/operations?${queryParams.toString()}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...(init?.headers ?? {}),
          },
          cache: "no-store",
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Room operation could not be completed.");
      }
      return result;
    },
    [roomId]
  );

  const loadSummary = useCallback(async () => {
    if (!roomId) return;
    try {
      const result = await request("summary");
      setSummary(result);
      setActiveView((current) => current || initialView(result.access));
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Room operations could not load."
      );
      setNoticeError(true);
    }
  }, [request, roomId]);

  const loadView = useCallback(
    async (view, page = 1, focus = false) => {
      if (!view) return;
      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;
      setLoadingView(view);
      setNotice("");
      setNoticeError(false);
      try {
        const queryParams = new URLSearchParams({
          page: String(Math.max(1, page)),
          limit: String(PAGE_SIZE),
        });
        const result = await request(
          view,
          { signal: controller.signal },
          queryParams
        );
        setPayloads((current) => ({ ...current, [view]: result }));
        setSummary((current) => ({
          ...(current ?? {}),
          access: result.access ?? current?.access,
          room: result.room ?? current?.room,
          pendingReportCount:
            result.pendingReportCount ?? current?.pendingReportCount,
        }));
        if (focus) {
          window.requestAnimationFrame(() => resultsRef.current?.focus());
        }
      } catch (cause) {
        if (cause?.name !== "AbortError") {
          setNotice(
            cause instanceof Error
              ? cause.message
              : "Room operations could not load."
          );
          setNoticeError(true);
        }
      } finally {
        if (requestAbortRef.current === controller) setLoadingView("");
      }
    },
    [request]
  );

  useEffect(() => {
    void loadSummary();
    const interval = window.setInterval(() => void loadSummary(), 60000);
    const refresh = () => {
      void loadSummary();
      if (open && activeView) {
        const page = payloads[activeView]?.pageInfo?.page ?? 1;
        void loadView(activeView, page);
      }
    };
    window.addEventListener("loombus:room-operations-changed", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("loombus:room-operations-changed", refresh);
    };
  }, [activeView, loadSummary, loadView, open, payloads]);

  useEffect(() => {
    if (!open || !activeView) return;
    if (!payloads[activeView]) void loadView(activeView, 1);
  }, [activeView, loadView, open, payloads]);

  const closePanel = useCallback(() => {
    requestAbortRef.current?.abort();
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => headingRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePanel, open]);

  function openPanel(event) {
    if (open) {
      closePanel();
      return;
    }
    triggerRef.current = event.currentTarget;
    setNotice("");
    setNoticeError(false);
    setOpen(true);
  }

  function changeView(view) {
    requestAbortRef.current?.abort();
    setActiveView(view);
    if (!payloads[view]) void loadView(view, 1);
  }

  async function action(
    name,
    values = {},
    success = "Room operation completed."
  ) {
    if (working) return false;
    setWorking(name);
    setNotice("");
    setNoticeError(false);
    try {
      const result = await request("operations", {
        method: "POST",
        body: JSON.stringify({ action: name, ...values }),
      });
      setNotice(success);
      if (result.url) {
        window.location.href = result.url;
        return true;
      }
      if (result.left || result.transferred || result.deleted) {
        window.location.href = "/rooms";
        return true;
      }
      const page = payloads[activeView]?.pageInfo?.page ?? 1;
      await Promise.all([
        loadSummary(),
        activeView ? loadView(activeView, page) : Promise.resolve(),
      ]);
      return true;
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Room operation failed."
      );
      setNoticeError(true);
      return false;
    } finally {
      setWorking("");
    }
  }

  async function exportRoom() {
    if (working) return;
    setWorking("export");
    setNotice("");
    setNoticeError(false);
    try {
      const accessToken = await token();
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/operations?view=export`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Room export failed.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ||
        "loombus-room-export.json";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Room export downloaded.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Room export failed.");
      setNoticeError(true);
    } finally {
      setWorking("");
    }
  }

  if (!roomId || !host || !summary?.access) return null;
  const badge =
    summary.pendingReportCount > 99
      ? "99+"
      : String(summary.pendingReportCount || "");
  const payload = activeView ? payloads[activeView] : null;
  const headingId = "room-operations-heading";
  const descriptionId = "room-operations-description";

  return createPortal(
    <div className="room-operations">
      <button
        ref={triggerRef}
        type="button"
        className="room-operations-trigger"
        onClick={openPanel}
        aria-expanded={open}
        aria-controls="room-operations-panel"
      >
        {summary.access.canModerate ? (
          <Shield aria-hidden="true" />
        ) : (
          <Flag aria-hidden="true" />
        )}
        <span>
          {summary.access.canModerate
            ? "Room Operations"
            : "Report Room Content"}
        </span>
        {badge ? <strong>{badge}</strong> : null}
      </button>

      {open ? (
        <section
          id="room-operations-panel"
          className="room-operations-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={headingId}
          aria-describedby={descriptionId}
          aria-busy={Boolean(loadingView)}
        >
          <header className="room-operations-heading">
            <div>
              <p>{summary.room?.name || "Private Room"}</p>
              <h2 id={headingId} ref={headingRef} tabIndex={-1}>
                Room Operations
              </h2>
              <span id={descriptionId}>
                Membership, moderation, usage, billing, export, and lifecycle
                controls.
              </span>
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close Room Operations"
            >
              <X aria-hidden="true" />
            </button>
          </header>

          {notice ? (
            <div
              className="room-operations-notice"
              role={noticeError ? "alert" : "status"}
            >
              {notice}
            </div>
          ) : null}

          <div
            ref={resultsRef}
            className="room-core-results-region"
            tabIndex={-1}
          >
            <RoomOperationsPanel
              summary={summary}
              payload={payload}
              activeTab={activeView}
              loading={loadingView === activeView}
              working={working}
              onTabChange={changeView}
              onPageChange={(page) =>
                void loadView(activeView, page, true)
              }
              onAction={action}
              onExport={exportRoom}
              onRefresh={() => {
                const page = payload?.pageInfo?.page ?? 1;
                return loadView(activeView, page, true);
              }}
            />
          </div>

          {loadingView && !payload ? (
            <div className="room-operations-loading" role="status">
              <Loader2 className="is-spinning" aria-hidden="true" />
              Loading Room operations
            </div>
          ) : null}
        </section>
      ) : null}
    </div>,
    host
  );
}
