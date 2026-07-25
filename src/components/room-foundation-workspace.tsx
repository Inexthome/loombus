"use client";

import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoomFoundationPanel } from "@/components/room-foundation-panel";
import { MODULE_LABELS, PAGE_SIZE, type ActivityPayload, type Panel, type SearchPayload } from "@/components/room-foundation-types";
import { supabase } from "@/lib/supabase/client";
import { isRoomModuleKey } from "@/lib/room-plan-entitlements";

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function findFoundationHost() {
  const shell = document.querySelector<HTMLElement>(
    ".rooms-live-page .rooms-live-shell"
  );
  if (!shell) return null;

  let host = shell.querySelector<HTMLElement>(
    "[data-loombus-room-foundation-host='true']"
  );
  if (!host) {
    host = document.createElement("div");
    host.dataset.loombusRoomFoundationHost = "true";
    const insertionPoint =
      shell.querySelector<HTMLElement>(
        "[data-loombus-tier-navigation-host='true']"
      ) ??
      shell.querySelector<HTMLElement>(
        ".room-workspace-tabs:not([data-loombus-tier-navigation='true'])"
      );
    if (insertionPoint) insertionPoint.before(host);
    else shell.prepend(host);
  }
  return host;
}

export function RoomFoundationWorkspace() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [summary, setSummary] = useState<ActivityPayload | null>(null);
  const [inbox, setInbox] = useState<ActivityPayload | null>(null);
  const [searchPayload, setSearchPayload] = useState<SearchPayload | null>(null);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let scheduled = false;
    const scan = () => {
      scheduled = false;
      setHost(findFoundationHost());
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(scan);
    };
    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      requestAbortRef.current?.abort();
      document
        .querySelector<HTMLElement>(
          "[data-loombus-room-foundation-host='true']"
        )
        ?.remove();
    };
  }, []);

  const request = useCallback(
    async (view: string, init?: RequestInit, extra?: URLSearchParams) => {
      if (!roomId) throw new Error("Room could not be identified.");
      const token = await accessToken();
      if (!token) throw new Error("Sign in again before continuing.");
      const queryParams = new URLSearchParams(extra);
      queryParams.set("view", view);
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/foundation?${queryParams.toString()}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...(init?.headers ?? {}),
          },
          cache: "no-store",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as
        | ActivityPayload
        | SearchPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Room activity could not be loaded.");
      }
      return payload;
    },
    [roomId]
  );

  const loadSummary = useCallback(async () => {
    if (!roomId) return;
    setLoadingSummary(true);
    try {
      setSummary((await request("summary")) as ActivityPayload);
    } catch (error) {
      if (panel) {
        setNotice(
          error instanceof Error ? error.message : "Room activity could not load."
        );
        setNoticeError(true);
      }
    } finally {
      setLoadingSummary(false);
    }
  }, [panel, request, roomId]);

  const focusResults = useCallback(() => {
    window.requestAnimationFrame(() => resultsHeadingRef.current?.focus());
  }, []);

  const loadInbox = useCallback(
    async (page = 1, focus = false) => {
      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;
      setLoadingPanel(true);
      setNotice("");
      setNoticeError(false);
      try {
        const queryParams = new URLSearchParams({
          page: String(Math.max(1, page)),
          limit: String(PAGE_SIZE),
        });
        const payload = (await request(
          "inbox",
          { signal: controller.signal },
          queryParams
        )) as ActivityPayload;
        setInbox(payload);
        setSummary((current) => ({
          ...(current ?? {}),
          room: payload.room ?? current?.room,
          preferences: payload.preferences ?? current?.preferences,
          unreadCount: payload.unreadCount ?? current?.unreadCount,
          unreadCapped: payload.unreadCapped ?? current?.unreadCapped,
        }));
        if (focus) focusResults();
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          setNotice(
            error instanceof Error ? error.message : "Room inbox could not load."
          );
          setNoticeError(true);
        }
      } finally {
        if (requestAbortRef.current === controller) setLoadingPanel(false);
      }
    },
    [focusResults, request]
  );

  const loadSearch = useCallback(
    async (page = 1, focus = false) => {
      const cleaned = query.trim();
      if (cleaned.length < 2) {
        setNotice("Enter at least two characters to search this Room.");
        setNoticeError(true);
        setSearchPayload({ results: [], pageInfo: null });
        return;
      }

      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;
      setLoadingPanel(true);
      setNotice("");
      setNoticeError(false);
      try {
        const queryParams = new URLSearchParams({
          q: cleaned,
          page: String(Math.max(1, page)),
          limit: String(PAGE_SIZE),
        });
        if (moduleFilter) queryParams.set("module", moduleFilter);
        const payload = (await request(
          "search",
          { signal: controller.signal },
          queryParams
        )) as SearchPayload;
        setSearchPayload(payload);
        if (focus) focusResults();
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          setNotice(
            error instanceof Error ? error.message : "Room search could not run."
          );
          setNoticeError(true);
        }
      } finally {
        if (requestAbortRef.current === controller) setLoadingPanel(false);
      }
    },
    [focusResults, moduleFilter, query, request]
  );

  useEffect(() => {
    void loadSummary();
    const interval = window.setInterval(() => void loadSummary(), 60000);
    const refresh = () => void loadSummary();
    window.addEventListener("loombus:room-activity-changed", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("loombus:room-activity-changed", refresh);
    };
  }, [loadSummary]);

  const closePanel = useCallback(() => {
    requestAbortRef.current?.abort();
    setPanel(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openPanel = useCallback(
    (nextPanel: Exclude<Panel, null>, trigger: HTMLButtonElement) => {
      if (panel === nextPanel) {
        closePanel();
        return;
      }
      triggerRef.current = trigger;
      setNotice("");
      setNoticeError(false);
      setPanel(nextPanel);
    },
    [closePanel, panel]
  );

  useEffect(() => {
    if (!panel) return;
    window.requestAnimationFrame(() => headingRef.current?.focus());
    if (panel === "search") {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    } else {
      void loadInbox(1);
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePanel, loadInbox, panel]);

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadSearch(1, true);
  }

  async function postAction(
    action: string,
    values: Record<string, unknown> = {}
  ) {
    setWorking(true);
    setNotice("");
    setNoticeError(false);
    try {
      const payload = (await request("preferences", {
        method: "POST",
        body: JSON.stringify({ action: action, ...values }),
      })) as ActivityPayload;
      if (payload.preferences) {
        setInbox((current) =>
          current
            ? {
                ...current,
                preferences: payload.preferences,
                ...(action === "mark_read" ? { unreadCount: 0 } : {}),
              }
            : current
        );
        setSummary((current) =>
          current
            ? {
                ...current,
                preferences: payload.preferences,
                ...(action === "mark_read" ? { unreadCount: 0 } : {}),
              }
            : current
        );
      }
      if (action === "mark_read") setNotice("Room activity marked read.");
      if (action === "update_preferences") await loadInbox(1);
      window.dispatchEvent(new Event("loombus:room-activity-changed"));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Room preferences could not be updated."
      );
      setNoticeError(true);
    } finally {
      setWorking(false);
    }
  }

  function openModule(moduleKey: string) {
    const label = isRoomModuleKey(moduleKey)
      ? MODULE_LABELS[moduleKey]
      : undefined;
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "[data-loombus-tier-navigation='true'] button"
      )
    ).find((candidate) => {
      const text = candidate.textContent?.trim() ?? "";
      return Boolean(label && (text === label || text.startsWith(label)));
    });
    button?.click();
    closePanel();
  }


  if (!roomId || !host) return null;

  return createPortal(
    <RoomFoundationPanel
      panel={panel}
      summary={summary}
      inbox={inbox}
      searchPayload={searchPayload}
      query={query}
      moduleFilter={moduleFilter}
      loadingSummary={loadingSummary}
      loadingPanel={loadingPanel}
      working={working}
      notice={notice}
      noticeError={noticeError}
      headingRef={headingRef}
      resultsHeadingRef={resultsHeadingRef}
      searchInputRef={searchInputRef}
      closePanel={closePanel}
      setQuery={setQuery}
      setModuleFilter={setModuleFilter}
      handleSearchSubmit={handleSearchSubmit}
      loadSearch={loadSearch}
      loadInbox={loadInbox}
      postAction={postAction}
      openModule={openModule}
      openPanel={openPanel}
    />,
    host
  );
}
