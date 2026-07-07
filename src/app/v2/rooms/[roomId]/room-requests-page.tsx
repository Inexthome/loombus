"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, FileText, LayoutGrid, Send } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { V2ShellMobileNav, V2ShellTopNav } from "../../v2-shell-components";

type Row = Record<string, unknown>;
type LoadState = "checking" | "ready" | "signed_out" | "blocked" | "error";
type Room = { id: string; name: string; description: string; ownerId: string; createdBy: string; plan: string };
type RequestForm = { title: string; details: string; category: string; priority: string };
type RequestItem = { id: string; title: string; details: string; meta: string };

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

function normalizeRequest(row: Row, index: number): RequestItem {
  const state = asString(row.status) || asString(row.state) || "submitted";
  const category = asString(row.category) || asString(row.type) || "general";
  const priority = asString(row.priority) || "normal";
  return {
    id: asString(row.id) || `request-${index}`,
    title: asString(row.title) || "Untitled request",
    details: asString(row.details) || asString(row.body) || asString(row.message) || asString(row.content) || "Room request",
    meta: [state, category, priority, formatDate(row.created_at)].join(" • "),
  };
}

async function fetchRequests(roomId: string) {
  const { data, error } = await supabase.from("room_requests").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(60);
  if (error) return [];
  return ((data ?? []) as Row[]).map((row, index) => normalizeRequest(row, index));
}

async function insertRequest(roomId: string, userId: string, form: RequestForm) {
  const payload = {
    room_id: roomId,
    title: form.title.trim(),
    details: form.details.trim(),
    category: form.category,
    priority: form.priority,
  };

  const attempts = [
    { ...payload, status: "submitted", requester_id: userId, created_by: userId },
    { ...payload, status: "submitted", created_by: userId },
    { ...payload, state: "submitted", created_by: userId },
    { ...payload, created_by: userId },
    payload,
  ];

  let lastMessage = "Loombus could not submit this request yet.";
  for (const attempt of attempts) {
    const { error } = await supabase.from("room_requests").insert(attempt);
    if (!error) return { ok: true, message: "Request submitted to this room." };
    lastMessage = error.message || lastMessage;
  }

  return { ok: false, message: lastMessage };
}

function RequestSubmitPanel({
  form,
  isSaving,
  notice,
  onChange,
  onSubmit,
}: {
  form: RequestForm;
  isSaving: boolean;
  notice: string;
  onChange: (field: keyof RequestForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Member request</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Submit a request</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">Send maintenance needs, HOA questions, access requests, service issues, or general room requests to the room owner/admin team.</p>
        </div>
        <ClipboardList className="size-6 text-amber-700" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
          Request title
          <input
            required
            value={form.title}
            onChange={(event) => onChange("title", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none ring-0 transition focus:border-amber-400"
            placeholder="Leaking pipe, parking concern, gate issue, account question..."
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
          Details
          <textarea
            required
            rows={4}
            value={form.details}
            onChange={(event) => onChange("details", event.target.value)}
            className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none ring-0 transition focus:border-amber-400"
            placeholder="Describe what happened, what is needed, and any useful context."
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Category
          <select
            value={form.category}
            onChange={(event) => onChange("category", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none ring-0 transition focus:border-amber-400"
          >
            <option value="general">General</option>
            <option value="maintenance">Maintenance</option>
            <option value="hoa">HOA / Board</option>
            <option value="access">Access</option>
            <option value="service">Service</option>
            <option value="safety">Safety</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Priority
          <select
            value={form.priority}
            onChange={(event) => onChange("priority", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none ring-0 transition focus:border-amber-400"
          >
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </div>

      {notice && <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 ring-1 ring-amber-100">{notice}</p>}

      <button
        type="submit"
        disabled={isSaving}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="size-4" /> {isSaving ? "Submitting request..." : "Submit request"}
      </button>
    </form>
  );
}

function RequestList({ items, canManage }: { items: RequestItem[]; canManage: boolean }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
        <FileText className="mx-auto size-9 text-amber-700" />
        <h2 className="mt-3 text-lg font-black text-slate-950">No requests yet</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Submitted room requests will appear here once members start sending them.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">{canManage ? "Submitted requests" : "Your visible requests"}</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Room requests</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 ring-1 ring-slate-200">{items.length} listed</span>
      </div>
      {items.map((item) => (
        <article key={item.id} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-950">{item.title}</h2>
              <p className="mt-2 line-clamp-4 text-sm font-semibold leading-6 text-slate-600">{item.details}</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">{item.meta}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function RoomRequestsPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] ?? "" : rawRoomId ?? ""), [rawRoomId]);

  const [state, setState] = useState<LoadState>("checking");
  const [message, setMessage] = useState("Loading room requests...");
  const [room, setRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [canManageRoom, setCanManageRoom] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [form, setForm] = useState<RequestForm>({ title: "", details: "", category: "general", priority: "normal" });
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

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

        const nextItems = await fetchRequests(roomId);
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
          setMessage("Loombus could not load room requests yet.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId || !currentUserId) return;

    if (!form.title.trim() || !form.details.trim()) {
      setNotice("Add a title and details first.");
      return;
    }

    setIsSaving(true);
    setNotice("");

    const result = await insertRequest(roomId, currentUserId, form);
    if (!result.ok) {
      setNotice(result.message);
      setIsSaving(false);
      return;
    }

    const nextItems = await fetchRequests(roomId);
    setItems(nextItems);
    setForm({ title: "", details: "", category: "general", priority: "normal" });
    setNotice(result.message);
    setIsSaving(false);
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
                <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200" style={{ color: "#fde68a" }}>Room requests</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl" style={{ color: "#ffffff" }}>Requests</h1>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50 sm:text-base" style={{ color: "#fff7ed" }}>A dedicated page for members to submit room requests and for owners/admins to review what needs attention.</p>
              </div>
              <div className="grid size-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <ClipboardList className="size-7 text-amber-200" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{room?.name ?? "Private room"}</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{canManageRoom ? "Owner/Admin view" : "Member view"}</span>
            </div>
          </div>

          {state === "ready" && (
            <div className="grid gap-5 p-5 sm:p-6">
              <RequestSubmitPanel
                form={form}
                isSaving={isSaving}
                notice={notice}
                onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
                onSubmit={handleSubmit}
              />
              <RequestList items={items} canManage={canManageRoom} />
            </div>
          )}

          {state !== "ready" && (
            <div className="p-6">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <ClipboardList className="mx-auto size-9 text-amber-700" />
                <h2 className="mt-3 text-lg font-black text-slate-950">{state === "checking" ? "Checking room access" : state === "signed_out" ? "Sign in required" : state === "blocked" ? "Room page is private" : "Room requests could not load"}</h2>
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
