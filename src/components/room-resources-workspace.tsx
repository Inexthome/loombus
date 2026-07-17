"use client";

import { createPortal } from "react-dom";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";

const BUCKET = "room-resources";

type ResourceEntitlements = {
  id: string;
  label: string;
  fileUploads: boolean;
  inlineVideo: boolean;
  maxFileBytes: number;
  maxFileLabel: string;
  storageBytes: number;
  storageLabel: string;
  features: string[];
};

type RoomResource = {
  id: string;
  fileName: string;
  mimeType: string;
  mediaKind: "file" | "image" | "video";
  fileSizeBytes: number;
  createdAt: string | null;
  url: string | null;
  canDelete: boolean;
};

type ResourcesResponse = {
  resources?: RoomResource[];
  usedBytes?: number;
  usedLabel?: string;
  entitlements?: ResourceEntitlements;
  error?: string;
};

type UploadPreparation = {
  storagePath?: string;
  token?: string;
  fileName?: string;
  mimeType?: string;
  mediaKind?: string;
  fileSizeBytes?: number;
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "Recently uploaded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recently uploaded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

function resourceIcon(kind: RoomResource["mediaKind"]) {
  if (kind === "video") return Video;
  if (kind === "image") return ImageIcon;
  return FileText;
}

function findFilesHost() {
  return document.querySelector<HTMLElement>(
    "[data-loombus-room-files-host='true']"
  );
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function RoomResourcesWorkspace() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [resources, setResources] = useState<RoomResource[]>([]);
  const [entitlements, setEntitlements] =
    useState<ResourceEntitlements | null>(null);
  const [usedBytes, setUsedBytes] = useState(0);
  const [usedLabel, setUsedLabel] = useState("0 MB");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadResources = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/resources`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      const result = (await response.json().catch(() => ({}))) as ResourcesResponse;
      if (!response.ok) {
        throw new Error(result.error ?? "Room files could not be loaded.");
      }
      setResources(Array.isArray(result.resources) ? result.resources : []);
      setEntitlements(result.entitlements ?? null);
      setUsedBytes(result.usedBytes ?? 0);
      setUsedLabel(result.usedLabel ?? "0 MB");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Room files could not be loaded."
      );
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    let scheduled = false;
    const scan = () => {
      scheduled = false;
      setPortalHost(findFilesHost());
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(scan);
    };
    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!portalHost || !roomId) return;
    void loadResources();
  }, [loadResources, portalHost, roomId]);

  useEffect(() => {
    if (!portalHost || !roomId) return;
    const channel = supabase
      .channel(`room-resources:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_resources",
          filter: `room_id=eq.${roomId}`,
        },
        () => void loadResources()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadResources, portalHost, roomId]);

  async function uploadSelectedFile() {
    if (!roomId || !selectedFile || uploading) return;
    setUploading(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again before uploading.");
      const preparedResponse = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/resources`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create_upload",
            fileName: selectedFile.name,
            mimeType: selectedFile.type,
            fileSizeBytes: selectedFile.size,
          }),
        }
      );
      const prepared = (await preparedResponse
        .json()
        .catch(() => ({}))) as UploadPreparation;
      if (!preparedResponse.ok || !prepared.storagePath || !prepared.token) {
        throw new Error(prepared.error ?? "A secure upload could not be prepared.");
      }

      const uploaded = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(prepared.storagePath, prepared.token, selectedFile, {
          contentType: prepared.mimeType || selectedFile.type || undefined,
        });
      if (uploaded.error) throw new Error(uploaded.error.message);

      const completedResponse = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/resources`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "complete_upload",
            storagePath: prepared.storagePath,
            fileName: prepared.fileName,
            mimeType: prepared.mimeType,
            fileSizeBytes: prepared.fileSizeBytes,
          }),
        }
      );
      const completed = (await completedResponse.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!completedResponse.ok) {
        throw new Error(completed.error ?? "The Room file could not be saved.");
      }

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage(
        prepared.mediaKind === "video"
          ? "Inline video added to Files / Documents."
          : "Private file added to Files / Documents."
      );
      await loadResources();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The upload failed.");
      setMessageIsError(true);
    } finally {
      setUploading(false);
    }
  }

  async function deleteResource(resource: RoomResource) {
    if (!roomId || deletingId || !resource.canDelete) return;
    if (!window.confirm(`Delete ${resource.fileName} from this Room?`)) return;
    setDeletingId(resource.id);
    setMessage("");
    setMessageIsError(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again before deleting.");
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/resources`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ resourceId: resource.id }),
        }
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "The Room file could not be deleted.");
      }
      setMessage("Room file deleted.");
      await loadResources();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
      setMessageIsError(true);
    } finally {
      setDeletingId(null);
    }
  }

  if (!portalHost) return null;

  const accept =
    "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

  return createPortal(
    <div className="room-resources-connected">
      {entitlements ? (
        <section className="room-resources-plan-card">
          <div className="room-resources-plan-topline">
            <div>
              <h3>{entitlements.label} file library</h3>
              <p>
                {entitlements.fileUploads
                  ? `${entitlements.maxFileLabel} per upload · ${entitlements.storageLabel} total storage`
                  : "Private Files / Documents begin with Room Pro."}
              </p>
            </div>
            <span className="room-resources-plan-badge">
              {entitlements.inlineVideo ? "Files + inline video" : "Plan locked"}
            </span>
          </div>
        </section>
      ) : null}

      {entitlements?.fileUploads ? (
        <section className="room-resources-upload-card">
          <h3>Add a private file</h3>
          <p>
            Only active Room members receive temporary signed access. Supported videos play
            directly inside this private module.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="room-resources-input"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <div className="room-resources-upload-actions">
            <span className="room-resources-item-meta">
              {selectedFile
                ? `${selectedFile.name} · ${formatBytes(selectedFile.size)}`
                : `Maximum ${entitlements.maxFileLabel}`}
            </span>
            <button
              type="button"
              className="room-resources-button"
              disabled={!selectedFile || uploading}
              onClick={() => void uploadSelectedFile()}
            >
              {uploading ? (
                <Loader2 aria-hidden="true" className="is-spinning" />
              ) : (
                <Upload aria-hidden="true" />
              )}
              {uploading ? "Uploading…" : "Upload file"}
            </button>
          </div>
        </section>
      ) : null}

      {message ? (
        <p
          role="status"
          className={`room-resources-message${messageIsError ? " is-error" : ""}`}
        >
          {message}
        </p>
      ) : null}

      <div className="room-resources-usage">
        <span>
          {resources.length} file{resources.length === 1 ? "" : "s"}
        </span>
        <span>
          {usedLabel}
          {entitlements?.storageBytes ? ` of ${entitlements.storageLabel}` : " used"}
        </span>
      </div>

      {loading && resources.length === 0 ? (
        <section className="room-resources-empty">
          <h3>Loading private files…</h3>
        </section>
      ) : resources.length === 0 ? (
        <section className="room-resources-empty">
          <h3>No private files have been added.</h3>
          <p>
            Upload a document, image, or supported video to make it available to Room
            members.
          </p>
        </section>
      ) : (
        <div className="room-resources-grid">
          {resources.map((resource) => {
            const Icon = resourceIcon(resource.mediaKind);
            return (
              <article key={resource.id} className="room-resources-item">
                <div className="room-resources-item-topline">
                  <div className="room-resources-item-name" title={resource.fileName}>
                    <Icon aria-hidden="true" /> {resource.fileName}
                  </div>
                  {resource.canDelete ? (
                    <button
                      type="button"
                      className="room-resources-button is-quiet"
                      aria-label={`Delete ${resource.fileName}`}
                      disabled={deletingId === resource.id}
                      onClick={() => void deleteResource(resource)}
                    >
                      {deletingId === resource.id ? (
                        <Loader2 aria-hidden="true" className="is-spinning" />
                      ) : (
                        <Trash2 aria-hidden="true" />
                      )}
                    </button>
                  ) : null}
                </div>
                <div className="room-resources-item-meta">
                  {formatBytes(resource.fileSizeBytes)} · {formatDate(resource.createdAt)}
                </div>
                {resource.mediaKind === "video" && resource.url ? (
                  <video controls playsInline preload="metadata" src={resource.url} />
                ) : resource.mediaKind === "image" && resource.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resource.url} alt={resource.fileName} loading="lazy" />
                ) : null}
                {resource.url ? (
                  <a
                    className="room-resources-download"
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download aria-hidden="true" />
                    Open or download
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>,
    portalHost
  );
}
