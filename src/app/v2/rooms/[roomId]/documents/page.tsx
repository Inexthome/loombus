"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Edit3, ExternalLink, FileText, Pin, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { V2ShellMobileNav, V2ShellTopNav } from "../../../v2-shell-components";

type Row = Record<string, unknown>;
type LoadState = "checking" | "ready" | "signed_out" | "blocked" | "error";
type Room = { id: string; name: string; ownerId: string; createdBy: string };
type Member = { userId: string; role: string };
type RoomDocument = {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  isPinned: boolean;
};

const REQUEST_TIMEOUT_MS = 8000;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  return value === true;
}

function normalizeRoom(row: Row | null): Room | null {
  if (!row) return null;
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || "Private room",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
  };
}

function normalizeMember(row: Row): Member {
  return { userId: asString(row.user_id), role: asString(row.role) || "member" };
}

function normalizeDocument(row: Row): RoomDocument {
  return {
    id: asString(row.id),
    title: asString(row.title) || "Untitled document",
    description: asString(row.description),
    category: asString(row.category) || "general",
    fileUrl: asString(row.file_url),
    isPinned: asBoolean(row.is_pinned),
  };
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message ?? "");
  return "Unknown documents loading error";
}

async function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export default function V2RoomDocumentsPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] ?? "" : rawRoomId ?? ""), [rawRoomId]);

  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [documents, setDocuments] = useState<RoomDocument[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading documents...");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [fileUrl, setFileUrl] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const canManage = Boolean(isOwner || currentMember?.role === "owner" || currentMember?.role === "admin");
  const pinnedDocuments = documents.filter((document) => document.isPinned);
  const categories = useMemo(() => Array.from(new Set(documents.map((document) => document.category).filter(Boolean))).sort(), [documents]);
  const filteredDocuments = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return documents.filter((document) => {
      const categoryMatch = selectedCategory === "all" || document.category === selectedCategory;
      const searchMatch = !needle || [document.title, document.description, document.category, document.fileUrl].join(" ").toLowerCase().includes(needle);
      return categoryMatch && searchMatch;
    });
  }, [documents, searchQuery, selectedCategory]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategory("general");
    setFileUrl("");
    setIsPinned(false);
    setEditingId(null);
  }

  function startEdit(document: RoomDocument) {
    setEditingId(document.id);
    setTitle(document.title);
    setDescription(document.description);
    setCategory(document.category);
    setFileUrl(document.fileUrl);
    setIsPinned(document.isPinned);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadDocuments() {
    if (!roomId) {
      setLoadState("error");
      setMessage("Loombus could not find the room ID for these documents.");
      return;
    }

    setLoadState("checking");
    setMessage("Loading documents...");

    try {
      const { data: sessionData } = await withTimeout(supabase.auth.getSession(), "session check");
      const nextUserId = sessionData.session?.user.id ?? null;
      setUserId(nextUserId);

      if (!nextUserId) {
        setLoadState("signed_out");
        setMessage("Sign in first so Loombus can open these room documents.");
        setRoom(null);
        setMembers([]);
        setDocuments([]);
        return;
      }

      const { data: roomData, error: roomError } = await withTimeout(supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(), "room lookup");
      if (roomError) throw roomError;

      const nextRoom = normalizeRoom((roomData as Row | null) ?? null);
      if (!nextRoom) {
        setLoadState("blocked");
        setMessage("Room documents are only available to approved room members.");
        return;
      }

      const { data: memberData, error: memberError } = await withTimeout(supabase.from("room_members").select("*").eq("room_id", roomId), "member lookup");
      if (memberError) throw memberError;

      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      const nextMember = nextMembers.find((member) => member.userId === nextUserId);
      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      const nextCanAccess = Boolean(nextIsOwner || nextMember);

      setRoom(nextRoom);
      setMembers(nextMembers);

      if (!nextCanAccess) {
        setLoadState("blocked");
        setMessage("Room documents are only available to approved room members.");
        setDocuments([]);
        return;
      }

      const { data: documentData, error: documentError } = await withTimeout(
        supabase.from("room_documents").select("*").eq("room_id", roomId).order("is_pinned", { ascending: false }).order("category", { ascending: true }).order("title", { ascending: true }).limit(300),
        "documents lookup",
      );

      if (documentError) throw documentError;

      setDocuments(((documentData ?? []) as Row[]).map(normalizeDocument).filter((document) => document.id));
      setLoadState("ready");
      setMessage("");
    } catch (error) {
      setRoom(null);
      setMembers([]);
      setDocuments([]);
      setLoadState("error");
      setMessage(`Loombus could not load room documents. Details: ${getErrorMessage(error)}`);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, [roomId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !canManage || !title.trim() || !fileUrl.trim()) return;
    setSaving(true);
    setMessage("");

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || "general",
      file_url: normalizeUrl(fileUrl),
      is_pinned: isPinned,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("room_documents").update(payload).eq("id", editingId);
        if (error) throw error;
        setMessage("Document updated.");
      } else {
        const { error } = await supabase.from("room_documents").insert({
          ...payload,
          room_id: room.id,
          created_by: userId,
        });
        if (error) throw error;
        setMessage("Document added.");
      }

      resetForm();
      await loadDocuments();
    } catch (error) {
      setMessage(`Loombus could not save this document yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePinned(document: RoomDocument) {
    if (!canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_documents").update({ is_pinned: !document.isPinned, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", document.id);
      if (error) throw error;
      await loadDocuments();
    } catch (error) {
      setMessage(`Loombus could not update this document yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(document: RoomDocument) {
    if (!canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_documents").delete().eq("id", document.id);
      if (error) throw error;
      setMessage("Document removed.");
      if (editingId === document.id) resetForm();
      await loadDocuments();
    } catch (error) {
      setMessage(`Loombus could not remove this document yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" /> Back to room
        </Link>

        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200" style={{ color: "#fde68a" }}>Room Files / Documents</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl" style={{ color: "#ffffff" }}>{room?.name ?? "Room Documents"}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50 sm:text-base" style={{ color: "#fff7ed" }}>Keep important room documents, forms, packets, handbooks, bylaws, and external file links in one member-facing place.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{documents.length} documents</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{pinnedDocuments.length} pinned</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{categories.length} categories</span>
            </div>
          </div>

          {loadState !== "ready" && (
            <div className="p-6">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <FileText className="mx-auto size-9 text-amber-700" />
                <h2 className="mt-3 text-lg font-black text-slate-950">{loadState === "checking" ? "Checking document access" : loadState === "signed_out" ? "Sign in required" : loadState === "blocked" ? "Documents are private" : "Documents could not load"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
                <button type="button" onClick={() => void loadDocuments()} className="mt-5 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">Retry</button>
              </div>
            </div>
          )}

          {loadState === "ready" && (
            <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-4">
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row">
                    <label className="relative flex-1">
                      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Search documents, descriptions, categories, or links" />
                    </label>
                    <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100">
                      <option value="all">All categories</option>
                      {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                </section>

                {filteredDocuments.map((document) => (
                  <article key={document.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          {document.isPinned && <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-100">Pinned</span>}
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 ring-1 ring-slate-200">{document.category}</span>
                        </div>
                        <h2 className="mt-3 text-xl font-black text-slate-950">{document.title}</h2>
                        {document.description && <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{document.description}</p>}
                        <a href={document.fileUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
                          <ExternalLink className="size-4" /> Open document
                        </a>
                      </div>
                      {canManage && (
                        <div className="flex flex-col gap-2 sm:min-w-40">
                          <button type="button" disabled={saving} onClick={() => startEdit(document)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:opacity-50"><Edit3 className="size-3" /> Edit</button>
                          <button type="button" disabled={saving} onClick={() => void handleTogglePinned(document)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100 transition hover:bg-amber-100 disabled:opacity-50"><Pin className="size-3" /> {document.isPinned ? "Unpin" : "Pin"}</button>
                          <button type="button" disabled={saving} onClick={() => void handleDelete(document)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 ring-1 ring-red-100 transition hover:bg-red-100 disabled:opacity-50"><Trash2 className="size-3" /> Remove</button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}

                {filteredDocuments.length === 0 && (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                    <FileText className="mx-auto size-9 text-amber-700" />
                    <h2 className="mt-3 text-lg font-black text-slate-950">No documents found</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Add room bylaws, forms, packets, handbooks, policies, or external file links for members.</p>
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                {canManage && (
                  <form onSubmit={handleSubmit} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">{editingId ? "Edit document" : "Add document"}</h2>
                      <Plus className="size-4 text-amber-700" />
                    </div>
                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="document-title">Document title</label>
                    <input id="document-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="HOA bylaws" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="document-category">Category</label>
                    <input id="document-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={120} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="forms, bylaws, packets" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="document-url">External file / link URL</label>
                    <input id="document-url" value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} maxLength={1000} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="https://example.com/document.pdf" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="document-description">Description</label>
                    <textarea id="document-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={4000} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Explain what this document is for and when members should use it." />

                    <label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">
                      <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="size-4 accent-amber-700" /> Pin important document
                    </label>

                    <button type="submit" disabled={saving || !title.trim() || !fileUrl.trim()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <CheckCircle2 className="size-4" /> {editingId ? "Save document" : "Add document"}
                    </button>
                    {editingId && <button type="button" onClick={resetForm} className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200">Cancel edit</button>}
                  </form>
                )}

                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Document summary</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Documents</dt><dd className="font-black text-slate-900">{documents.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Pinned</dt><dd className="font-black text-slate-900">{pinnedDocuments.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Categories</dt><dd className="font-black text-slate-900">{categories.length}</dd></div>
                  </dl>
                </section>
              </aside>
            </div>
          )}
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
