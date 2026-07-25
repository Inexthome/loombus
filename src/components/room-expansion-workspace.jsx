"use client";

import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  Files,
  ListTodo,
  Loader2,
  RefreshCw,
  Settings2,
  Vote,
  X,
} from "lucide-react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { ExpansionBody } from "@/components/room-expansion-views";

const STUDIO_VIEWS = [
  ["tasks", "Tasks", ListTodo],
  ["polls", "Decisions", Vote],
  ["forms", "Forms", ClipboardList],
  ["knowledge", "Knowledge", BookOpen],
  ["calendar", "Calendar", CalendarDays],
  ["files", "Files", Files],
];
const PAGED_VIEWS = new Set(["tasks", "polls", "forms", "knowledge", "files"]);
const STUDIO_PAGE_SIZE = 24;

function findHost() {
  const shell = document.querySelector(".rooms-live-page .rooms-live-shell");
  if (!shell) return null;
  let host = shell.querySelector("[data-loombus-room-expansion-host='true']");
  if (!host) {
    host = document.createElement("div");
    host.dataset.loombusRoomExpansionHost = "true";
    const insertion =
      shell.querySelector("[data-loombus-tier-navigation-host='true']") ||
      shell.querySelector(".room-workspace-tabs");
    if (insertion) insertion.before(host);
    else shell.prepend(host);
  }
  return host;
}

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function RoomExpansionWorkspace() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [host, setHost] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [members, setMembers] = useState([]);
  const [activeView, setActiveView] = useState("tasks");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [pageByView, setPageByView] = useState({});

  const membersLoadedRef = useRef(false);
  const loadAbortRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const headingRef = useRef(null);
  const resultsRef = useRef(null);
  const focusResultsRef = useRef(false);

  useEffect(() => {
    let scheduled = false;
    const scan = () => {
      scheduled = false;
      setHost(findHost());
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(scan);
    };
    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      loadAbortRef.current?.abort();
      document
        .querySelector("[data-loombus-room-expansion-host='true']")
        ?.remove();
    };
  }, []);

  useEffect(() => {
    membersLoadedRef.current = false;
    setMembers([]);
    setPageByView({});
  }, [roomId]);

  const request = useCallback(
    async (view, init, extra) => {
      if (!roomId) throw new Error("Room could not be identified.");
      const accessToken = await token();
      if (!accessToken) throw new Error("Sign in again before continuing.");
      const query = extra ?? new URLSearchParams();
      if (view) query.set("view", view);
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/expansion?${query.toString()}`,
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
      if (view === "form_export" && response.ok) return response;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error ?? "Room Studio could not complete this request."
        );
      }
      return payload.data ?? payload;
    },
    [roomId]
  );

  const loadManifest = useCallback(async () => {
    if (!roomId) return;
    try {
      const nextManifest = await request("manifest");
      setManifest(nextManifest);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Room Studio could not load."
      );
      setNoticeError(true);
    }
  }, [request, roomId]);

  const loadMembers = useCallback(
    async (signal) => {
      if (membersLoadedRef.current || !roomId) return;
      const accessToken = await token();
      if (!accessToken) throw new Error("Sign in again before continuing.");
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal,
      });
      const workspace = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(workspace.error || "Room members could not be loaded.");
      }
      setMembers(Array.isArray(workspace.members) ? workspace.members : []);
      membersLoadedRef.current = true;
    },
    [roomId]
  );

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  useEffect(() => {
    const shell = document.querySelector(".rooms-live-page .rooms-live-shell");
    if (!shell) return;
    const accent = manifest?.organization?.branding?.accent;
    if (accent) shell.style.setProperty("--room-expansion-accent", accent);
    else shell.style.removeProperty("--room-expansion-accent");
  }, [manifest]);

  const loadView = useCallback(
    async (view, requestedPage = 1, { focusResults = false } = {}) => {
      loadAbortRef.current?.abort();
      const controller = new AbortController();
      loadAbortRef.current = controller;
      setLoading(true);
      setNotice("");
      setNoticeError(false);
      try {
        if (view === "tasks") await loadMembers(controller.signal);
        const query = new URLSearchParams();
        if (PAGED_VIEWS.has(view)) {
          query.set("page", String(Math.max(1, requestedPage)));
          query.set("limit", String(STUDIO_PAGE_SIZE));
        }
        const next = await request(view, { signal: controller.signal }, query);
        setData(next);
        if (next?.pageInfo?.page) {
          setPageByView((current) => ({
            ...current,
            [view]: next.pageInfo.page,
          }));
        }
        if (view === "organization") {
          const accent = next?.organization?.branding?.accent;
          const shell = document.querySelector(
            ".rooms-live-page .rooms-live-shell"
          );
          if (shell && accent) {
            shell.style.setProperty("--room-expansion-accent", accent);
          }
        }
        focusResultsRef.current = focusResults;
      } catch (error) {
        if (error?.name === "AbortError") return;
        setData(null);
        setNotice(
          error instanceof Error ? error.message : "Room Studio could not load."
        );
        setNoticeError(true);
      } finally {
        if (loadAbortRef.current === controller) setLoading(false);
      }
    },
    [loadMembers, request]
  );

  useEffect(() => {
    if (open) void loadView(activeView, 1);
  }, [activeView, loadView, open]);

  useEffect(() => {
    if (!loading && focusResultsRef.current && data) {
      focusResultsRef.current = false;
      requestAnimationFrame(() => resultsRef.current?.focus());
    }
  }, [data, loading]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => headingRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        loadAbortRef.current?.abort();
        setOpen(false);
        setData(null);
        setNotice("");
        setNoticeError(false);
        requestAnimationFrame(() => triggerRef.current?.focus?.());
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function action(payload, success, reloadView = activeView) {
    if (working) return null;
    setWorking(true);
    setNotice("");
    setNoticeError(false);
    try {
      const result = await request("", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotice(result.confirmationMessage || success);
      await loadView(reloadView, pageByView[reloadView] ?? 1);
      window.dispatchEvent(new Event("loombus:room-activity-changed"));
      return result;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Room Studio action failed."
      );
      setNoticeError(true);
      return null;
    } finally {
      setWorking(false);
    }
  }

  if (!roomId || !host || !manifest?.capabilities?.studio) return null;

  function openStudio(view = "tasks", trigger = null) {
    triggerRef.current = trigger;
    setPageByView((current) => ({ ...current, [view]: 1 }));
    setActiveView(view);
    setOpen(true);
  }

  function closeStudio() {
    loadAbortRef.current?.abort();
    setOpen(false);
    setData(null);
    setNotice("");
    setNoticeError(false);
    requestAnimationFrame(() => triggerRef.current?.focus?.());
  }

  function selectView(view) {
    if (view === activeView) {
      void loadView(view, pageByView[view] ?? 1);
      return;
    }
    setPageByView((current) => ({ ...current, [view]: 1 }));
    setData(null);
    setActiveView(view);
  }

  function changePage(page) {
    void loadView(activeView, page, { focusResults: true });
  }

  return createPortal(
    <div className="room-expansion">
      <div className="room-expansion-toolbar">
        {manifest.organization ? (
          <span className="room-expansion-brand">
            {manifest.organization.branding?.logoUrl ? (
              <img src={manifest.organization.branding.logoUrl} alt="" />
            ) : (
              <Building2 aria-hidden="true" />
            )}
            <strong>{manifest.organization.name}</strong>
          </span>
        ) : null}
        <button
          type="button"
          onClick={(event) => openStudio("tasks", event.currentTarget)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Settings2 aria-hidden="true" />
          <span>Room Studio</span>
        </button>
        {manifest.capabilities.organization ? (
          <button
            type="button"
            onClick={(event) =>
              openStudio("organization", event.currentTarget)
            }
            aria-haspopup="dialog"
            aria-expanded={open && activeView === "organization"}
          >
            <Building2 aria-hidden="true" />
            <span>Organization Console</span>
          </button>
        ) : null}
      </div>

      {open ? (
        <section
          ref={panelRef}
          className="room-expansion-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="room-studio-title"
          aria-describedby="room-studio-description"
        >
          <header className="room-expansion-header">
            <div>
              <p>{manifest.room?.name ?? "Private Room"}</p>
              <h2 id="room-studio-title" ref={headingRef} tabIndex={-1}>
                {activeView === "organization"
                  ? "Organization Console"
                  : "Room Studio"}
              </h2>
              <span id="room-studio-description">
                Deeper private operations with plan and role enforcement at the
                server and database boundaries.
              </span>
            </div>
            <div className="room-expansion-header-actions">
              <button
                type="button"
                onClick={() =>
                  void loadView(activeView, pageByView[activeView] ?? 1)
                }
                disabled={loading}
                aria-label="Refresh Room Studio"
              >
                <RefreshCw
                  className={loading ? "is-spinning" : ""}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={closeStudio}
                aria-label="Close Room Studio"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </header>

          <nav
            className="room-expansion-tabs"
            aria-label="Room Studio areas"
            role="tablist"
          >
            {STUDIO_VIEWS.map(([value, label, Icon]) => (
              <button
                key={value}
                id={`room-studio-tab-${value}`}
                type="button"
                role="tab"
                aria-selected={activeView === value}
                aria-controls="room-studio-panel"
                tabIndex={activeView === value ? 0 : -1}
                onClick={() => selectView(value)}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
            {manifest.capabilities.organization ? (
              <button
                id="room-studio-tab-organization"
                type="button"
                role="tab"
                aria-selected={activeView === "organization"}
                aria-controls="room-studio-panel"
                tabIndex={activeView === "organization" ? 0 : -1}
                onClick={() => selectView("organization")}
              >
                <Building2 aria-hidden="true" />
                Organization
              </button>
            ) : null}
          </nav>

          {notice ? (
            <div
              role={noticeError ? "alert" : "status"}
              aria-live={noticeError ? "assertive" : "polite"}
              className={`room-expansion-notice${noticeError ? " is-error" : ""}`}
            >
              {notice}
            </div>
          ) : null}

          {loading ? (
            <div
              className="room-expansion-loading"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="is-spinning" aria-hidden="true" />
              Loading {activeView.replaceAll("_", " ")}
            </div>
          ) : (
            <div
              id="room-studio-panel"
              ref={resultsRef}
              className="room-expansion-results"
              role="tabpanel"
              aria-labelledby={`room-studio-tab-${activeView}`}
              aria-busy={working}
              tabIndex={-1}
            >
              <ExpansionBody
                view={activeView}
                data={data}
                manifest={manifest}
                members={members}
                working={working}
                loading={loading}
                action={action}
                request={request}
                onPageChange={changePage}
              />
            </div>
          )}
        </section>
      ) : null}
    </div>,
    host
  );
}
