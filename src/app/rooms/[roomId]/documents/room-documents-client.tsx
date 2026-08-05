"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileText,
  LibraryBig,
  Loader2,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { useParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const BUCKET = "room-resources";
const CATEGORIES = [
  ["governing", "Governing documents"],
  ["minutes", "Meeting minutes"],
  ["financial", "Financial reports"],
  ["forms", "Forms"],
  ["policies", "Policies"],
  ["newsletters", "Newsletters"],
  ["maps", "Community maps"],
  ["emergency", "Emergency information"],
  ["other", "Other"],
] as const;

type DocumentItem = {
  id: string;
  resourceId: string;
  documentGroupId: string;
  title: string;
  description: string | null;
  category: string;
  visibility: string;
  tags: string[];
  versionNumber: number;
  isCurrent: boolean;
  isPinned: boolean;
  downloadCount: number;
  publishedAt: string;
  updatedAt: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  url: string | null;
  canManage: boolean;
};

type Payload = {
  room?: { id: string; name: string };
  access?: { role: string | null; canManage: boolean; canModerate: boolean };
  documents?: DocumentItem[];
  error?: string;
};

type Draft = {
  title: string;
  description: string;
  category: string;
  visibility: string;
  tags: string;
  previousDocumentId: string;
  isPinned: boolean;
  notifyMembers: boolean;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  category: "other",
  visibility: "members",
  tags: "",
  previousDocumentId: "",
  isPinned: false,
  notifyMembers: true,
};

function bytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${value} bytes`;
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parsed)
    : "Recently";
}

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function RoomDocumentsClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [payload, setPayload] = useState<Payload | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const accessToken = await token();
    if (!accessToken) throw new Error("Sign in again before continuing.");
    const response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Room Documents could not complete this request.");
    return result;
  }, []);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setNotice("");
    setError(false);
    try {
      setPayload(await request(`/api/rooms/${encodeURIComponent(roomId)}/documents`));
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Room Documents could not load.");
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [request, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const documents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (payload?.documents ?? []).filter((document) => {
      if (category !== "all" && document.category !== category) return false;
      if (!normalized) return true;
      return [document.title, document.description, document.fileName, document.tags.join(" ")]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [category, payload?.documents, query]);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId || !file || working) return;
    setWorking("upload");
    setNotice("");
    setError(false);
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error("Sign in again before uploading.");
      const preparedResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/resources`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_upload", fileName: file.name, mimeType: file.type, fileSizeBytes: file.size }),
      });
      const prepared = await preparedResponse.json().catch(() => ({}));
      if (!preparedResponse.ok || !prepared.storagePath || !prepared.token) {
        throw new Error(prepared.error || "A secure upload could not be prepared.");
      }
      const uploaded = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(prepared.storagePath, prepared.token, file, { contentType: prepared.mimeType || file.type || undefined });
      if (uploaded.error) throw new Error(uploaded.error.message);
      const completedResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/resources`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_upload",
          storagePath: prepared.storagePath,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          fileSizeBytes: prepared.fileSizeBytes,
        }),
      });
      const completed = await completedResponse.json().catch(() => ({}));
      if (!completedResponse.ok || !completed.resourceId) {
        throw new Error(completed.error || "The uploaded file could not be saved.");
      }
      await request(`/api/rooms/${encodeURIComponent(roomId)}/documents`, {
        method: "POST",
        body: JSON.stringify({ action: "register", resourceId: completed.resourceId, ...draft }),
      });
      setDraft(EMPTY_DRAFT);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setNotice("Document published.");
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Document upload failed.");
      setError(true);
    } finally {
      setWorking("");
    }
  }

  async function action(body: Record<string, unknown>, success: string) {
    if (working) return;
    setWorking(String(body.documentId || body.action));
    setNotice("");
    setError(false);
    try {
      await request(`/api/rooms/${encodeURIComponent(roomId)}/documents`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setNotice(success);
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Document update failed.");
      setError(true);
    } finally {
      setWorking("");
    }
  }

  async function openDocument(document: DocumentItem) {
    if (!document.url) return;
    window.open(document.url, "_blank", "noopener,noreferrer");
    await request(`/api/rooms/${encodeURIComponent(roomId)}/documents`, {
      method: "POST",
      body: JSON.stringify({ action: "download", documentId: document.id }),
    }).catch(() => null);
  }

  return (
    <main className="rooms-live-page min-h-screen px-4 py-6 sm:px-6">
      <div className="rooms-live-shell mx-auto max-w-6xl space-y-6">
        <Link href={`/rooms/${encodeURIComponent(roomId)}`} className="rooms-live-back-link !min-h-11">
          <ArrowLeft aria-hidden="true" /> Back to Room
        </Link>

        <header className="room-workspace-hero">
          <div>
            <div className="room-workspace-badges"><span><LibraryBig aria-hidden="true" /> Private knowledge library</span></div>
            <h1>{payload?.room?.name ? `${payload.room.name} documents` : "Room Documents"}</h1>
            <p>Find governing documents, meeting minutes, forms, policies, and other trusted Room information.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="rooms-live-secondary-action !min-h-11">
            <RefreshCw aria-hidden="true" className={loading ? "is-spinning" : undefined} /> Refresh
          </button>
        </header>

        {notice ? (
          <div role={error ? "alert" : "status"} className={`room-expansion-notice${error ? " is-error" : ""}`}>{notice}</div>
        ) : null}

        {payload?.access?.canManage ? (
          <form className="room-expansion-form" onSubmit={uploadDocument}>
            <div className="room-expansion-section-heading">
              <div><h2>Publish a document</h2><p>Upload a new document or attach a revision to an existing document history.</p></div>
            </div>
            <div className="room-expansion-form-grid">
              <label><span>Document title</span><input required minLength={2} maxLength={200} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
              <label><span>Category</span><select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Visibility</span><select value={draft.visibility} onChange={(event) => setDraft((current) => ({ ...current, visibility: event.target.value }))}><option value="members">All active members</option><option value="board">Board and moderators</option><option value="managers">Owners and administrators</option></select></label>
              <label><span>New version of</span><select value={draft.previousDocumentId} onChange={(event) => setDraft((current) => ({ ...current, previousDocumentId: event.target.value }))}><option value="">New document</option>{(payload?.documents ?? []).filter((item) => item.isCurrent).map((item) => <option key={item.id} value={item.id}>{item.title} · v{item.versionNumber}</option>)}</select></label>
              <label><span>Tags</span><input placeholder="bylaws, pool, architectural" value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} /></label>
              <label><span>File</span><input ref={fileRef} type="file" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
            </div>
            <label><span>Description</span><textarea rows={3} maxLength={4000} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.isPinned} onChange={(event) => setDraft((current) => ({ ...current, isPinned: event.target.checked }))} /> Pin this document</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.notifyMembers} onChange={(event) => setDraft((current) => ({ ...current, notifyMembers: event.target.checked }))} /> Notify members</label>
            </div>
            <button type="submit" className="rooms-live-primary-action !min-h-11" disabled={!file || working === "upload"}>
              {working === "upload" ? <Loader2 aria-hidden="true" className="is-spinning" /> : <Upload aria-hidden="true" />} {working === "upload" ? "Publishing…" : "Publish document"}
            </button>
          </form>
        ) : null}

        <section className="room-expansion">
          <div className="room-expansion-form-grid">
            <label><span>Search documents</span><div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, filename, tag, or description" /></div></label>
            <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>

          {loading && !payload ? (
            <div className="room-expansion-loading" role="status"><Loader2 className="is-spinning" aria-hidden="true" /> Loading Room documents…</div>
          ) : documents.length === 0 ? (
            <div className="room-resources-empty"><h3>No matching documents</h3><p>Published documents available to your Room role will appear here.</p></div>
          ) : (
            <div className="room-resources-grid">
              {documents.map((document) => (
                <article key={document.id} className="room-resources-item">
                  <div className="room-resources-item-topline">
                    <div className="room-resources-item-name"><FileText aria-hidden="true" /> {document.title}</div>
                    {document.isPinned ? <span title="Pinned"><Pin aria-hidden="true" /></span> : null}
                  </div>
                  <div className="room-resources-item-meta">{CATEGORIES.find(([value]) => value === document.category)?.[1] || "Other"} · v{document.versionNumber} · {document.visibility}</div>
                  {document.description ? <p>{document.description}</p> : null}
                  <div className="room-resources-item-meta">{document.fileName} · {bytes(document.fileSizeBytes)} · {date(document.updatedAt)} · {document.downloadCount} opens</div>
                  {document.tags.length ? <div className="flex flex-wrap gap-2">{document.tags.map((tag) => <span key={tag} className="rounded-full border px-2 py-1 text-xs">{tag}</span>)}</div> : null}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="room-resources-download" disabled={!document.url} onClick={() => void openDocument(document)}><Download aria-hidden="true" /> Open or download</button>
                    {document.canManage ? <button type="button" className="room-resources-button is-quiet" onClick={() => void action({ action: "set_pinned", documentId: document.id, isPinned: !document.isPinned }, document.isPinned ? "Document unpinned." : "Document pinned.")}>{document.isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}{document.isPinned ? "Unpin" : "Pin"}</button> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
