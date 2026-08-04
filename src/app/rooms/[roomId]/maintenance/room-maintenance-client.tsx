"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Plus, RefreshCw, Wrench, X } from "lucide-react";
import { useParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type RequestItem = {
  id: string;
  requesterId: string;
  assignedTo: string | null;
  title: string;
  description: string;
  category: string;
  priority: string;
  locationText: string | null;
  status: string;
  managerNote: string | null;
  createdAt: string;
  updatedAt: string;
  requester?: { full_name?: string | null; username?: string | null } | null;
  assignee?: { full_name?: string | null; username?: string | null } | null;
};

type UpdateItem = {
  id: string;
  requestId: string;
  updateType: string;
  body: string;
  createdAt: string;
  author?: { full_name?: string | null; username?: string | null } | null;
};

type Payload = {
  room?: { id: string; name: string };
  access?: { canManage: boolean; isOwner: boolean; role: string | null };
  requests?: RequestItem[];
  updates?: UpdateItem[];
  error?: string;
};

const inputClass = "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold disabled:opacity-50";

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function RoomMaintenanceClient() {
  const params = useParams<{ roomId: string }>();
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId;
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const selected = useMemo(
    () => (payload?.requests ?? []).find((item) => item.id === selectedId) ?? null,
    [payload?.requests, selectedId]
  );
  const selectedUpdates = useMemo(
    () => (payload?.updates ?? []).filter((item) => item.requestId === selectedId),
    [payload?.updates, selectedId]
  );

  const token = useCallback(async () => {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (!accessToken) {
      window.location.href = `/login?next=${encodeURIComponent(`/rooms/${roomId}/maintenance`)}`;
      return null;
    }
    return accessToken;
  }, [roomId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const accessToken = await token();
      if (!accessToken) return;
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/maintenance`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as Payload;
      if (!response.ok) throw new Error(result.error || "Maintenance Requests could not be loaded.");
      setPayload(result);
      setSelectedId((current) => current && (result.requests ?? []).some((item) => item.id === current) ? current : "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Maintenance Requests could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [roomId, token]);

  useEffect(() => { void load(); }, [load]);

  async function action(input: Record<string, unknown>, key: string, success: string) {
    if (working) return false;
    setWorking(key);
    setNotice("");
    setError("");
    try {
      const accessToken = await token();
      if (!accessToken) return false;
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/maintenance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Maintenance action failed.");
      setNotice(success);
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Maintenance action failed.");
      return false;
    } finally {
      setWorking("");
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await action({
      action: "create",
      title: form.get("title"),
      description: form.get("description"),
      category: form.get("category"),
      priority: form.get("priority"),
      locationText: form.get("locationText"),
    }, "create", "Maintenance request submitted.");
    if (saved) {
      event.currentTarget.reset();
      setCreateOpen(false);
    }
  }

  async function updateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await action({
      action: "update",
      requestId: selected.id,
      status: form.get("status"),
      assignedTo: form.get("assignedTo"),
      managerNote: form.get("managerNote"),
      updateBody: form.get("updateBody"),
    }, selected.id, "Maintenance request updated.");
  }

  if (loading && !payload) {
    return <main className="grid min-h-[60vh] place-items-center"><span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Loading maintenance requests</span></main>;
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-gold)]"><ArrowLeft size={16} /> Back to Room</Link>
        <header className="mt-5 flex flex-col gap-4 border-b border-[color:var(--loombus-border-muted)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Private Room operations</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{payload?.room?.name || "Room"} maintenance</h1>
            <p className="mt-2 max-w-2xl text-[color:var(--loombus-text-muted)]">Submit property issues, follow progress, and keep repair updates in one private timeline.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButton} onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} size={16} /> Refresh</button>
            <button type="button" className={primaryButton} onClick={() => setCreateOpen((value) => !value)}><Plus size={16} /> New request</button>
          </div>
        </header>

        {error ? <p role="alert" className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        {notice ? <p role="status" className="mt-5 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm">{notice}</p> : null}

        {createOpen ? (
          <form onSubmit={submitRequest} className="mt-6 rounded-[1.75rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10">
            <h2 className="text-2xl font-semibold">Submit a maintenance request</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold">Issue title</span><input name="title" required minLength={3} maxLength={160} placeholder="Broken gate arm" className={inputClass} /></label>
              <label className="space-y-2"><span className="text-sm font-semibold">Category</span><select name="category" className={inputClass} defaultValue="general">{["general","gate","lighting","landscaping","pool","road","water","building","parking","safety","other"].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
              <label className="space-y-2"><span className="text-sm font-semibold">Priority</span><select name="priority" className={inputClass} defaultValue="normal">{["low","normal","high","urgent"].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
              <label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold">Location</span><input name="locationText" maxLength={500} placeholder="North entrance gate" className={inputClass} /></label>
              <label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold">Description</span><textarea name="description" required minLength={10} maxLength={8000} rows={5} placeholder="Describe what is happening and when you first noticed it." className={inputClass} /></label>
            </div>
            <div className="mt-5 flex gap-3"><button type="submit" disabled={Boolean(working)} className={primaryButton}>{working === "create" ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Submit request</button><button type="button" onClick={() => setCreateOpen(false)} className={secondaryButton}>Cancel</button></div>
          </form>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-3">
            {(payload?.requests ?? []).length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center"><Wrench className="mx-auto text-[color:var(--loombus-gold)]" size={36} /><h2 className="mt-3 text-xl font-semibold">No maintenance requests yet</h2><p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Submit a property issue and track it here.</p></div>
            ) : (payload?.requests ?? []).map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-[1.5rem] border p-5 text-left transition ${selectedId === item.id ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold-soft)]" : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)]"}`}>
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[color:var(--loombus-page-bg)] px-3 py-1 text-xs font-semibold">{label(item.status)}</span><span className="rounded-full bg-[color:var(--loombus-page-bg)] px-3 py-1 text-xs font-semibold">{label(item.priority)}</span><span className="text-xs text-[color:var(--loombus-text-muted)]">{label(item.category)}</span></div>
                <h2 className="mt-3 text-xl font-semibold">{item.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{item.description}</p>
                <p className="mt-3 text-xs text-[color:var(--loombus-text-muted)]">Updated {dateLabel(item.updatedAt)}</p>
              </button>
            ))}
          </section>

          <aside className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 lg:sticky lg:top-6 lg:self-start">
            {!selected ? <p className="text-sm text-[color:var(--loombus-text-muted)]">Select a request to view its details and timeline.</p> : (
              <div>
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">{label(selected.status)}</p><h2 className="mt-1 text-xl font-semibold">{selected.title}</h2></div><button type="button" onClick={() => setSelectedId("")} aria-label="Close details"><X size={18} /></button></div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{selected.description}</p>
                {selected.locationText ? <p className="mt-3 text-sm"><strong>Location:</strong> {selected.locationText}</p> : null}
                {selected.managerNote ? <p className="mt-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-3 text-sm"><strong>Management note:</strong> {selected.managerNote}</p> : null}

                <div className="mt-5 border-t border-[color:var(--loombus-border-muted)] pt-4"><h3 className="font-semibold">Timeline</h3><div className="mt-3 space-y-3">{selectedUpdates.length ? selectedUpdates.map((update) => <div key={update.id} className="text-sm"><p>{update.body}</p><p className="mt-1 text-xs text-[color:var(--loombus-text-muted)]">{dateLabel(update.createdAt)}</p></div>) : <p className="text-sm text-[color:var(--loombus-text-muted)]">No updates yet.</p>}</div></div>

                {payload?.access?.canManage ? (
                  <form onSubmit={updateRequest} className="mt-5 space-y-3 border-t border-[color:var(--loombus-border-muted)] pt-4">
                    <label className="space-y-2"><span className="text-sm font-semibold">Status</span><select name="status" className={inputClass} defaultValue={selected.status}>{["submitted","acknowledged","assigned","in_progress","waiting","resolved","closed","cancelled"].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
                    <label className="space-y-2"><span className="text-sm font-semibold">Assign to user ID</span><input name="assignedTo" defaultValue={selected.assignedTo ?? ""} placeholder="Optional profile UUID" className={inputClass} /></label>
                    <label className="space-y-2"><span className="text-sm font-semibold">Management note</span><textarea name="managerNote" rows={3} defaultValue={selected.managerNote ?? ""} className={inputClass} /></label>
                    <label className="space-y-2"><span className="text-sm font-semibold">Public update</span><textarea name="updateBody" rows={3} placeholder="What changed?" className={inputClass} /></label>
                    <button type="submit" disabled={Boolean(working)} className={`${primaryButton} w-full`}>{working === selected.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Save update</button>
                  </form>
                ) : ["submitted","acknowledged","assigned","waiting"].includes(selected.status) ? (
                  <button type="button" disabled={Boolean(working)} onClick={() => void action({ action: "cancel_own", requestId: selected.id }, selected.id, "Maintenance request cancelled.")} className={`${secondaryButton} mt-5 w-full`}><X size={16} /> Cancel request</button>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
