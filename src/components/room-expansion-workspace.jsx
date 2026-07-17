"use client";

import { BookOpen, Building2, CalendarDays, ClipboardList, Files, ListTodo, Loader2, RefreshCw, Settings2, Vote, X } from "lucide-react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function findHost() {
  const shell = document.querySelector(".rooms-live-page .rooms-live-shell");
  if (!shell) return null;
  let host = shell.querySelector("[data-loombus-room-expansion-host='true']");
  if (!host) {
    host = document.createElement("div");
    host.dataset.loombusRoomExpansionHost = "true";
    const insertion = shell.querySelector("[data-loombus-tier-navigation-host='true']") || shell.querySelector(".room-workspace-tabs");
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
      document
        .querySelector("[data-loombus-room-expansion-host='true']")
        ?.remove();
    };
  }, []);

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
        throw new Error(payload.error ?? "Room Studio could not complete this request.");
      }
      return payload.data ?? payload;
    },
    [roomId]
  );

  const loadManifest = useCallback(async () => {
    if (!roomId) return;
    try {
      const accessToken = await token();
      if (!accessToken) return;
      const [nextManifest, workspaceResponse] = await Promise.all([
        request("manifest"),
        fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }),
      ]);
      const workspace = await workspaceResponse.json().catch(() => ({}));
      setManifest(nextManifest);
      setMembers(Array.isArray(workspace.members) ? workspace.members : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Room Studio could not load.");
      setNoticeError(true);
    }
  }, [request, roomId]);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  const loadView = useCallback(
    async (view) => {
      setLoading(true);
      setNotice("");
      setNoticeError(false);
      try {
        const next = await request(view);
        setData(next);
        if (view === "organization") {
          const accent = next?.organization?.branding?.accent;
          const shell = document.querySelector(".rooms-live-page .rooms-live-shell");
          if (shell && accent) shell.style.setProperty("--room-expansion-accent", accent);
        }
      } catch (error) {
        setData(null);
        setNotice(error instanceof Error ? error.message : "Room Studio could not load.");
        setNoticeError(true);
      } finally {
        setLoading(false);
      }
    },
    [request]
  );

  useEffect(() => {
    if (open) void loadView(activeView);
  }, [activeView, loadView, open]);

  async function action(payload, success, reloadView = activeView) {
    setWorking(true);
    setNotice("");
    setNoticeError(false);
    try {
      const result = await request("", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotice(result.confirmationMessage || success);
      await loadView(reloadView);
      window.dispatchEvent(new Event("loombus:room-activity-changed"));
      return result;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Room Studio action failed.");
      setNoticeError(true);
      return null;
    } finally {
      setWorking(false);
    }
  }

  if (!roomId || !host || !manifest?.capabilities?.studio) return null;

  function openStudio(view = "tasks") {
    setActiveView(view);
    setOpen(true);
  }

  return createPortal(
    <div className="room-expansion">
      <div className="room-expansion-toolbar">
        <button type="button" onClick={() => openStudio("tasks")}>
          <Settings2 aria-hidden="true" />
          <span>Room Studio</span>
        </button>
        {manifest.capabilities.organization ? (
          <button type="button" onClick={() => openStudio("organization")}>
            <Building2 aria-hidden="true" />
            <span>Organization Console</span>
          </button>
        ) : null}
      </div>

      {open ? (
        <section className="room-expansion-panel">
          <header className="room-expansion-header">
            <div>
              <p>{manifest.room?.name ?? "Private Room"}</p>
              <h2>
                {activeView === "organization" ? "Organization Console" : "Room Studio"}
              </h2>
              <span>
                Deeper private operations with plan and role enforcement at the server and
                database boundaries.
              </span>
            </div>
            <div className="room-expansion-header-actions">
              <button
                type="button"
                onClick={() => void loadView(activeView)}
                disabled={loading}
                aria-label="Refresh Room Studio"
              >
                <RefreshCw className={loading ? "is-spinning" : ""} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close Room Studio">
                <X aria-hidden="true" />
              </button>
            </div>
          </header>

          <nav className="room-expansion-tabs" aria-label="Room Studio areas">
            {STUDIO_VIEWS.map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={activeView === value}
                onClick={() => setActiveView(value)}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
            {manifest.capabilities.organization ? (
              <button
                type="button"
                aria-pressed={activeView === "organization"}
                onClick={() => setActiveView("organization")}
              >
                <Building2 aria-hidden="true" />
                Organization
              </button>
            ) : null}
          </nav>

          {notice ? (
            <div className={`room-expansion-notice${noticeError ? " is-error" : ""}`}>
              {notice}
            </div>
          ) : null}

          {loading ? (
            <div className="room-expansion-loading">
              <Loader2 className="is-spinning" aria-hidden="true" />
              Loading {activeView.replaceAll("_", " ")}
            </div>
          ) : (
            <ExpansionBody
              view={activeView}
              data={data}
              manifest={manifest}
              members={members}
              working={working}
              action={action}
              request={request}
            />
          )}
        </section>
      ) : null}
    </div>,
    host
  );
}
