"use client";

import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoomOperationsPanel } from "@/components/room-operations-panel";
import { supabase } from "@/lib/supabase/client";
import { useBackgroundRefresh } from "@/lib/use-background-refresh";

const PAGE_SIZE = 24;
const ROOM_OPERATIONS_REFRESH_EVENTS = ["loombus:room-operations-changed"];

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function defaultView(access) {
  return access?.canModerate ? "moderation" : "report";
}

function authorizedView(requested, access) {
  if (requested === "overview" || requested === "members") {
    return access?.canManage ? requested : defaultView(access);
  }
  if (requested === "moderation") {
    return access?.canModerate ? requested : defaultView(access);
  }
  if (requested === "lifecycle") {
    return access?.isOwner ? requested : defaultView(access);
  }
  if (requested === "report") return requested;
  return defaultView(access);
}

export function RoomOperationsFeature({
  initialView,
  hideNavigation = false,
}) {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [summary, setSummary] = useState(null);
  const [activeView, setActiveView] = useState(null);
  const [payloads, setPayloads] = useState({});
  const [loadingView, setLoadingView] = useState("");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const resultsRef = useRef(null);
  const requestAbortRef = useRef(null);

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
      setActiveView((current) => current || authorizedView(initialView, result.access));
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Room operations could not load."
      );
      setNoticeError(true);
    }
  }, [initialView, request, roomId]);

  const loadView = useCallback(
    async (view, page = 1, focus = false, silent = false) => {
      if (!view) return;
      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;
      if (!silent) {
        setLoadingView(view);
        setNotice("");
        setNoticeError(false);
      }
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
        if (cause?.name !== "AbortError" && !silent) {
          setNotice(
            cause instanceof Error
              ? cause.message
              : "Room operations could not load."
          );
          setNoticeError(true);
        }
      } finally {
        if (!silent && requestAbortRef.current === controller) setLoadingView("");
      }
    },
    [request]
  );

  const refreshOperations = useCallback(async () => {
    if (loadingView || working) return;
    await loadSummary();
    if (!activeView) return;
    const page = payloads[activeView]?.pageInfo?.page ?? 1;
    await loadView(activeView, page, false, true);
  }, [activeView, loadSummary, loadView, loadingView, payloads, working]);

  useBackgroundRefresh({
    refresh: refreshOperations,
    enabled: Boolean(roomId && summary?.access),
    intervalMs: 60_000,
    events: ROOM_OPERATIONS_REFRESH_EVENTS,
  });

  useEffect(() => {
    requestAbortRef.current?.abort();
    setSummary(null);
    setPayloads({});
    setActiveView(null);
    void loadSummary();
    return () => {
      requestAbortRef.current?.abort();
    };
  }, [initialView, loadSummary, roomId]);

  useEffect(() => {
    if (!activeView || payloads[activeView]) return;
    void loadView(activeView, 1);
  }, [activeView, loadView, payloads]);

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

  if (!summary?.access) {
    return (
      <div className="room-phase3-loading" role="status">
        <Loader2 className="is-spinning" aria-hidden="true" />
        Loading Room operations
      </div>
    );
  }

  const payload = activeView ? payloads[activeView] : null;

  return (
    <div className="room-phase3-operations">
      {notice ? (
        <div
          className="room-operations-notice"
          role={noticeError ? "alert" : "status"}
        >
          {notice}
        </div>
      ) : null}
      <div ref={resultsRef} className="room-core-results-region" tabIndex={-1}>
        <RoomOperationsPanel
          summary={summary}
          payload={payload}
          activeTab={activeView}
          loading={loadingView === activeView}
          working={working}
          onTabChange={changeView}
          onPageChange={(page) => void loadView(activeView, page, true)}
          onAction={action}
          onExport={exportRoom}
          hideNavigation={hideNavigation}
        />
      </div>
      {loadingView && !payload ? (
        <div className="room-operations-loading" role="status">
          <Loader2 className="is-spinning" aria-hidden="true" />
          Loading Room operations
        </div>
      ) : null}
    </div>
  );
}
