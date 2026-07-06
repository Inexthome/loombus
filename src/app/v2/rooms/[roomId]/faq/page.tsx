"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenCheck, CheckCircle2, Edit3, Pin, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { V2ShellMobileNav, V2ShellTopNav } from "../../../v2-shell-components";

type Row = Record<string, unknown>;
type LoadState = "checking" | "ready" | "signed_out" | "blocked" | "error";
type Room = { id: string; name: string; ownerId: string; createdBy: string };
type Member = { userId: string; role: string };
type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  category: string;
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

function normalizeFaq(row: Row): FaqEntry {
  return {
    id: asString(row.id),
    question: asString(row.question) || "Untitled question",
    answer: asString(row.answer),
    category: asString(row.category) || "general",
    isPinned: asBoolean(row.is_pinned),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message ?? "");
  return "Unknown FAQ loading error";
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

export default function V2RoomFaqPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] ?? "" : rawRoomId ?? ""), [rawRoomId]);

  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<FaqEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading FAQ data...");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("general");
  const [isPinned, setIsPinned] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const canManage = Boolean(isOwner || currentMember?.role === "owner" || currentMember?.role === "admin");
  const pinnedEntries = entries.filter((entry) => entry.isPinned);
  const categories = useMemo(() => Array.from(new Set(entries.map((entry) => entry.category).filter(Boolean))).sort(), [entries]);
  const filteredEntries = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      const categoryMatch = selectedCategory === "all" || entry.category === selectedCategory;
      const searchMatch = !needle || [entry.question, entry.answer, entry.category].join(" ").toLowerCase().includes(needle);
      return categoryMatch && searchMatch;
    });
  }, [entries, searchQuery, selectedCategory]);

  function resetForm() {
    setQuestion("");
    setAnswer("");
    setCategory("general");
    setIsPinned(false);
    setEditingId(null);
  }

  function startEdit(entry: FaqEntry) {
    setEditingId(entry.id);
    setQuestion(entry.question);
    setAnswer(entry.answer);
    setCategory(entry.category);
    setIsPinned(entry.isPinned);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadFaq() {
    if (!roomId) {
      setLoadState("error");
      setMessage("Loombus could not find the room ID for this FAQ.");
      return;
    }

    setLoadState("checking");
    setMessage("Loading FAQ data...");

    try {
      const { data: sessionData } = await withTimeout(supabase.auth.getSession(), "session check");
      const nextUserId = sessionData.session?.user.id ?? null;
      setUserId(nextUserId);

      if (!nextUserId) {
        setLoadState("signed_out");
        setMessage("Sign in first so Loombus can open this room FAQ.");
        setRoom(null);
        setMembers([]);
        setEntries([]);
        return;
      }

      const { data: roomData, error: roomError } = await withTimeout(supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(), "room lookup");
      if (roomError) throw roomError;

      const nextRoom = normalizeRoom((roomData as Row | null) ?? null);
      if (!nextRoom) {
        setLoadState("blocked");
        setMessage("Room FAQ is only available to approved room members.");
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
        setMessage("Room FAQ is only available to approved room members.");
        setEntries([]);
        return;
      }

      const { data: faqData, error: faqError } = await withTimeout(
        supabase.from("room_faq_entries").select("*").eq("room_id", roomId).order("is_pinned", { ascending: false }).order("category", { ascending: true }).order("question", { ascending: true }).limit(300),
        "FAQ lookup",
      );

      if (faqError) throw faqError;

      setEntries(((faqData ?? []) as Row[]).map(normalizeFaq).filter((entry) => entry.id));
      setLoadState("ready");
      setMessage("");
    } catch (error) {
      setRoom(null);
      setMembers([]);
      setEntries([]);
      setLoadState("error");
      setMessage(`Loombus could not load room FAQ. Details: ${getErrorMessage(error)}`);
    }
  }

  useEffect(() => {
    void loadFaq();
  }, [roomId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !canManage || !question.trim() || !answer.trim()) return;
    setSaving(true);
    setMessage("");

    const payload = {
      question: question.trim(),
      answer: answer.trim(),
      category: category.trim() || "general",
      is_pinned: isPinned,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("room_faq_entries").update(payload).eq("id", editingId);
        if (error) throw error;
        setMessage("FAQ entry updated.");
      } else {
        const { error } = await supabase.from("room_faq_entries").insert({
          ...payload,
          room_id: room.id,
          created_by: userId,
        });
        if (error) throw error;
        setMessage("FAQ entry added.");
      }

      resetForm();
      await loadFaq();
    } catch (error) {
      setMessage(`Loombus could not save this FAQ entry yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePinned(entry: FaqEntry) {
    if (!canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_faq_entries").update({ is_pinned: !entry.isPinned, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", entry.id);
      if (error) throw error;
      await loadFaq();
    } catch (error) {
      setMessage(`Loombus could not update this FAQ entry yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: FaqEntry) {
    if (!canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_faq_entries").delete().eq("id", entry.id);
      if (error) throw error;
      setMessage("FAQ entry removed.");
      if (editingId === entry.id) resetForm();
      await loadFaq();
    } catch (error) {
      setMessage(`Loombus could not remove this FAQ entry yet. Details: ${getErrorMessage(error)}`);
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
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200" style={{ color: "#fde68a" }}>Room Knowledge Base / FAQ</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl" style={{ color: "#ffffff" }}>{room?.name ?? "Room FAQ"}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50 sm:text-base" style={{ color: "#fff7ed" }}>Turn repeated questions, rules, steps, and procedures into a searchable room knowledge base.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{entries.length} FAQs</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{pinnedEntries.length} pinned</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{categories.length} categories</span>
            </div>
          </div>

          {loadState !== "ready" && (
            <div className="p-6">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <BookOpenCheck className="mx-auto size-9 text-amber-700" />
                <h2 className="mt-3 text-lg font-black text-slate-950">{loadState === "checking" ? "Checking FAQ access" : loadState === "signed_out" ? "Sign in required" : loadState === "blocked" ? "FAQ is private" : "FAQ could not load"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
                <button type="button" onClick={() => loadFaq()} className="mt-5 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">Retry</button>
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
                      <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Search FAQ questions, answers, or categories" />
                    </label>
                    <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100">
                      <option value="all">All categories</option>
                      {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                </section>

                {filteredEntries.map((entry) => (
                  <article key={entry.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          {entry.isPinned && <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-100">Pinned</span>}
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 ring-1 ring-slate-200">{entry.category}</span>
                        </div>
                        <h2 className="mt-3 text-xl font-black text-slate-950">{entry.question}</h2>
                        <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{entry.answer}</p>
                      </div>
                      {canManage && (
                        <div className="flex flex-col gap-2 sm:min-w-40">
                          <button type="button" disabled={saving} onClick={() => startEdit(entry)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:opacity-50"><Edit3 className="size-3" /> Edit</button>
                          <button type="button" disabled={saving} onClick={() => handleTogglePinned(entry)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100 transition hover:bg-amber-100 disabled:opacity-50"><Pin className="size-3" /> {entry.isPinned ? "Unpin" : "Pin"}</button>
                          <button type="button" disabled={saving} onClick={() => handleDelete(entry)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 ring-1 ring-red-100 transition hover:bg-red-100 disabled:opacity-50"><Trash2 className="size-3" /> Remove</button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}

                {filteredEntries.length === 0 && (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                    <BookOpenCheck className="mx-auto size-9 text-amber-700" />
                    <h2 className="mt-3 text-lg font-black text-slate-950">No FAQ entries found</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Add room rules, common questions, procedures, or instructions for members.</p>
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                {canManage && (
                  <form onSubmit={handleSubmit} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">{editingId ? "Edit FAQ" : "Add FAQ"}</h2>
                      <Plus className="size-4 text-amber-700" />
                    </div>
                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="faq-question">Question / title</label>
                    <input id="faq-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={240} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="How do we submit maintenance requests?" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="faq-category">Category</label>
                    <input id="faq-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={120} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="rules, maintenance, billing" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="faq-answer">Answer / explanation</label>
                    <textarea id="faq-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={7} maxLength={8000} required className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Explain the answer, rule, process, or steps members should follow." />

                    <label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">
                      <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="size-4 accent-amber-700" /> Pin important FAQ
                    </label>

                    <button type="submit" disabled={saving || !question.trim() || !answer.trim()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <CheckCircle2 className="size-4" /> {editingId ? "Save FAQ" : "Add FAQ"}
                    </button>
                    {editingId && <button type="button" onClick={resetForm} className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200">Cancel edit</button>}
                  </form>
                )}

                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">FAQ summary</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Entries</dt><dd className="font-black text-slate-900">{entries.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Pinned</dt><dd className="font-black text-slate-900">{pinnedEntries.length}</dd></div>
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
