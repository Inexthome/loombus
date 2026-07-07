"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, Edit3, Plus, Search, Send, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { V2ShellMobileNav, V2ShellTopNav } from "../../../v2-shell-components";

type Row = Record<string, unknown>;
type LoadState = "checking" | "ready" | "signed_out" | "blocked" | "error";
type SubmissionStatus = "new" | "reviewing" | "approved" | "rejected" | "archived";
type Room = { id: string; name: string; ownerId: string; createdBy: string };
type Member = { userId: string; role: string };
type RoomForm = {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: string[];
};
type FormAnswer = { question: string; answer: string };
type FormSubmission = {
  id: string;
  formId: string;
  submittedBy: string;
  answers: FormAnswer[];
  status: SubmissionStatus;
  reviewNote: string;
  createdAt: string | null;
};

const REQUEST_TIMEOUT_MS = 8000;
const STATUS_OPTIONS: SubmissionStatus[] = ["new", "reviewing", "approved", "rejected", "archived"];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatus(value: unknown): SubmissionStatus {
  const status = asString(value) as SubmissionStatus;
  return STATUS_OPTIONS.includes(status) ? status : "new";
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

function decodeQuestions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((question) => asString(question)).filter(Boolean).slice(0, 30);
}

function decodeAnswers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Row;
      return { question: asString(row.question), answer: asString(row.answer) };
    })
    .filter((answer): answer is FormAnswer => Boolean(answer && (answer.question || answer.answer)))
    .slice(0, 50);
}

function normalizeForm(row: Row): RoomForm {
  return {
    id: asString(row.id),
    title: asString(row.title) || "Untitled form",
    description: asString(row.description),
    category: asString(row.category) || "general",
    questions: decodeQuestions(row.questions),
  };
}

function normalizeSubmission(row: Row): FormSubmission {
  return {
    id: asString(row.id),
    formId: asString(row.form_id),
    submittedBy: asString(row.submitted_by),
    answers: decodeAnswers(row.answers),
    status: normalizeStatus(row.status),
    reviewNote: asString(row.review_note),
    createdAt: asString(row.created_at) || null,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message ?? "");
  return "Unknown forms loading error";
}

function getDateLabel(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function statusLabel(status: SubmissionStatus) {
  return status.replace("_", " ");
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

export default function V2RoomFormsPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] ?? "" : rawRoomId ?? ""), [rawRoomId]);

  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [forms, setForms] = useState<RoomForm[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading forms...");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [questionText, setQuestionText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, Record<number, string>>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const canManage = Boolean(isOwner || currentMember?.role === "owner" || currentMember?.role === "admin");
  const categories = useMemo(() => Array.from(new Set(forms.map((form) => form.category).filter(Boolean))).sort(), [forms]);
  const filteredForms = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return forms.filter((form) => {
      const categoryMatch = selectedCategory === "all" || form.category === selectedCategory;
      const searchMatch = !needle || [form.title, form.description, form.category, ...form.questions].join(" ").toLowerCase().includes(needle);
      return categoryMatch && searchMatch;
    });
  }, [forms, searchQuery, selectedCategory]);

  function resetFormEditor() {
    setTitle("");
    setDescription("");
    setCategory("general");
    setQuestionText("");
    setEditingId(null);
  }

  function startEdit(form: RoomForm) {
    setEditingId(form.id);
    setTitle(form.title);
    setDescription(form.description);
    setCategory(form.category);
    setQuestionText(form.questions.join("\n"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submissionsForForm(formId: string) {
    return submissions.filter((submission) => submission.formId === formId);
  }

  async function loadForms() {
    if (!roomId) {
      setLoadState("error");
      setMessage("Loombus could not find the room ID for these forms.");
      return;
    }

    setLoadState("checking");
    setMessage("Loading forms...");

    try {
      const { data: sessionData } = await withTimeout(supabase.auth.getSession(), "session check");
      const nextUserId = sessionData.session?.user.id ?? null;
      setUserId(nextUserId);

      if (!nextUserId) {
        setLoadState("signed_out");
        setMessage("Sign in first so Loombus can open these room forms.");
        setRoom(null);
        setMembers([]);
        setForms([]);
        setSubmissions([]);
        return;
      }

      const { data: roomData, error: roomError } = await withTimeout(supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(), "room lookup");
      if (roomError) throw roomError;

      const nextRoom = normalizeRoom((roomData as Row | null) ?? null);
      if (!nextRoom) {
        setLoadState("blocked");
        setMessage("Room forms are only available to approved room members.");
        return;
      }

      const { data: memberData, error: memberError } = await withTimeout(supabase.from("room_members").select("*").eq("room_id", roomId), "member lookup");
      if (memberError) throw memberError;

      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      const nextMember = nextMembers.find((member) => member.userId === nextUserId);
      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      const nextCanAccess = Boolean(nextIsOwner || nextMember);
      const nextCanManage = Boolean(nextIsOwner || nextMember?.role === "owner" || nextMember?.role === "admin");

      setRoom(nextRoom);
      setMembers(nextMembers);

      if (!nextCanAccess) {
        setLoadState("blocked");
        setMessage("Room forms are only available to approved room members.");
        setForms([]);
        setSubmissions([]);
        return;
      }

      const [{ data: formData, error: formError }, { data: submissionData, error: submissionError }] = await Promise.all([
        withTimeout(supabase.from("room_forms").select("*").eq("room_id", roomId).order("category", { ascending: true }).order("title", { ascending: true }).limit(200), "forms lookup"),
        withTimeout(
          nextCanManage
            ? supabase.from("room_form_submissions").select("*").eq("room_id", roomId).order("updated_at", { ascending: false }).limit(300)
            : supabase.from("room_form_submissions").select("*").eq("room_id", roomId).eq("submitted_by", nextUserId).order("updated_at", { ascending: false }).limit(100),
          "submissions lookup",
        ),
      ]);

      if (formError) throw formError;
      if (submissionError) throw submissionError;

      const nextSubmissions = ((submissionData ?? []) as Row[]).map(normalizeSubmission).filter((submission) => submission.id);
      setForms(((formData ?? []) as Row[]).map(normalizeForm).filter((form) => form.id));
      setSubmissions(nextSubmissions);
      setReviewNotes(Object.fromEntries(nextSubmissions.map((submission) => [submission.id, submission.reviewNote])));
      setLoadState("ready");
      setMessage("");
    } catch (error) {
      setRoom(null);
      setMembers([]);
      setForms([]);
      setSubmissions([]);
      setLoadState("error");
      setMessage(`Loombus could not load room forms. Details: ${getErrorMessage(error)}`);
    }
  }

  useEffect(() => {
    void loadForms();
  }, [roomId]);

  async function handleSaveForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !canManage || !title.trim()) return;
    const questions = questionText.split("\n").map((question) => question.trim()).filter(Boolean).slice(0, 30);
    if (questions.length === 0) {
      setMessage("Add at least one question prompt for this form.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || "general",
      questions,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("room_forms").update(payload).eq("id", editingId);
        if (error) throw error;
        setMessage("Form updated.");
      } else {
        const { error } = await supabase.from("room_forms").insert({ ...payload, room_id: room.id, created_by: userId });
        if (error) throw error;
        setMessage("Form created.");
      }

      resetFormEditor();
      await loadForms();
    } catch (error) {
      setMessage(`Loombus could not save this form yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitResponse(form: RoomForm) {
    if (!room || !userId || form.questions.length === 0) return;
    const draft = answerDrafts[form.id] ?? {};
    const answers = form.questions.map((question, index) => ({ question, answer: (draft[index] ?? "").trim() }));
    if (!answers.some((answer) => answer.answer)) {
      setMessage("Add at least one answer before submitting this form.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_form_submissions").insert({
        room_id: room.id,
        form_id: form.id,
        submitted_by: userId,
        answers,
        status: "new",
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setAnswerDrafts((current) => ({ ...current, [form.id]: {} }));
      setMessage("Form response submitted.");
      await loadForms();
    } catch (error) {
      setMessage(`Loombus could not submit this form yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleReviewSubmission(submission: FormSubmission, status: SubmissionStatus) {
    if (!canManage || !userId) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("room_form_submissions")
        .update({
          status,
          review_note: reviewNotes[submission.id] ?? submission.reviewNote,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", submission.id);
      if (error) throw error;
      setMessage(`Submission marked ${statusLabel(status)}.`);
      await loadForms();
    } catch (error) {
      setMessage(`Loombus could not review this submission yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteForm(form: RoomForm) {
    if (!canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_forms").delete().eq("id", form.id);
      if (error) throw error;
      if (editingId === form.id) resetFormEditor();
      setMessage("Form removed.");
      await loadForms();
    } catch (error) {
      setMessage(`Loombus could not remove this form yet. Details: ${getErrorMessage(error)}`);
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
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200" style={{ color: "#fde68a" }}>Room Forms / Submissions</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl" style={{ color: "#ffffff" }}>{room?.name ?? "Room Forms"}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50 sm:text-base" style={{ color: "#fff7ed" }}>Build room-specific forms, collect member responses, and move submissions through review without leaving the private room.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{forms.length} forms</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{submissions.length} submissions</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{categories.length} categories</span>
            </div>
          </div>

          {loadState !== "ready" && (
            <div className="p-6">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <ClipboardList className="mx-auto size-9 text-amber-700" />
                <h2 className="mt-3 text-lg font-black text-slate-950">{loadState === "checking" ? "Checking form access" : loadState === "signed_out" ? "Sign in required" : loadState === "blocked" ? "Forms are private" : "Forms could not load"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
                <button type="button" onClick={() => void loadForms()} className="mt-5 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">Retry</button>
              </div>
            </div>
          )}

          {loadState === "ready" && (
            <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_390px]">
              <div className="space-y-4">
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row">
                    <label className="relative flex-1">
                      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Search forms, descriptions, categories, or questions" />
                    </label>
                    <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100">
                      <option value="all">All categories</option>
                      {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                </section>

                {filteredForms.map((form) => {
                  const formSubmissions = submissionsForForm(form.id);
                  const mySubmissions = userId ? formSubmissions.filter((submission) => submission.submittedBy === userId) : [];
                  return (
                    <article key={form.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 ring-1 ring-slate-200">{form.category}</span>
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-100">{form.questions.length} questions</span>
                            <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 ring-1 ring-slate-200">{formSubmissions.length} submissions</span>
                          </div>
                          <h2 className="mt-3 text-xl font-black text-slate-950">{form.title}</h2>
                          {form.description && <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{form.description}</p>}
                          <ol className="mt-4 space-y-2 text-sm text-slate-700">
                            {form.questions.map((question, index) => <li key={`${form.id}-${index}`} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"><span className="font-black text-slate-950">{index + 1}.</span> {question}</li>)}
                          </ol>
                        </div>
                        {canManage && (
                          <div className="flex flex-col gap-2 sm:min-w-40">
                            <button type="button" disabled={saving} onClick={() => startEdit(form)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:opacity-50"><Edit3 className="size-3" /> Edit</button>
                            <button type="button" disabled={saving} onClick={() => void handleDeleteForm(form)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 ring-1 ring-red-100 transition hover:bg-red-100 disabled:opacity-50"><Trash2 className="size-3" /> Remove</button>
                          </div>
                        )}
                      </div>

                      <section className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Submit response</h3>
                        <div className="mt-3 space-y-3">
                          {form.questions.map((question, index) => (
                            <label key={`${form.id}-answer-${index}`} className="block">
                              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{question}</span>
                              <textarea value={answerDrafts[form.id]?.[index] ?? ""} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [form.id]: { ...(current[form.id] ?? {}), [index]: event.target.value } }))} rows={2} maxLength={2000} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Type your answer" />
                            </label>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs font-bold text-slate-500">{mySubmissions.length > 0 ? `${mySubmissions.length} response${mySubmissions.length === 1 ? "" : "s"} submitted by you.` : "Your response is only visible to room owners/admins."}</p>
                          <button type="button" disabled={saving || form.questions.length === 0} onClick={() => void handleSubmitResponse(form)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Send className="size-4" /> Submit</button>
                        </div>
                      </section>
                    </article>
                  );
                })}

                {filteredForms.length === 0 && (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                    <ClipboardList className="mx-auto size-9 text-amber-700" />
                    <h2 className="mt-3 text-lg font-black text-slate-950">No forms found</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Create intake forms, requests, applications, resident forms, approvals, or feedback prompts for this room.</p>
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                {canManage && (
                  <form onSubmit={handleSaveForm} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">{editingId ? "Edit form" : "Create form"}</h2>
                      <Plus className="size-4 text-amber-700" />
                    </div>
                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="form-title">Form title</label>
                    <input id="form-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Maintenance request" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="form-category">Category</label>
                    <input id="form-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={120} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="requests, approvals, feedback" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="form-description">Description</label>
                    <textarea id="form-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={4000} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Explain when members should use this form." />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="form-questions">Question prompts</label>
                    <textarea id="form-questions" value={questionText} onChange={(event) => setQuestionText(event.target.value)} rows={7} maxLength={6000} required className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder={"One question per line\nWhat do you need?\nWhere should this be handled?"} />

                    <button type="submit" disabled={saving || !title.trim() || !questionText.trim()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <CheckCircle2 className="size-4" /> {editingId ? "Save form" : "Create form"}
                    </button>
                    {editingId && <button type="button" onClick={resetFormEditor} className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200">Cancel edit</button>}
                  </form>
                )}

                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Forms summary</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Forms</dt><dd className="font-black text-slate-900">{forms.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Submissions</dt><dd className="font-black text-slate-900">{submissions.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Categories</dt><dd className="font-black text-slate-900">{categories.length}</dd></div>
                  </dl>
                </section>

                {canManage && (
                  <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Review submissions</h2>
                    <div className="mt-4 space-y-3">
                      {submissions.slice(0, 25).map((submission) => {
                        const form = forms.find((item) => item.id === submission.formId);
                        return (
                          <article key={submission.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="text-sm font-black text-slate-950">{form?.title ?? "Form submission"}</h3>
                              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 ring-1 ring-slate-200">{statusLabel(submission.status)}</span>
                            </div>
                            <p className="mt-1 text-xs font-bold text-slate-500">Submitted {getDateLabel(submission.createdAt)}</p>
                            <div className="mt-3 space-y-2">
                              {submission.answers.map((answer, index) => (
                                <div key={`${submission.id}-${index}`} className="rounded-xl bg-white p-3 text-xs ring-1 ring-slate-100">
                                  <p className="font-black text-slate-700">{answer.question}</p>
                                  <p className="mt-1 whitespace-pre-wrap text-slate-600">{answer.answer || "No answer provided."}</p>
                                </div>
                              ))}
                            </div>
                            <textarea value={reviewNotes[submission.id] ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [submission.id]: event.target.value }))} rows={2} maxLength={4000} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Private review note" />
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {STATUS_OPTIONS.map((status) => (
                                <button key={status} type="button" disabled={saving || submission.status === status} onClick={() => void handleReviewSubmission(submission, status)} className="rounded-xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:opacity-50">{statusLabel(status)}</button>
                              ))}
                            </div>
                          </article>
                        );
                      })}
                      {submissions.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">No submissions yet.</p>}
                    </div>
                  </section>
                )}
              </aside>
            </div>
          )}
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
