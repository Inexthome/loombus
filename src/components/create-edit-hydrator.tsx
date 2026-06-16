"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";

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

function EditControlsCard({
  editId,
  visibleAttachments,
  onDismiss,
  variant,
}: {
  editId: string;
  visibleAttachments: ExistingAttachment[];
  onDismiss: () => void;
  variant: "mobile" | "rail";
}) {
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
            Save changes when ready, or cancel to return without submitting this edit.
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

      {visibleAttachments.length > 0 && (
        <div className="mt-4 border-t border-[var(--loombus-border)] pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
            Existing attachments
          </p>
          <div className="space-y-2">
            {visibleAttachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.public_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3 text-sm transition hover:border-[var(--loombus-text-subtle)]"
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
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export function CreateEditHydrator() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const hydratedRef = useRef(false);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<ExistingAttachment[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [railTarget, setRailTarget] = useState<Element | null>(null);

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

      if (!editId) {
        return;
      }

      const [{ data: discussionData }, { data: attachmentData }] = await Promise.all([
        supabase
          .from("discussions")
          .select("body")
          .eq("id", editId)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("discussion_attachments")
          .select("id, public_url, file_name, mime_type, file_size_bytes, attachment_kind, sort_order")
          .eq("discussion_id", editId)
          .order("sort_order", { ascending: true }),
      ]);

      if (cancelled) {
        return;
      }

      setBody(typeof discussionData?.body === "string" ? discussionData.body : "");
      setAttachments((attachmentData ?? []) as ExistingAttachment[]);
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

  if (!editId || dismissed) {
    return null;
  }

  const card = (
    <EditControlsCard
      editId={editId}
      visibleAttachments={visibleAttachments}
      onDismiss={() => setDismissed(true)}
      variant="rail"
    />
  );

  return (
    <>
      {railTarget ? createPortal(card, railTarget) : null}
      <EditControlsCard
        editId={editId}
        visibleAttachments={visibleAttachments}
        onDismiss={() => setDismissed(true)}
        variant="mobile"
      />
    </>
  );
}
