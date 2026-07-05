"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ExternalLink, FileText, Pin, Plus, Save } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../../v2-shell-components";

type Row = Record<string, unknown>;

type Room = {
  id: string;
  name: string;
  ownerId: string;
  createdBy: string;
  isPrivate: boolean;
};

type Member = {
  userId: string;
  role: string;
};

type Resource = {
  id: string;
  title: string;
  description: string;
  resourceType: string;
  url: string;
  body: string;
  isPinned: boolean;
  createdAt: string | null;
};

const RESOURCE_TYPES = ["link", "document", "note", "rule", "form", "other"] as const;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "private", "locked", "invite_only"].includes(value.toLowerCase());
  return false;
}

function normalizeRoom(row: Row): Room {
  const visibility = asString(row.visibility).toLowerCase();
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || "Untitled room",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
    isPrivate: asBoolean(row.is_private) || asBoolean(row.private) || visibility === "private",
  };
}

function normalizeMember(row: Row): Member {
  return {
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
  };
}

function normalizeResource(row: Row, index: number): Resource {
  return {
    id: asString(row.id) || `resource-${index}`,
    title: asString(row.title) || "Untitled resource",
    description: asString(row.description),
    resourceType: asString(row.resource_type) || "link",
    url: asString(row.url),
    body: asString(row.body),
    isPinned: asBoolean(row.is_pinned),
    createdAt: asString(row.created_at) || null,
  };
}

function formatRelativeTime(value: string | null) {
  if (!value) return "Recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function V2RoomResourcesPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => {
    if (Array.isArray(rawRoomId)) return rawRoomId[0] ?? "";
    return rawRoomId ?? "";
  }, [rawRoomId]);

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState<(typeof RESOURCE_TYPES)[number]>("link");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";
  const canAccess = Boolean(room && userId && (isOwner || currentMember));
  const canManage = Boolean(room && userId && (isOwner || isAdmin));
  const pinnedResources = resources.filter((resource) => resource.isPinned);
  const regularResources = resources.filter((resource) => !resource.isPinned);

  async function loadResources(targetRoomId = roomId) {
    if (!targetRoomId) return;

    const { data, error } = await supabase
      .from("room_resources")
      .select("*")
      .eq("room_id", targetRoomId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    setResources(error ? [] : ((data ?? []) as Row[]).map(normalizeResource));
  }

  async function loadRoom() {
    if (!roomId) return;
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const nextUserId = data.session?.user.id ?? null;
      setUserId(nextUserId);

      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (!nextUserId || !accessToken || !nextPayload.authenticated || !nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") {
        setRoom(null);
        setMembers([]);
        setResources([]);
        return;
      }

      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (roomError || !roomData) {
        setRoom(null);
        setMembers([]);
        setResources([]);
        setMessage("Resources are only visible to approved room members.");
        return;
      }

      const nextRoom = normalizeRoom(roomData as Row);
      setRoom(nextRoom);

      const { data: memberData } = await supabase.from("room_members").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      setMembers(nextMembers);

      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      const nextIsMember = nextMembers.some((member) => member.userId === nextUserId);
      if (nextRoom.isPrivate && !nextIsOwner && !nextIsMember) {
        setResources([]);
        setMessage("Resources are private to approved room members.");
        return;
      }

      await loadResources(roomId);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load room resources right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoom();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadRoom();
    });
    return () => data.subscription.unsubscribe();
  }, [roomId]);

  async function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !canManage || !title.trim()) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_resources").insert({
        room_id: room.id,
        title: title.trim(),
        description: description.trim(),
        resource_type: resourceType,
        url: normalizeUrl(url),
        body: body.trim(),
        is_pinned: isPinned,
        created_by: userId,
        updated_by: userId,
      });

      if (error) throw error;
      setTitle("");
      setDescription("");
      setResourceType("link");
      setUrl("");
      setBody("");
      setIsPinned(false);
      setMessage("Resource saved.");
      await loadResources();
    } catch {
      setMessage("Loombus could not save this resource yet. Confirm the room_resources migration and RLS policies are active.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePinned(resource: Resource) {
    if (!canManage || !userId) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("room_resources")
        .update({ is_pinned: !resource.isPinned, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("id", resource.id);

      if (error) throw error;
      setMessage(resource.isPinned ? "Resource unpinned." : "Resource pinned.");
      await loadResources();
    } catch {
      setMessage("Loombus could not update this resource yet.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <V2ShellGateCard title="Opening resources" message="Loombus is loading this room resource center." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open this room." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;

  function renderResource(resource: Resource) {
    return (
      <article key={resource.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-2">
              {resource.isPinned && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">Pinned</span>}
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{resource.resourceType}</span>
            </div>
            <h3 className="mt-3 text-lg font-black text-slate-950">{resource.title}</h3>
            {resource.description && <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{resource.description}</p>}
            <p className="mt-3 text-xs font-semibold text-slate-400">Added {formatRelativeTime(resource.createdAt)}</p>
          </div>
        </div>

        {resource.body && <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 ring-1 ring-slate-200">{resource.body}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {resource.url && (
            <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
              <ExternalLink className="size-4" /> Open resource
            </a>
          )}
          {canManage && (
            <button type="button" onClick={() => handleTogglePinned(resource)} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              <Pin className="size-4" /> {resource.isPinned ? "Unpin" : "Pin"}
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-6xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" /> Back to room
        </Link>
        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Room Resource Center</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{room?.name ?? "Room resources"}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">Publish and find private room links, documents, rules, forms, notes, and guides.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{resources.length} total</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{pinnedResources.length} pinned</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{canManage ? "Owner/admin tools" : "Member view"}</span>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              {canManage ? (
                <form onSubmit={handleCreateResource} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3">
                    <Plus className="size-5 text-amber-700" />
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Add resource</h2>
                      <p className="mt-1 text-sm text-slate-600">Owners and admins can publish resources to approved room members.</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                    <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Resource title" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                    <select value={resourceType} onChange={(event) => setResourceType(event.target.value as (typeof RESOURCE_TYPES)[number])} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100">
                      {RESOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Optional URL" className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short description" rows={3} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Optional note, rule, instructions, or details" rows={5} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm font-black text-slate-700">
                      <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="size-4" /> Pin this resource
                    </label>
                    <button type="submit" disabled={saving || !title.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <Save className="size-4" /> Save resource
                    </button>
                  </div>
                </form>
              ) : (
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Member resource library</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Approved members can view room resources. Owners and admins manage what gets published.</p>
                </section>
              )}

              {pinnedResources.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Pinned resources</h2>
                  {pinnedResources.map(renderResource)}
                </section>
              )}

              <section className="space-y-3">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">All resources</h2>
                {regularResources.length > 0 ? regularResources.map(renderResource) : (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                    <FileText className="mx-auto size-9 text-amber-700" />
                    <h2 className="mt-3 text-lg font-black text-slate-950">No room resources yet</h2>
                    <p className="mt-2 text-sm text-slate-600">Add the first document, link, rule, form, note, or guide for this room.</p>
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Library status</h2><FileText className="size-4 text-amber-700" /></div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Total</dt><dd className="font-black text-slate-900">{resources.length}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Pinned</dt><dd className="font-black text-slate-900">{pinnedResources.length}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Access</dt><dd className="font-black text-slate-900">Private</dd></div>
                </dl>
              </section>
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Resource types</h2>
                <div className="mt-4 space-y-2 text-sm font-bold text-slate-600">
                  {RESOURCE_TYPES.map((type) => <p key={type} className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">{type}</p>)}
                </div>
              </section>
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">How to use</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Use resources for durable information. Use announcements for urgent updates, discussions for conversation, and requests for tracked action items.</p>
              </section>
            </aside>
          </div>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
