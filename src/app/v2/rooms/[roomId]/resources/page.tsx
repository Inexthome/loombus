"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Plus, Save } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../../v2-shell-components";

type Row = Record<string, unknown>;
type Room = { id: string; name: string; ownerId: string; createdBy: string; isPrivate: boolean };
type Member = { userId: string; role: string };
type Resource = { id: string; title: string; description: string; resourceType: string; url: string; body: string; isPinned: boolean; createdAt: string | null };

const RESOURCE_TYPES = ["link", "document", "note", "rule", "form", "other"];

function asString(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function asBoolean(value: unknown) { if (typeof value === "boolean") return value; if (typeof value === "string") return ["true", "private", "locked", "invite_only"].includes(value.toLowerCase()); return false; }
function normalizeRoom(row: Row): Room { const visibility = asString(row.visibility).toLowerCase(); return { id: asString(row.id) || asString(row.room_id), name: asString(row.name) || asString(row.title) || "Untitled room", ownerId: asString(row.owner_id), createdBy: asString(row.created_by), isPrivate: asBoolean(row.is_private) || asBoolean(row.private) || visibility === "private" }; }
function normalizeMember(row: Row): Member { return { userId: asString(row.user_id), role: asString(row.role) || "member" }; }
function normalizeResource(row: Row, index: number): Resource { return { id: asString(row.id) || `resource-${index}`, title: asString(row.title) || "Untitled resource", description: asString(row.description), resourceType: asString(row.resource_type) || "link", url: asString(row.url), body: asString(row.body), isPinned: asBoolean(row.is_pinned), createdAt: asString(row.created_at) || null }; }
function formatRelativeTime(value: string | null) { if (!value) return "recently"; const timestamp = new Date(value).getTime(); if (!Number.isFinite(timestamp)) return "recently"; const diffMinutes = Math.floor((Date.now() - timestamp) / 60000); if (diffMinutes < 1) return "just now"; if (diffMinutes < 60) return `${diffMinutes}m ago`; const diffHours = Math.floor(diffMinutes / 60); if (diffHours < 24) return `${diffHours}h ago`; return `${Math.floor(diffHours / 24)}d ago`; }
function normalizeUrl(value: string) { const trimmed = value.trim(); if (!trimmed) return null; return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`; }

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
  const [resourceType, setResourceType] = useState("link");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";
  const isMember = Boolean(currentMember);
  const canAccess = Boolean(room && userId && (isOwner || isMember));
  const canManage = Boolean(room && userId && (isOwner || isAdmin));
  const pinnedResources = resources.filter((resource) => resource.isPinned);
  const regularResources = resources.filter((resource) => !resource.isPinned);

  async function loadResources() {
    const targetRoomId = roomId;
    if (!targetRoomId) return;
    const { data } = await supabase.from("room_resources").select("*").eq("room_id", targetRoomId).order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
    setResources(((data ?? []) as Row[]).map(normalizeResource));
  }

  async function loadRoom() {
    const targetRoomId = roomId;
    if (!targetRoomId) return;
    setLoading(true); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const nextUserId = data.session?.user.id ?? null;
      setUserId(nextUserId);
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
      if (!nextUserId || !accessToken || !nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") { setRoom(null); setMembers([]); setResources([]); return; }
      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("id", targetRoomId).maybeSingle();
      if (roomError || !roomData) { setRoom(null); setMembers([]); setResources([]); setMessage("Resources are only visible to approved room members."); return; }
      const nextRoom = normalizeRoom(roomData as Row);
      setRoom(nextRoom);
      const { data: memberData } = await supabase.from("room_members").select("*").eq("room_id", targetRoomId).order("created_at", { ascending: true });
      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      setMembers(nextMembers);
      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      const nextIsMember = nextMembers.some((member) => member.userId === nextUserId);
      if (nextRoom.isPrivate && !nextIsOwner && !nextIsMember) { setResources([]); setMessage("Resources are private to approved room members."); return; }
      await loadResources();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRoom(); }, [roomId]);

  async function handleCreateResource() {
    if (!room || !userId || !canManage || !title.trim()) return;
    setSaving(true); setMessage("");
    try {
      const { error } = await supabase.from("room_resources").insert({ room_id: room.id, title: title.trim(), description: description.trim(), resource_type: resourceType, url: normalizeUrl(url), body: body.trim(), is_pinned: isPinned, created_by: userId, updated_by: userId });
      if (error) { setMessage(error.message || "Unable to save resource."); return; }
      setTitle(""); setDescription(""); setResourceType("link"); setUrl(""); setBody(""); setIsPinned(false);
      await loadResources(); setMessage("Resource saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePinned(resource: Resource) {
    if (!canManage || !userId) return;
    setSaving(true); setMessage("");
    try {
      const { error } = await supabase.from("room_resources").update({ is_pinned: !resource.isPinned, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", resource.id);
      if (error) { setMessage(error.message || "Unable to update resource."); return; }
      await loadResources();
    } finally {
      setSaving(false);
    }
  }

  const gatePayload = payload ?? getDefaultShellPayload();
  if (loading) return <V2ShellGateCard payload={gatePayload} title="Loading room resources" message="Checking room access and resources." />;
  if (payload === null || !payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard payload={gatePayload} title="V2 shell unavailable" message="Room resources are available inside the V2 shell." />;
  if (room === null || !canAccess) return <V2ShellGateCard payload={gatePayload} title="Resources are private" message={message || "Resources are only visible to approved room members."} />;

  const activePayload = payload;
  const activeRoom = room;

  function renderResource(resource: Resource) {
    return (
      <article key={resource.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-2">
              {resource.isPinned && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">Pinned</span>}
              <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{resource.resourceType}</span>
            </div>
            <h2 className="mt-3 text-lg font-black text-slate-950">{resource.title}</h2>
            {resource.description && <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{resource.description}</p>}
          </div>
          <p className="text-xs font-bold text-slate-400">Added {formatRelativeTime(resource.createdAt)}</p>
        </div>
        {resource.body && <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 ring-1 ring-slate-200">{resource.body}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {resource.url && <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"><ExternalLink className="size-4" /> Open resource</a>}
          {canManage && <button type="button" onClick={() => handleTogglePinned(resource)} disabled={saving} className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50">{resource.isPinned ? "Unpin" : "Pin"}</button>}
        </div>
      </article>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <V2ShellTopNav payload={activePayload} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-28 pt-24 sm:px-6 lg:px-8">
        <Link href={`/rooms/${activeRoom.id}`} className="inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"><ArrowLeft className="size-4" /> Back to room</Link>
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Room resources</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{activeRoom.name} Resources</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">Keep documents, links, rules, forms, and room notes in one private place.</p>
        </section>
        {message && <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-100">{message}</p>}
        {canManage && (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100"><Plus className="size-5" /></span><div><h2 className="text-xl font-black text-slate-950">Add resource</h2><p className="text-sm font-semibold text-slate-500">Owners and admins can publish resources to approved room members.</p></div></div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Resource title" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-amber-500" />
              <select value={resourceType} onChange={(event) => setResourceType(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-amber-500">{RESOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Optional URL" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-amber-500 lg:col-span-2" />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short description" rows={3} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-amber-500 lg:col-span-2" />
              <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Optional note, rule, instructions, or details" rows={5} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-amber-500 lg:col-span-2" />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><label className="inline-flex items-center gap-2 text-sm font-black text-slate-700"><input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="size-4" /> Pin this resource</label><button type="button" onClick={handleCreateResource} disabled={saving || !title.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"><Save className="size-4" /> Save resource</button></div>
          </section>
        )}
        <section className="grid gap-5 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-5">
            {pinnedResources.length > 0 && <div className="space-y-4"><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Pinned resources</h2>{pinnedResources.map(renderResource)}</div>}
            <div className="space-y-4"><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">All resources</h2>{regularResources.length > 0 ? regularResources.map(renderResource) : <p className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 shadow-sm">No resources yet.</p>}</div>
          </div>
          <aside className="h-fit rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><FileText className="size-5 text-amber-700" /><h2 className="mt-3 text-sm font-black uppercase tracking-[0.16em] text-slate-500">Resource types</h2><div className="mt-4 space-y-2 text-sm font-bold text-slate-600">{RESOURCE_TYPES.map((type) => <p key={type} className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">{type}</p>)}</div><p className="mt-4 text-xs font-semibold leading-5 text-slate-500">Resources are visible only to approved room members and owners.</p></aside>
        </section>
      </main>
      <V2ShellMobileNav payload={activePayload} />
    </div>
  );
}
