"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type RoomForm = {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: string[];
};

type FormSubmission = {
  id: string;
  formId: string;
  status: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function decodeQuestions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((question) => asString(question)).filter(Boolean).slice(0, 30);
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
    status: asString(row.status) || "new",
  };
}

export function RoomFormsSummary({ roomId }: { roomId: string }) {
  const [forms, setForms] = useState<RoomForm[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [canView, setCanView] = useState(false);
  const [railHost, setRailHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let activeHost: HTMLElement | null = null;

    function placeHost() {
      const documentsSummary = document.querySelector('[data-room-documents-summary="true"]');
      const faqSummary = document.querySelector('[data-room-faq-summary="true"]');
      const directorySummary = document.querySelector('[data-room-directory-summary="true"]');
      const pollsSummary = document.querySelector('[data-room-polls-summary="true"]');
      const tasksSummary = document.querySelector('[data-room-tasks-summary="true"]');
      const activitySummary = document.querySelector('[data-room-activity-summary="true"]');
      const entrySummary = document.querySelector('[data-room-entry-summary="true"]');
      const billingSection = document.getElementById("billing");
      const anchor = documentsSummary ?? faqSummary ?? directorySummary ?? pollsSummary ?? tasksSummary ?? activitySummary ?? entrySummary ?? billingSection;
      if (!anchor) return;

      if (activeHost?.parentElement) {
        if (activeHost.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", activeHost);
        return;
      }

      const host = document.createElement("div");
      host.setAttribute("data-room-forms-summary", "true");
      anchor.insertAdjacentElement("afterend", host);
      activeHost = host;
      setRailHost(host);
    }

    placeHost();
    const observer = new MutationObserver(placeHost);
    observer.observe(document.body, { childList: true, subtree: true });
    const intervalId = window.setInterval(placeHost, 500);
    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 7000);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      activeHost?.remove();
      setRailHost(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;
      if (!currentUserId || !roomId) {
        if (!cancelled) setCanView(false);
        return;
      }

      const [{ data: roomData }, { data: memberData }] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("room_members").select("*").eq("room_id", roomId),
      ]);

      const room = (roomData ?? {}) as Row;
      const members = ((memberData ?? []) as Row[]).map((member) => asString(member.user_id));
      const isOwner = asString(room.owner_id) === currentUserId || asString(room.created_by) === currentUserId;
      const isMember = members.includes(currentUserId);

      if (!isOwner && !isMember) {
        if (!cancelled) setCanView(false);
        return;
      }

      const isManager = Boolean(
        isOwner ||
          ((memberData ?? []) as Row[]).some((member) => asString(member.user_id) === currentUserId && ["owner", "admin"].includes(asString(member.role))),
      );

      const [{ data: formData }, { data: submissionData }] = await Promise.all([
        supabase.from("room_forms").select("*").eq("room_id", roomId).order("category", { ascending: true }).order("title", { ascending: true }).limit(12),
        isManager
          ? supabase.from("room_form_submissions").select("id, form_id, status").eq("room_id", roomId).order("updated_at", { ascending: false }).limit(100)
          : supabase.from("room_form_submissions").select("id, form_id, status").eq("room_id", roomId).eq("submitted_by", currentUserId).order("updated_at", { ascending: false }).limit(25),
      ]);

      if (!cancelled) {
        setForms(((formData ?? []) as Row[]).map(normalizeForm).filter((form) => form.id));
        setSubmissions(((submissionData ?? []) as Row[]).map(normalizeSubmission).filter((submission) => submission.id));
        setCanView(true);
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const categoryCount = useMemo(() => new Set(forms.map((form) => form.category).filter(Boolean)).size, [forms]);
  const openSubmissions = submissions.filter((submission) => ["new", "reviewing"].includes(submission.status));

  if (!railHost || !canView) return null;

  const latest = forms[0];

  return createPortal(
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" id="room-forms">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Room Forms / Submissions</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Collect member responses</h2>
        </div>
        <span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100"><ClipboardList className="size-5" /></span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{forms.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Forms</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{submissions.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Submits</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{categoryCount}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Categories</p></div>
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Latest form</p>
        <p className="mt-2 text-sm font-black text-slate-950">{latest?.title ?? "No forms added yet."}</p>
        {latest && <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{latest.category} · {latest.questions.length} prompts · {openSubmissions.length} open reviews</p>}
      </div>
      <Link href={`/rooms/${roomId}/forms`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">Open Forms</Link>
    </section>,
    railHost,
  );
}
