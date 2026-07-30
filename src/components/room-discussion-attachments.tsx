"use client";

import {
  FileText,
  ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  NON_VIDEO_ATTACHMENT_MAX_SIZE_BYTES,
  VIDEO_CONTEXT_ALLOWED_MIME_TYPES,
} from "@/lib/video-context-limits";

const MAX_ATTACHMENTS = 3;
const MAX_CLIENT_VIDEO_SIZE = 250 * 1024 * 1024;
const ALLOWED_NON_VIDEO = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
const ALLOWED_VIDEO = new Set<string>(VIDEO_CONTEXT_ALLOWED_MIME_TYPES);

export type PendingRoomAttachment = {
  id: string;
  file: File;
  kind: "image" | "video" | "file";
  videoDurationSeconds: number | null;
};

type StoredAttachment = {
  id: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  kind: "image" | "video" | "file";
  videoDurationSeconds: number | null;
  signedUrl: string;
};

function attachmentKind(file: File): PendingRoomAttachment["kind"] | null {
  const type = file.type.toLowerCase();
  if (type.startsWith("image/") && ALLOWED_NON_VIDEO.has(type)) return "image";
  if (ALLOWED_VIDEO.has(type)) return "video";
  if (type === "application/pdf") return "file";
  return null;
}

function formatBytes(value: number | null) {
  if (!value) return "File";
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function readVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const handleLoadedMetadata = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        finish(() => reject(new Error("Unable to read the selected video duration.")));
        return;
      }
      finish(() => resolve(Math.ceil(duration)));
    };

    const handleError = () => {
      finish(() => reject(new Error("Unable to read the selected video.")));
    };

    video.preload = "metadata";
    video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.src = objectUrl;
  });
}

export function RoomAttachmentPicker({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: PendingRoomAttachment[];
  onChange: (files: PendingRoomAttachment[]) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [reading, setReading] = useState(false);

  async function selectFiles(files: FileList | null) {
    if (!files?.length || disabled) return;
    setReading(true);
    setMessage("");
    try {
      const next = [...value];
      for (const file of Array.from(files)) {
        if (next.length >= MAX_ATTACHMENTS) break;
        const kind = attachmentKind(file);
        if (!kind) {
          throw new Error("Choose an image, PDF, MP4, MOV, or WebM file.");
        }
        const maxSize =
          kind === "video"
            ? MAX_CLIENT_VIDEO_SIZE
            : NON_VIDEO_ATTACHMENT_MAX_SIZE_BYTES;
        if (file.size <= 0 || file.size > maxSize) {
          throw new Error(
            kind === "video"
              ? "Videos must be 250 MB or less. Your plan limit is verified before upload."
              : "Images and PDFs must be 10 MB or less."
          );
        }
        if (kind === "video" && next.some((item) => item.kind === "video")) {
          throw new Error("A discussion or reply can include only one video.");
        }
        next.push({
          id: crypto.randomUUID(),
          file,
          kind,
          videoDurationSeconds:
            kind === "video" ? await readVideoDuration(file) : null,
        });
      }
      onChange(next);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The attachment could not be selected."
      );
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={`room-thread-attachment-picker${compact ? " is-compact" : ""}`}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/quicktime,video/webm"
        hidden
        disabled={disabled || reading || value.length >= MAX_ATTACHMENTS}
        onChange={(event) => void selectFiles(event.target.files)}
      />
      <button
        type="button"
        className="room-thread-attach-button"
        disabled={disabled || reading || value.length >= MAX_ATTACHMENTS}
        onClick={() => inputRef.current?.click()}
        aria-label="Add attachments or video"
      >
        {reading ? (
          <Loader2 className="is-spinning" aria-hidden="true" />
        ) : (
          <Plus aria-hidden="true" />
        )}
        <span>{compact ? "Attach" : "Add attachment or video"}</span>
      </button>
      <small>
        {value.length}/{MAX_ATTACHMENTS}
      </small>
      {value.length > 0 ? (
        <div className="room-thread-attachment-drafts">
          {value.map((item) => {
            const Icon =
              item.kind === "video"
                ? Video
                : item.kind === "image"
                  ? ImageIcon
                  : FileText;
            return (
              <span key={item.id}>
                <Icon aria-hidden="true" />
                <b>{item.file.name}</b>
                <small>
                  {formatBytes(item.file.size)}
                  {item.videoDurationSeconds
                    ? ` · ${item.videoDurationSeconds}s`
                    : ""}
                </small>
                <button
                  type="button"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() =>
                    onChange(
                      value.filter((candidate) => candidate.id !== item.id)
                    )
                  }
                >
                  <X aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
      {message ? <p role="alert">{message}</p> : null}
    </div>
  );
}

async function authToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function uploadRoomAttachments({
  roomId,
  targetType,
  targetId,
  files,
}: {
  roomId: string;
  targetType: "post" | "reply";
  targetId: string;
  files: PendingRoomAttachment[];
}) {
  if (!files.length) return;
  const token = await authToken();
  if (!token) throw new Error("Sign in again before uploading attachments.");

  for (const item of files) {
    const prepareResponse = await fetch(
      `/api/rooms/${encodeURIComponent(roomId)}/discussion-attachments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "prepare",
          targetType,
          targetId,
          fileName: item.file.name,
          mimeType: item.file.type,
          fileSize: item.file.size,
          kind: item.kind,
          videoDurationSeconds: item.videoDurationSeconds,
        }),
      }
    );
    const prepared = await prepareResponse.json().catch(() => ({}));
    if (!prepareResponse.ok || !prepared.storagePath || !prepared.uploadToken) {
      throw new Error(
        prepared.error ?? `Upload could not start for ${item.file.name}.`
      );
    }

    const uploadResult = await supabase.storage
      .from(prepared.bucket)
      .uploadToSignedUrl(
        prepared.storagePath,
        prepared.uploadToken,
        item.file,
        { contentType: item.file.type || "application/octet-stream" }
      );
    if (uploadResult.error) {
      throw new Error(
        `Upload failed for ${item.file.name}: ${uploadResult.error.message}`
      );
    }

    const completeResponse = await fetch(
      `/api/rooms/${encodeURIComponent(roomId)}/discussion-attachments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "complete",
          targetType,
          targetId,
          storagePath: prepared.storagePath,
          fileName: item.file.name,
          mimeType: item.file.type,
          fileSize: item.file.size,
          kind: item.kind,
          videoDurationSeconds: item.videoDurationSeconds,
          videoContextTier: prepared.videoContextTier ?? null,
        }),
      }
    );
    const completed = await completeResponse.json().catch(() => ({}));
    if (!completeResponse.ok) {
      await supabase.storage
        .from(prepared.bucket)
        .remove([prepared.storagePath]);
      throw new Error(
        completed.error ?? `Attachment record failed for ${item.file.name}.`
      );
    }
  }
}

export function RoomAttachmentList({
  roomId,
  targetType,
  targetId,
  refreshKey = 0,
}: {
  roomId: string;
  targetType: "post" | "reply";
  targetId: string;
  refreshKey?: number;
}) {
  const [attachments, setAttachments] = useState<StoredAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      const token = await authToken();
      if (!token) {
        if (live) setLoading(false);
        return;
      }
      const query = new URLSearchParams({ targetType, targetId });
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/discussion-attachments?${query.toString()}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      const result = await response.json().catch(() => ({}));
      if (live) {
        setAttachments(
          response.ok && Array.isArray(result.attachments)
            ? result.attachments
            : []
        );
        setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [refreshKey, roomId, targetId, targetType]);

  if (loading) {
    return (
      <div className="room-thread-attachment-loading" role="status">
        <Loader2 className="is-spinning" aria-hidden="true" /> Loading attachments
      </div>
    );
  }
  if (!attachments.length) return null;

  return (
    <div className="room-thread-attachments">
      {attachments.map((attachment) => {
        if (attachment.kind === "image") {
          return (
            <a
              key={attachment.id}
              href={attachment.signedUrl}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={attachment.signedUrl}
                alt={attachment.fileName}
                loading="lazy"
              />
            </a>
          );
        }
        if (attachment.kind === "video") {
          return (
            <figure key={attachment.id}>
              <video
                src={attachment.signedUrl}
                controls
                playsInline
                preload="metadata"
              />
              <figcaption>
                <Video aria-hidden="true" /> {attachment.fileName}
                {attachment.videoDurationSeconds
                  ? ` · ${attachment.videoDurationSeconds}s`
                  : ""}
              </figcaption>
            </figure>
          );
        }
        return (
          <a
            key={attachment.id}
            href={attachment.signedUrl}
            target="_blank"
            rel="noreferrer"
            className="room-thread-file-attachment"
          >
            <Paperclip aria-hidden="true" />
            <span>
              <strong>{attachment.fileName}</strong>
              <small>{formatBytes(attachment.fileSize)}</small>
            </span>
          </a>
        );
      })}
    </div>
  );
}
