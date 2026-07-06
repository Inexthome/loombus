"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type RoomPreferences = {
  roomStatus: "active" | "paused" | "archived";
  calendarEnabled: boolean;
  announcementsEnabled: boolean;
  requestsEnabled: boolean;
  resourcesEnabled: boolean;
  servicesEnabled: boolean;
  membersEnabled: boolean;
};

type ModuleRule = {
  key: keyof Omit<RoomPreferences, "roomStatus">;
  slug: string;
  label: string;
  headings: string[];
  railSelector?: string;
};

const DEFAULT_PREFERENCES: RoomPreferences = {
  roomStatus: "active",
  calendarEnabled: true,
  announcementsEnabled: true,
  requestsEnabled: true,
  resourcesEnabled: true,
  servicesEnabled: true,
  membersEnabled: true,
};

const MODULE_RULES: ModuleRule[] = [
  {
    key: "calendarEnabled",
    slug: "calendar",
    label: "Calendar",
    headings: ["calendar", "events", "room calendar"],
  },
  {
    key: "announcementsEnabled",
    slug: "announcements",
    label: "Announcements",
    headings: ["announcements", "latest announcements", "room announcements"],
  },
  {
    key: "membersEnabled",
    slug: "members",
    label: "Members / Roles",
    headings: ["members", "members / roles", "members/roles", "roles"],
    railSelector: '[data-room-members-summary="true"]',
  },
  {
    key: "requestsEnabled",
    slug: "requests",
    label: "Requests",
    headings: ["requests", "room requests", "request center"],
    railSelector: '[data-room-request-summary="true"]',
  },
  {
    key: "resourcesEnabled",
    slug: "resources",
    label: "Resources",
    headings: ["resources", "room resources", "resource center"],
    railSelector: '[data-room-resource-summary="true"]',
  },
  {
    key: "servicesEnabled",
    slug: "services",
    label: "Services / Store",
    headings: ["services", "store", "services / store", "services/store", "room services / store"],
    railSelector: '[data-room-services-summary="true"]',
  },
];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function normalizePreferences(row: Row | null): RoomPreferences {
  if (!row) return DEFAULT_PREFERENCES;
  const status = asString(row.room_status);
  return {
    roomStatus: ["active", "paused", "archived"].includes(status) ? (status as RoomPreferences["roomStatus"]) : "active",
    calendarEnabled: asBoolean(row.calendar_enabled),
    announcementsEnabled: asBoolean(row.announcements_enabled),
    requestsEnabled: asBoolean(row.requests_enabled),
    resourcesEnabled: asBoolean(row.resources_enabled),
    servicesEnabled: asBoolean(row.services_enabled),
    membersEnabled: asBoolean(row.members_enabled),
  };
}

function getActiveSegment(pathname: string | null, roomId: string) {
  if (!pathname) return "";
  const segments = pathname.split("/").filter(Boolean);
  const index = segments.findIndex((segment) => segment === roomId);
  if (index < 0) return "";
  return segments[index + 1] ?? "";
}

function resolveSection(rule: ModuleRule) {
  const direct = document.getElementById(rule.slug);
  if (direct) return direct;

  const headings = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,p,span"));
  const heading = headings.find((element) => {
    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    return rule.headings.some((target) => text === target || text.includes(target));
  });

  return heading?.closest("section") as HTMLElement | null;
}

function ensureDisabledNotice(section: HTMLElement, rule: ModuleRule) {
  if (section.querySelector(`[data-disabled-room-module="${rule.slug}"]`)) return;

  const notice = document.createElement("div");
  notice.setAttribute("data-disabled-room-module", rule.slug);
  notice.className = "mt-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-slate-100";
  notice.textContent = `${rule.label} is currently disabled in Room Settings / Controls.`;
  section.appendChild(notice);
}

function applyHubPreferences(preferences: RoomPreferences) {
  MODULE_RULES.forEach((rule) => {
    const enabled = preferences[rule.key];
    const section = resolveSection(rule);
    const rail = rule.railSelector ? document.querySelector<HTMLElement>(rule.railSelector) : null;

    if (rail) {
      rail.style.display = enabled ? "" : "none";
      rail.setAttribute("data-room-module-enabled", enabled ? "true" : "false");
    }

    if (!section) return;

    section.setAttribute("data-room-module-enabled", enabled ? "true" : "false");
    section.style.opacity = enabled ? "" : "0.58";

    const links = Array.from(section.querySelectorAll<HTMLAnchorElement>("a[href]"));
    links.forEach((link) => {
      const href = link.getAttribute("href") ?? "";
      if (!href.includes(`/${rule.slug}`)) return;
      if (enabled) {
        link.style.pointerEvents = "";
        link.style.opacity = "";
        link.removeAttribute("aria-disabled");
      } else {
        link.style.pointerEvents = "none";
        link.style.opacity = "0.45";
        link.setAttribute("aria-disabled", "true");
      }
    });

    const existingNotice = section.querySelector(`[data-disabled-room-module="${rule.slug}"]`);
    if (enabled) {
      existingNotice?.remove();
    } else {
      ensureDisabledNotice(section, rule);
    }
  });
}

export function RoomPreferencesEnforcer({ roomId }: { roomId: string }) {
  const pathname = usePathname();
  const [preferences, setPreferences] = useState<RoomPreferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  const activeSegment = useMemo(() => getActiveSegment(pathname, roomId), [pathname, roomId]);
  const disabledModule = MODULE_RULES.find((rule) => rule.slug === activeSegment && !preferences[rule.key]);
  const shouldBlockRoom = loaded && preferences.roomStatus !== "active" && activeSegment !== "settings";
  const shouldBlockModule = loaded && Boolean(disabledModule) && activeSegment !== "settings";

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      if (!roomId) return;
      const { data } = await supabase.from("room_preferences").select("room_status,calendar_enabled,announcements_enabled,requests_enabled,resources_enabled,services_enabled,members_enabled").eq("room_id", roomId).maybeSingle();
      if (!cancelled) {
        setPreferences(normalizePreferences((data as Row | null) ?? null));
        setLoaded(true);
      }
    }

    loadPreferences();

    const channel = supabase
      .channel(`room-preferences-enforcer-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_preferences", filter: `room_id=eq.${roomId}` }, loadPreferences)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    if (!loaded || activeSegment) return;

    applyHubPreferences(preferences);

    const observer = new MutationObserver(() => applyHubPreferences(preferences));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const intervalId = window.setInterval(() => applyHubPreferences(preferences), 600);
    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 8000);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [activeSegment, loaded, preferences]);

  if (!shouldBlockRoom && !shouldBlockModule) return null;

  const title = shouldBlockRoom
    ? preferences.roomStatus === "paused"
      ? "This room is paused"
      : "This room is archived"
    : `${disabledModule?.label ?? "This module"} is disabled`;
  const description = shouldBlockRoom
    ? preferences.roomStatus === "paused"
      ? "The room owner has paused activity in Room Settings / Controls. Settings remain available to owners and admins."
      : "The room owner has archived this room. Settings remain available to owners and admins."
    : `${disabledModule?.label ?? "This module"} is currently turned off in Room Settings / Controls.`;

  return (
    <div className="fixed inset-0 z-[120] grid min-h-screen place-items-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <section className="max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 text-center text-slate-950 shadow-2xl">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <LockKeyhole className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-black tracking-tight">{title}</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{description}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/rooms/${roomId}`} className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
            Back to room
          </Link>
          <Link href={`/rooms/${roomId}/settings`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:text-amber-700">
            <Settings className="size-4" /> Room Settings / Controls
          </Link>
        </div>
      </section>
    </div>
  );
}
