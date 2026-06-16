"use client";

import { useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";

const ATTACHMENT_BUCKET = "discussion-attachments";
const MAX_ATTACHMENT_FILES = 3;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

type ExistingAttachment = {
  id: string;
  public_url: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  attachment_kind: "image" | "pdf";
  sort_order: number;
};

function escapeLimitedHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function hasLimitedFormattingHtml(value: string) {
  return /<\/?(strong|b|em|i|br|p|div)\b/i.test(value);
}

function sanitizeLimitedDiscussionHtml(value: string) {
  const pattern = /<\/?(strong|b|em|i|br|p|div)\b[^>]*>/gi;
  let safe = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    safe += escapeLimitedHtml(value.slice(lastIndex, match.index));

    const rawTag = match[0].toLowerCase();
    const tagName = match[1].toLowerCase();
    const normalizedTag =
      tagName === "b" ? "strong" : tagName === "i" ? "em" : tagName;

    if (normalizedTag === "br") {
      safe += "<br>";
    } else if (rawTag.startsWith("</")) {
      safe += `</${normalizedTag}>`;
    } else {
      safe += `<${normalizedTag}>`;
    }

    lastIndex = pattern.lastIndex;
  }

  safe += escapeLimitedHtml(value.slice(lastIndex));

  return safe
    .replace(/<div><br><\/div>/gi, "<br>")
    .replace(/<p><br><\/p>/gi, "<br>");
}

function bodyValueToEditorHtml(value: string) {
  if (!value) {
    return "";
  }

  if (hasLimitedFormattingHtml(value)) {
    return sanitizeLimitedDiscussionHtml(value);
  }

  return escapeLimitedHtml(value).replace(/\n/g, "<br>");
}

function formatAttachmentFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getAttachmentKind(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType === "application/pdf") {
    return "pdf";
  }

  return null;
}

function getSafeAttachmentFileName(fileName: string) {
  return fileName.trim().replace(/[\\/]/g, "-").slice(0, 120);
}

function EditControlsCard({
  editId,
  visibleAttachments,
  attachmentMessage,
  isUploadingAttachment,
  removingAttachmentId,
  onDismiss,
  onPickAttachments,
  onRemoveAttachment,
  variant,
}: {
  editId: string;
  visibleAttachments: ExistingAttachment[];
  attachmentMessage: string;
  isUploadingAttachment: boolean;
  removingAttachmentId: string | null;
  onDismiss: () => void;
  onPickAttachments: () => void;
  onRemoveAttachment: (attachment: ExistingAttachment) => void;
  variant: "mobile" | "rail";
}) {
  const attachmentSlotsRemaining = MAX_ATTACHMENT_FILES - visibleAttachments.length;
  const canAddAttachment = attachmentSlotsRemaining > 0 && !isUploadingAttachment;
  const cardClassName =
    variant === "rail"
      ? "rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 text-[var(--loombus-text)] shadow-2xl shadow-black/10"
      : "fixed inset-x-3 bottom-24 z-30 mx-auto max-w-lg rounded-[1.35rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]/95 p-4 text-[var(--loombus-text)] shadow-2xl shadow-black/20 backdrop-blur-xl lg:hidden";

  return (
    <aside className={cardClassName}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[var(--loombus-text-subtle)]">
            Editing controls
          </p>
          <h2 className="text-base font-semibold tracking-tight">
            Editing a published discussion.
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
            Save text changes when ready, or cancel to return without submitting this edit.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss editing controls panel"
          className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
        >
          Close
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
        <a
          href={`/discussions/${editId}`}
          className="inline-flex justify-center rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-medium text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
        >
          Cancel editing
        </a>
        <span className="text-xs leading-relaxed text-[var(--loombus-text-subtle)]">
          This does not save changes.
        </span>
      </div>

      <div className="mt-4 border-t border-[var(--loombus-border)] pt-3">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
              Attachments
            </p>
            <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
              {visibleAttachments.length}/{MAX_ATTACHMENT_FILES} attached
            </p>
          </div>
          <button
            type="button"
            onClick={onPickAttachments}
            disabled={!canAddAttachment}
            className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-medium text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploadingAttachment
              ? "Uploading..."
              : attachmentSlotsRemaining > 0
                ? "Add replacement"
                : "Remove one first"}
          </button>
        </div>

        {visibleAttachments.length > 0 ? (
          <div className="space-y-2">
            {visibleAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3 text-sm"
              >
                <a
                  href={attachment.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 transition hover:text-[var(--loombus-text)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[var(--loombus-text)]">
                      {attachment.file_name}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">
                      {attachment.attachment_kind === "pdf" ? "PDF" : "Image"} · {formatAttachmentFileSize(attachment.file_size_bytes)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--loombus-text-subtle)]">
                    Open
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment)}
                  disabled={removingAttachmentId === attachment.id || isUploadingAttachment}
                  className="mt-3 w-full rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-medium text-[var(--loombus-text-muted)] transition hover:border-red-500/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {removingAttachmentId === attachment.id ? "Removing..." : "Remove attachment"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3 text-sm text-[var(--loombus-text-muted)]">
            No files are attached yet.
          </p>
        )}

        {attachmentMessage && (
          <p className="mt-3 text-sm text-[var(--loombus-text-muted)]">
            {attachmentMessage}
          </p>
        )}
      </div>
    </aside>
  );
}

export function CreateEditHydrator() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const hydratedRef = useRef(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<ExistingAttachment[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [railTarget, setRailTarget] = useState<Element | null>(null);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);

  async function refreshAttachments(discussionId: string) {
    const { data, error } = await supabase
      .from("discussion_attachments")
      .select("id, public_url, file_name, mime_type, file_size_bytes, attachment_kind, sort_order")
      .eq("discussion_id", discussionId)
      .order("sort_order", { ascending: true });

    if (error) {
      setAttachmentMessage(`Attachments could not refresh: ${error.message}`);
      return;
    }

    setAttachments((data ?? []) as ExistingAttachment[]);
  }

  useEffect(() => {
    if (!editId) {
      setRailTarget(null);
      return;
    }

    let attempts = 0;
    let timeoutId = 0;

    function findRailTarget() {
      attempts += 1;
      const target = document.querySelector(".loombus-right-rail .space-y-4");

      if (target) {
        setRailTarget(target);
        return;
      }

      if (attempts < 30) {
        timeoutId = window.setTimeout(findRailTarget, 100);
      }
    }

    findRailTarget();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [editId]);

  useEffect(() => {
    let cancelled = false;

    async function loadEditData() {
      hydratedRef.current = false;
      setBody("");
      setAttachments([]);
      setAttachmentMessage("");

      if (!editId) {
        return;
      }

      const { data: discussionData } = await supabase
        .from("discussions")
        .select("body")
        .eq("id", editId)
        .is("deleted_at", null)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      setBody(typeof discussionData?.body === "string" ? discussionData.body : "");
      await refreshAttachments(editId);
    }

    void loadEditData();

    return () => {
      cancelled = true;
    };
  }, [editId]);

  useEffect(() => {
    if (!editId || !body || hydratedRef.current) {
      return;
    }

    let attempts = 0;
    let timeoutId = 0;

    function hydrateEditor() {
      attempts += 1;
      const editor = document.querySelector<HTMLDivElement>(
        '[role="textbox"][aria-label="Discussion body"]'
      );

      if (editor) {
        const currentText = editor.textContent?.trim() ?? "";

        if (!currentText) {
          editor.innerHTML = bodyValueToEditorHtml(body);
          editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
        }

        hydratedRef.current = true;
        return;
      }

      if (attempts < 30) {
        timeoutId = window.setTimeout(hydrateEditor, 100);
      }
    }

    hydrateEditor();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [body, editId]);

  const visibleAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.public_url),
    [attachments]
  );

  function pickAttachments() {
    setAttachmentMessage("");

    if (visibleAttachments.length >= MAX_ATTACHMENT_FILES) {
      setAttachmentMessage("Remove an existing attachment before adding a replacement.");
      return;
    }

    attachmentInputRef.current?.click();
  }

  async function handleAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!editId || selectedFiles.length === 0) {
      return;
    }

    const availableSlots = MAX_ATTACHMENT_FILES - visibleAttachments.length;

    if (selectedFiles.length > availableSlots) {
      setAttachmentMessage(
        availableSlots > 0
          ? `You can add ${availableSlots} more attachment${availableSlots === 1 ? "" : "s"}.`
          : "Remove an existing attachment before adding a replacement."
      );
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) =>
        !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type) ||
        file.size <= 0 ||
        file.size > MAX_ATTACHMENT_SIZE_BYTES
    );

    if (invalidFile) {
      setAttachmentMessage("Attachments must be JPG, PNG, WebP, GIF, or PDF files up to 10 MB each.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    setIsUploadingAttachment(true);
    setAttachmentMessage("");

    try {
      for (const [index, file] of selectedFiles.entries()) {
        const attachmentKind = getAttachmentKind(file.type);

        if (!attachmentKind) {
          setAttachmentMessage("Attachment type is not allowed.");
          return;
        }

        const extension = getSafeAttachmentFileName(file.name).split(".").pop() || "file";
        const storagePath = `${sessionData.session.user.id}/${editId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          setAttachmentMessage(`${file.name} could not upload.`);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from(ATTACHMENT_BUCKET)
          .getPublicUrl(storagePath);

        const response = await fetch("/api/discussions/attachments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            discussionId: editId,
            storagePath,
            publicUrl: publicUrlData.publicUrl,
            fileName: file.name,
            mimeType: file.type,
            fileSizeBytes: file.size,
            sortOrder: visibleAttachments.length + index,
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
          setAttachmentMessage(result.error ?? `${file.name} could not be attached.`);
          return;
        }
      }

      await refreshAttachments(editId);
      setAttachmentMessage("Attachment updated. Save text changes separately if needed.");
    } finally {
      setIsUploadingAttachment(false);
    }
  }

  async function removeAttachment(attachment: ExistingAttachment) {
    if (!editId || removingAttachmentId) {
      return;
    }

    const confirmed = window.confirm(`Remove ${attachment.file_name} from this discussion?`);

    if (!confirmed) {
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    setRemovingAttachmentId(attachment.id);
    setAttachmentMessage("");

    try {
      const response = await fetch("/api/discussions/attachments", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          attachmentId: attachment.id,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAttachmentMessage(result.error ?? "Attachment could not be removed.");
        return;
      }

      await refreshAttachments(editId);
      setAttachmentMessage("Attachment removed.");
    } finally {
      setRemovingAttachmentId(null);
    }
  }

  if (!editId || dismissed) {
    return null;
  }

  const card = (
    <EditControlsCard
      editId={editId}
      visibleAttachments={visibleAttachments}
      attachmentMessage={attachmentMessage}
      isUploadingAttachment={isUploadingAttachment}
      removingAttachmentId={removingAttachmentId}
      onDismiss={() => setDismissed(true)}
      onPickAttachments={pickAttachments}
      onRemoveAttachment={removeAttachment}
      variant="rail"
    />
  );

  return (
    <>
      <input
        ref={attachmentInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        onChange={handleAttachmentSelection}
        className="hidden"
      />
      {railTarget ? createPortal(card, railTarget) : null}
      <EditControlsCard
        editId={editId}
        visibleAttachments={visibleAttachments}
        attachmentMessage={attachmentMessage}
        isUploadingAttachment={isUploadingAttachment}
        removingAttachmentId={removingAttachmentId}
        onDismiss={() => setDismissed(true)}
        onPickAttachments={pickAttachments}
        onRemoveAttachment={removeAttachment}
        variant="mobile"
      />
    </>
  );
}
