"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CalendarDays, FileText, LayoutGrid, Megaphone, MessageCircle, PlusCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { V2ShellMobileNav, V2ShellTopNav } from "../../v2-shell-components";
import { RoomHomeOverview } from "./room-home-overview";

type Row = Record<string, unknown>;
type CoreTool = "overview" | "discussions" | "calendar" | "announcements";
type LoadState = "checking" | "ready" | "signed_out" | "blocked" | "error";
type Room = { id: string; name: string; description: string; ownerId: string; createdBy: string; plan: string };
type ListItem = { id: string; title: string; description: string; meta: string };
type CalendarForm = { title: string; startsAt: string; location: string; description: string };

type ToolConfig = {
  title: string;
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
  icon: typeof LayoutGrid;
};

const TOOL_CONFIG: Record<CoreTool, ToolConfig> = {
  overview: {
    title: "Overview",
    eyebrow: "Room overview",
    description: "A dedicated summary page for this private room, separate from the crowded room hub.",
    emptyTitle: "Room overview is ready",
    emptyBody: "Use the Room Menu to open each room workflow as its own page.",
    icon: Building2,
  },
  discussions: {
    title: "Discussions",
    eyebrow: "Room discussions",
    description: "Private room conversations and member posts in a dedicated page view.",
    emptyTitle: "No room discussions yet",
    emptyBody: "Start from the room hub or upcoming quick actions to create the first private room discussion.",
    icon: MessageCircle,
  },
  calendar: {
    title: "Calendar",
    eyebrow: "Room calendar",
    description: "Room events, meetings, maintenance windows, and important dates.",
    emptyTitle: "No room calendar events yet",
    emptyBody: "Owners and admins can add events here so members always know what is coming next.",
    icon: CalendarDays,
  },
  announcements: {
    title: "Announcements",
    eyebrow: "Room announcements",
    description: "Pinned updates and important notices from room owners and admins.",
    emptyTitle: "No announcements yet",
    emptyBody: "Owners and admins can publish room announcements from the room hub today.",
    icon: Megaphone,
  },
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRoom(row: Row | null): Room | null {
  if (!row) return null;
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || "Private room",
    description: asString(row.description) || asString(row.summary) || "Private room workspace.",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
    plan: asString(row.subscription_plan) || "free",
  };
}

function formatDate(value: unknown) {
  const raw = asString(value);
  if (!raw) return "Recently";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function isAdminRole(role: string) {
  return ["owner", "admin", "moderator"].includes(role.toLowerCase());
}

function normalizeItem(tool: CoreTool, row: Row, index: number): ListItem {
  if (tool === "calendar") {
    const location = asString(row.location);
    return {
      id: asString(row.id) || `event-${index}`,
      title: asString(row.title) || "Untitled event",
      description: [asString(row.description), location ? `Location: ${location}` : ""].filter(Boolean).join(" • ") || "Room event",
      meta: formatDate(row.starts_at),
    };
  }

  if (tool === "announcements") {
    const priority = asString(row.priority);
    return {
      id: asString(row.id) || `announcement-${index}`,
      title: asString(row.title) || "Untitled announcement",
      description: asString(row.body) || "Room announcement",
      meta: [priority || "normal", formatDate(row.created_at)].join(" • "),
    };
  }

  return {
    id: asString(row.id) || `discussion-${index}`,
    title: asString(row.title) || "Untitled discussion",
    description: asString(row.body) || asString(row.content) || "Room discussion",
    meta: formatDate(row.created_at),
  };
}

async function fetchToolItems(tool: CoreTool, roomId: string) {
  if (tool === "overview") return [];

  if (tool === "calendar") {
    const { data, error } = await supabase.from("room_events").select("*").eq("room_id", roomId).order("starts_at", { ascending: true }).limit(40);
    if (error) return [];
    return ((data ?? []) as Row[]).map((row, index) => normalizeItem(tool, row, index));
  }

  if (tool === "announcements") {
    const { data, error } = await supabase.from("room_announcements").select("*").eq("room_id", roomId).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(40);
    if (error) return [];
    return ((data ?? []) as Row[]).map((row, index) => normalizeItem(tool, row, index));
  }

  const { data, error } = await supabase.from("room_posts").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(40);
  if (error) return [];
  return ((data ?? []) as Row[]).map((row, index) => normalizeItem(tool, row, index));
}

function CalendarCreatePanel({
  canManage,
  form,
  isSaving,
  notice,
  onChange,
  onSubmit,
}: {
  canManage: boolean;
  form: CalendarForm;
  isSaving: boolean;
  notice: string;
  onChange: (field: keyof CalendarForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!canManage) {
    return (
      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Calendar access</p>
        <h2 className="mt-2 text-lg font-black text-slate-950">Room members can view events</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Owners and admins manage the calendar so members have a clear source of truth for room dates.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Owner/Admin</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Add calendar event</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">Post meetings, HOA updates, maintenance windows, deadlines, and community dates.</p>
        </div>
        <PlusCircle className="size-6 text-amber-700" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Event title
          <input
            required
            value={form.title}
            onChange={(event) => onChange("title", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none ring-0 transition focus:border-amber-400"
            placeholder="Board meeting, maintenance window, community event..."
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Date and time
          <input
            required
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => onChange("startsAt", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none ring-0 transition focus:border-amber-400"
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
          Location
          <input
            value={form.location}
            onChange={(event) => onChange("location", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none ring-0 transition focus:border-amber-400"
            placeholder="Clubhouse, Zoom, parking lot, unit area..."
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
          Description
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) => onChange("description", event.target.value)}
            className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none ring-0 transition focus:border-amber-400"
            placeholder="Add context members should know."
          />
        </label>
      </div>

      {notice && <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 ring-1 ring-amber-100">{notice}</p>}

      <button
        type="submit"
        disabled={isSaving}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <PlusCircle className="size-4" /> {isSaving ? "Adding event..." : "Add event"}
      </button>
    </form>
  );
}

function CalendarEventList({ items }: { items: ListItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Upcoming events</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Room calendar</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 ring-1 ring-slate-200">{items.length} listed</span>
      </div>
      {items.map((item) => (
        <article key={item.id} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-950">{item.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">{item.description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">{item.meta}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function RoomCorePage({ tool }: { tool: CoreTool }) {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] ?? "" : rawRoomId ?? ""), [rawRoomId]);
  const config = TOOL_CONFIG[tool];
  const Icon = config.icon;

  const [state, setState] = useState<LoadState>("checking");
  const [message, setMessage] = useState("Loading room page...");
  const [room, setRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [canManageRoom, setCanManageRoom] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [calendarForm, setCalendarForm] = useState<CalendarForm>({ title: "", startsAt: "", location: "", description: "" });
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!roomId) {
        if (!cancelled) {
          setState("error");
          setMessage("Loombus could not find this room.");
        }
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? null;
        if (!userId) {
          if (!cancelled) {
            setState("signed_out");
            setMessage("Sign in first so Loombus can open this room page.");
          }
          return;
        }

        const [{ data: roomData, error: roomError }, { data: memberData, error: memberError }] = await Promise.all([
          supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
          supabase.from("room_members").select("*").eq("room_id", roomId),
        ]);

        if (roomError) throw roomError;
        if (memberError) throw memberError;

        const nextRoom = normalizeRoom((roomData ?? null) as Row | null);
        const members = ((memberData ?? []) as Row[]).map((member) => ({ userId: asString(member.user_id), role: asString(member.role) || "member" }));
        const membership = members.find((member) => member.userId === userId);
        const isOwner = nextRoom?.ownerId === userId || nextRoom?.createdBy === userId;
        const isMember = members.some((member) => member.userId === userId);
        const canManage = Boolean(isOwner || (membership && isAdminRole(membership.role)));

        if (!nextRoom || (!isOwner && !isMember)) {
          if (!cancelled) {
            setState("blocked");
            setMessage("This room page is available only to approved room members.");
          }
          return;
        }

        const nextItems = await fetchToolItems(tool, roomId);
        if (!cancelled) {
          setCurrentUserId(userId);
          setCanManageRoom(canManage);
          setRoom(nextRoom);
          setItems(nextItems);
          setState("ready");
          setMessage("");
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("Loombus could not load this room page yet.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [roomId, tool]);

  async function handleCreateCalendarEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tool !== "calendar" || !roomId || !canManageRoom || !currentUserId) return;

    const title = calendarForm.title.trim();
    const startsAt = calendarForm.startsAt ? new Date(calendarForm.startsAt) : null;
    if (!title || !startsAt || !Number.isFinite(startsAt.getTime())) {
      setCalendarNotice("Add a title and valid date/time first.");
      return;
    }

    setIsSavingEvent(true);
    setCalendarNotice("");

    const basePayload = {
      room_id: roomId,
      title,
      description: calendarForm.description.trim() || null,
      location: calendarForm.location.trim() || null,
      starts_at: startsAt.toISOString(),
    };

    const { error } = await supabase.from("room_events").insert({ ...basePayload, created_by: currentUserId });
    if (error) {
      const fallback = await supabase.from("room_events").insert(basePayload);
      if (fallback.error) {
        setCalendarNotice(fallback.error.message || "Loombus could not add this event yet.");
        setIsSavingEvent(false);
        return;
      }
    }

    const nextItems = await fetchToolItems("calendar", roomId);
    setItems(nextItems);
    setCalendarForm({ title: "", startsAt: "", location: "", description: "" });
    setCalendarNotice("Event added to this room calendar.");
    setIsSavingEvent(false);
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
            <ArrowLeft className="size-4" /> Back to room
          </Link>
          <Link href={`/rooms/${roomId}/modules`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
            <LayoutGrid className="size-4" /> Module Directory
          </Link>
        </div>

        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200" style={{ color: "#fde68a" }}>{config.eyebrow}</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl" style={{ color: "#ffffff" }}>{config.title}</h1>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50 sm:text-base" style={{ color: "#fff7ed" }}>{config.description}</p>
              </div>
              <div className="grid size-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <Icon className="size-7 text-amber-200" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{room?.name ?? "Private room"}</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{room?.plan ?? "room"}</span>
            </div>
          </div>

          {state === "ready" && (
            <div className="p-5 sm:p-6">
              {tool === "overview" ? (
                <div className="grid gap-4">
                  <RoomHomeOverview roomId={roomId} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                      <h2 className="text-lg font-black text-slate-950">{room?.name}</h2>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{room?.description}</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                      <h2 className="text-lg font-black text-slate-950">Room navigation</h2>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Use the Room Menu or Module Directory to open each room tool as its own page instead of relying on the center hub and right rail.</p>
                    </div>
                  </div>
                </div>
              ) : tool === "calendar" ? (
                <div className="grid gap-5">
                  <CalendarCreatePanel
                    canManage={canManageRoom}
                    form={calendarForm}
                    isSaving={isSavingEvent}
                    notice={calendarNotice}
                    onChange={(field, value) => setCalendarForm((current) => ({ ...current, [field]: value }))}
                    onSubmit={handleCreateCalendarEvent}
                  />
                  {items.length > 0 ? (
                    <CalendarEventList items={items} />
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                      <FileText className="mx-auto size-9 text-amber-700" />
                      <h2 className="mt-3 text-lg font-black text-slate-950">{config.emptyTitle}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{config.emptyBody}</p>
                    </div>
                  )}
                </div>
              ) : items.length > 0 ? (
                <div className="grid gap-3">
                  {items.map((item) => (
                    <article key={item.id} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-base font-black text-slate-950">{item.title}</h2>
                          <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">{item.description}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 ring-1 ring-slate-200">{item.meta}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                  <FileText className="mx-auto size-9 text-amber-700" />
                  <h2 className="mt-3 text-lg font-black text-slate-950">{config.emptyTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{config.emptyBody}</p>
                </div>
              )}
            </div>
          )}

          {state !== "ready" && (
            <div className="p-6">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <Icon className="mx-auto size-9 text-amber-700" />
                <h2 className="mt-3 text-lg font-black text-slate-950">{state === "checking" ? "Checking room access" : state === "signed_out" ? "Sign in required" : state === "blocked" ? "Room page is private" : "Room page could not load"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
              </div>
            </div>
          )}
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
