"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTask(row: Row): Task {
  return {
    id: asString(row.id),
    title: asString(row.title) || "Untitled task",
    status: asString(row.status) || "open",
    priority: asString(row.priority) || "normal",
  };
}

export function RoomTasksSummary({ roomId }: { roomId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [canView, setCanView] = useState(false);
  const [railHost, setRailHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let activeHost: HTMLElement | null = null;

    function placeHost() {
      const activitySummary = document.querySelector('[data-room-activity-summary="true"]');
      const entrySummary = document.querySelector('[data-room-entry-summary="true"]');
      const billingSection = document.getElementById("billing");
      const anchor = activitySummary ?? entrySummary ?? billingSection;
      if (!anchor) return;

      if (activeHost?.parentElement) {
        if (activeHost.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", activeHost);
        return;
      }

      const host = document.createElement("div");
      host.setAttribute("data-room-tasks-summary", "true");
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

      const { data: taskData } = await supabase
        .from("room_tasks")
        .select("*")
        .eq("room_id", roomId)
        .order("updated_at", { ascending: false })
        .limit(12);

      if (!cancelled) {
        setTasks(((taskData ?? []) as Row[]).map(normalizeTask).filter((task) => task.id));
        setCanView(true);
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (!railHost || !canView) return null;

  const openTasks = tasks.filter((task) => task.status === "open");
  const activeTasks = tasks.filter((task) => task.status === "in_progress");
  const priorityTasks = tasks.filter((task) => task.priority === "high" || task.priority === "urgent");
  const latest = tasks[0];

  return createPortal(
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" id="room-tasks">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Room Tasks / Action Items</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Track the work</h2>
        </div>
        <span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100"><ClipboardList className="size-5" /></span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{openTasks.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Open</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{activeTasks.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Active</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{priorityTasks.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Priority</p></div>
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Latest task</p>
        <p className="mt-2 text-sm font-black text-slate-950">{latest?.title ?? "No tasks created yet."}</p>
        {latest && <p className="mt-1 text-xs font-semibold text-slate-500">{latest.status.replace(/_/g, " ")} · {latest.priority}</p>}
      </div>
      <Link href={`/rooms/${roomId}/tasks`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">Open Tasks</Link>
    </section>,
    railHost,
  );
}
