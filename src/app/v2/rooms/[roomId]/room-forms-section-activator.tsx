"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ClipboardList, FileQuestion, Send } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveHubAnchor() {
  const documents = document.getElementById("documents");
  const faq = document.getElementById("faq");
  const directory = document.getElementById("directory");
  const polls = document.getElementById("polls");
  const tasks = document.getElementById("tasks");
  const activity = document.getElementById("activity");
  const members = document.getElementById("members");
  const discussions = document.getElementById("discussions");
  const overview = document.getElementById("overview");
  return documents ?? faq ?? directory ?? polls ?? tasks ?? activity ?? members ?? discussions ?? overview;
}

export function RoomFormsSectionActivator({ roomId }: { roomId: string }) {
  const [sectionHost, setSectionHost] = useState<HTMLElement | null>(null);
  const [canView, setCanView] = useState(false);

  useEffect(() => {
    let activeHost: HTMLElement | null = null;

    function activate() {
      const anchor = resolveHubAnchor();
      if (!anchor) return;

      const existingHost = document.querySelector<HTMLElement>('[data-room-forms-section-host="true"]');
      if (existingHost) {
        activeHost = existingHost;
        setSectionHost(existingHost);
        return;
      }

      const host = document.createElement("section");
      host.setAttribute("data-room-forms-section-host", "true");
      host.setAttribute("id", "forms");
      host.className = "rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm";
      anchor.insertAdjacentElement("afterend", host);
      activeHost = host;
      setSectionHost(host);
    }

    activate();
    const observer = new MutationObserver(activate);
    observer.observe(document.body, { childList: true, subtree: true });
    const intervalId = window.setInterval(activate, 500);
    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 8000);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      activeHost?.remove();
      setSectionHost(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
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

      if (!cancelled) setCanView(Boolean(isOwner || isMember));
    }

    checkAccess();
    const { data } = supabase.auth.onAuthStateChange(() => checkAccess());

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [roomId]);

  if (!sectionHost || !canView) return null;

  return createPortal(
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <ClipboardList className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Room Forms / Submissions is live</p>
            <h2 className="mt-1 max-w-2xl text-xl font-black leading-tight text-slate-950 sm:text-2xl">Collect structured member responses</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-700">
              Create room forms for maintenance requests, approvals, applications, feedback, intake, and any custom process that needs clear answers.
            </p>
          </div>
        </div>
        <Link href={`/rooms/${roomId}/forms`} className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 sm:w-auto">
          Open Forms
        </Link>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500"><FileQuestion className="size-3 text-amber-700" /> Custom prompts</div>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Owners and admins can create forms with title, description, category, and one-question-per-line prompts.</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500"><Send className="size-3 text-amber-700" /> Member submissions</div>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Approved members can submit responses while the room keeps access limited to the private community.</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500"><CheckCircle2 className="size-3 text-amber-700" /> Review flow</div>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Owners and admins can move submissions through new, reviewing, approved, rejected, and archived states.</p>
        </div>
      </div>
      <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-100">
        <ClipboardList className="size-3" /> Structured submissions MVP
      </p>
    </div>,
    sectionHost,
  );
}
