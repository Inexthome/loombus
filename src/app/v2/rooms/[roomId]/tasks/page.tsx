"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, Flag, Plus, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { V2ShellMobileNav, V2ShellTopNav } from "../../../v2-shell-components";

type Row = Record<string, unknown>;

type Room = { id: string; name: string; ownerId: string; createdBy: string };
type Member = { userId: string; role: string };
type RoomTask = { id: string; title: string; description: string; status: string; priority: string; dueAt: string | null; assignedUserId: string; createdBy: string };
type LoadState = "checking" | "ready" | "signed_out" | "blocked" | "error";

const TASK_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const REQUEST_TIMEOUT_MS = 8000;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function normalizeTask(row: Row): RoomTask {
  return {
    id: asString(row.id),
    title: asString(row.title) || "Untitled task",
    description: asString(row.description),
    status: asString(row.status) || "open",
    priority: asString(row.priority) || "normal",
    dueAt: asString(row.due_at) || null,
    assignedUserId: asString(row.assigned_user_id),
    createdBy: asString(row.created_by),
  };
}

function formatDate(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No due date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function getShortId(value: string) {
  if (!value) return "Unassigned";
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function getStatusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function getStatusClass(value: string) {
  if (value === "done") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (value === "in_progress") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (value === "cancelled") return "bg-slate-100 text-slate-500 ring-slate-200";
  return "bg-blue-50 text-blue-700 ring-blue-100";
}

function getPriorityClass(value: string) {
  if (value === "urgent") return "bg-red-50 text-red-700 ring-red-100";
  if (value === "high") return "bg-orange-50 text-orange-700 ring-orange-100";
  if (value === "low") return "bg-slate-50 text-slate-600 ring-slate-200";
  return "bg-amber-50 text-amber-700 ring-amber-100";
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

export default function V2RoomTasksPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] ?? "" : rawRoomId ?? ""), [rawRoomId]);

  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<RoomTask[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading task data...");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const canManage = Boolean(isOwner || currentMember?.role === "owner" || currentMember?.role === "admin");
  const openTasks = tasks.filter((task) => task.status === "open");
  const inProgressTasks = tasks.filter((task) => task.status === "in_progress");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const urgentTasks = tasks.filter((task) => task.priority === "urgent" || task.priority === "high");
  const canShowTasks = loadState === "ready";

  async function loadTasks() {
    if (!roomId) {
      setLoadState("error");
      setMessage("Loombus could not find the room ID for this task list.");
      return;
    }

    setLoadState("checking");
    setMessage("Loading task data...");

    try {
      const { data: sessionData } = await withTimeout(supabase.auth.getSession(), "session check");
      const nextUserId = sessionData.session?.user.id ?? null;
      setUserId(nextUserId);

      if (!nextUserId) {
        setLoadState("signed_out");
        setMessage("Sign in first so Loombus can open this room task list.");
        setRoom(null);
        setMembers([]);
        setTasks([]);
        return;
      }

      const [{ data: roomData, error: roomError }, { data: memberData, error: memberError }] = await Promise.all([
        withTimeout(supabase.from("rooms").select("id,name,title,owner_id,created_by").eq("id", roomId).maybeSingle(), "room lookup"),
        withTimeout(supabase.from("room_members").select("user_id,role").eq("room_id", roomId), "member lookup"),
      ]);

      if (roomError) throw roomError;
      if (memberError) throw memberError;

      const nextRoom = normalizeRoom((roomData as Row | null) ?? null);
      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      const nextMember = nextMembers.find((member) => member.userId === nextUserId);
      const nextIsOwner = Boolean(nextRoom && (nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId));
      const nextCanAccess = Boolean(nextIsOwner || nextMember);

      setRoom(nextRoom);
      setMembers(nextMembers);

      if (!nextRoom || !nextCanAccess) {
        setTasks([]);
        setLoadState("blocked");
        setMessage("Room Tasks / Action Items are only available to approved room members.");
        return;
      }

      const { data: taskData, error: taskError } = await withTimeout(
        supabase.from("room_tasks").select("id,title,description,status,priority,due_at,assigned_user_id,created_by").eq("room_id", roomId).order("updated_at", { ascending: false }).limit(100),
        "task lookup",
      );

      if (taskError) throw taskError;

      setTasks(((taskData ?? []) as Row[]).map(normalizeTask).filter((task) => task.id));
      setLoadState("ready");
      setMessage("");
    } catch {
      setRoom(null);
      setMembers([]);
      setTasks([]);
      setLoadState("error");
      setMessage("Loombus could not load room tasks. Refresh once, then confirm the room_tasks table and policies are active if this continues.");
    }
  }

  useEffect(() => {
    void loadTasks();
  }, [roomId]);

  async function handleCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !canManage || !taskTitle.trim()) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_tasks").insert({
        room_id: room.id,
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        status: "open",
        priority: taskPriority,
        due_at: taskDueAt ? new Date(taskDueAt).toISOString() : null,
        assigned_user_id: assignedUserId.trim() || null,
        created_by: userId,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      setTaskTitle("");
      setTaskDescription("");
      setTaskPriority("normal");
      setTaskDueAt("");
      setAssignedUserId("");
      setMessage("Task created.");
      await loadTasks();
    } catch {
      setMessage("Loombus could not create this task yet. Confirm the task migration and owner/admin policies are active.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateTask(task: RoomTask, patch: Record<string, string | null>) {
    if (!canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const nextStatus = patch.status ?? task.status;
      const { error } = await supabase.from("room_tasks").update({ ...patch, completed_at: nextStatus === "done" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", task.id);
      if (error) throw error;
      await loadTasks();
    } catch {
      setMessage("Loombus could not update this task yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTask(task: RoomTask) {
    if (!canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_tasks").delete().eq("id", task.id);
      if (error) throw error;
      setMessage("Task removed.");
      await loadTasks();
    } catch {
      setMessage("Loombus could not remove this task yet.");
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
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Room Tasks / Action Items</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{room?.name ?? "Room task list"}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">Turn room work into trackable action items with owners, status, priority, and due dates.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{openTasks.length} open</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{inProgressTasks.length} in progress</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{doneTasks.length} done</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{urgentTasks.length} high priority</span>
            </div>
          </div>

          {loadState === "checking" && (
            <div className="p-6">
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                <ClipboardList className="mx-auto size-9 text-amber-700" />
                <h2 className="mt-3 text-lg font-black text-slate-950">Checking room task access</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">This message will change to the task list, sign-in request, private access notice, or an error instead of staying on a loading gate.</p>
              </div>
            </div>
          )}

          {(loadState === "signed_out" || loadState === "blocked" || loadState === "error") && (
            <div className="p-6">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <ClipboardList className="mx-auto size-9 text-amber-700" />
                <h2 className="mt-3 text-lg font-black text-slate-950">{loadState === "signed_out" ? "Sign in required" : loadState === "blocked" ? "Room tasks are private" : "Tasks could not load"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
                <button type="button" onClick={() => loadTasks()} className="mt-5 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
                  Retry
                </button>
              </div>
            </div>
          )}

          {canShowTasks && (
            <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                {tasks.map((task) => (
                  <article key={task.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1 ${getStatusClass(task.status)}`}>{getStatusLabel(task.status)}</span>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1 ${getPriorityClass(task.priority)}`}>{task.priority}</span>
                        </div>
                        <h2 className="mt-3 text-xl font-black text-slate-950">{task.title}</h2>
                        {task.description && <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{task.description}</p>}
                        <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                          <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" /> {formatDate(task.dueAt)}</span>
                          <span className="inline-flex items-center gap-1"><UserRound className="size-3" /> Assigned: {getShortId(task.assignedUserId)}</span>
                          <span className="inline-flex items-center gap-1"><Flag className="size-3" /> Created by {getShortId(task.createdBy)}</span>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex flex-col gap-2 sm:min-w-48">
                          <select value={task.status} disabled={saving} onChange={(event) => handleUpdateTask(task, { status: event.target.value })} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-50">
                            {TASK_STATUSES.map((status) => <option key={status} value={status}>{getStatusLabel(status)}</option>)}
                          </select>
                          <select value={task.priority} disabled={saving} onChange={(event) => handleUpdateTask(task, { priority: event.target.value })} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-50">
                            {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                          </select>
                          <button type="button" onClick={() => handleDeleteTask(task)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 ring-1 ring-red-100 transition hover:bg-red-100 disabled:opacity-50">
                            <Trash2 className="size-3" /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}

                {tasks.length === 0 && (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                    <ClipboardList className="mx-auto size-9 text-amber-700" />
                    <h2 className="mt-3 text-lg font-black text-slate-950">No tasks yet</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Owners and admins can create action items for this room. Members can view the task list.</p>
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                {canManage && (
                  <form onSubmit={handleCreateTask} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Create task</h2>
                      <Plus className="size-4 text-amber-700" />
                    </div>
                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="task-title">Title</label>
                    <input id="task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} maxLength={200} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Follow up with vendor" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="task-description">Description</label>
                    <textarea id="task-description" value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} rows={4} maxLength={4000} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Add context, notes, or next steps" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="task-priority">Priority</label>
                    <select id="task-priority" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100">
                      {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                    </select>

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="task-due-at">Due date</label>
                    <input id="task-due-at" type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="assigned-user-id">Assigned user ID</label>
                    <input id="assigned-user-id" value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Optional user UUID" />

                    <button type="submit" disabled={saving || !taskTitle.trim()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <CheckCircle2 className="size-4" /> Create task
                    </button>
                  </form>
                )}

                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Task summary</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Open</dt><dd className="font-black text-slate-900">{openTasks.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">In progress</dt><dd className="font-black text-slate-900">{inProgressTasks.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Done</dt><dd className="font-black text-slate-900">{doneTasks.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">High priority</dt><dd className="font-black text-slate-900">{urgentTasks.length}</dd></div>
                  </dl>
                </section>
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Visibility</h2>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Approved room members can view tasks. Owners and admins can create, update, and remove tasks.</p>
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
