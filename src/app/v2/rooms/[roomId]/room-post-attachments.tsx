"use client";

import { useEffect } from "react";
import { Plus, UploadCloud } from "lucide-react";
import { createRoot } from "react-dom/client";
import { supabase } from "@/lib/supabase/client";

const BUCKET = "room-post-attachments";
const MAX_FILES = 6;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

type AttachmentRow = {
  id: string;
  post_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  kind: "image" | "video" | "file";
};

type PostIdRow = { id: string };

function getKind(file: File): "image" | "video" | "file" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "upload";
}

function formatBytes(value: number | null) {
  if (!value) return "File";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function RoomAttachmentButton({ onAttach }: { onAttach: () => void }) {
  return (
    <button
      type="button"
      onClick={onAttach}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-amber-200 hover:text-amber-700"
    >
      <Plus className="size-4" />
      Attach
    </button>
  );
}

async function getSignedUrl(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? "";
}

async function renderAttachment(article: HTMLElement, attachment: AttachmentRow) {
  const signedUrl = await getSignedUrl(attachment.storage_path);
  if (!signedUrl) return;

  const wrapper = document.createElement("div");
  wrapper.className = "mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50";

  if (attachment.kind === "image") {
    const image = document.createElement("img");
    image.src = signedUrl;
    image.alt = attachment.file_name;
    image.loading = "lazy";
    image.className = "max-h-[420px] w-full object-contain bg-white";
    wrapper.appendChild(image);
  } else if (attachment.kind === "video") {
    const video = document.createElement("video");
    video.src = signedUrl;
    video.controls = true;
    video.playsInline = true;
    video.className = "max-h-[460px] w-full bg-black";
    wrapper.appendChild(video);
  } else {
    const link = document.createElement("a");
    link.href = signedUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.className = "flex items-center justify-between gap-3 p-4 text-sm font-black text-slate-800 hover:bg-white";
    link.innerHTML = `<span>${attachment.file_name}</span><span class=\"text-xs uppercase tracking-[0.12em] text-slate-500\">${formatBytes(attachment.file_size)}</span>`;
    wrapper.appendChild(link);
  }

  article.appendChild(wrapper);
}

async function renderFeedAttachments(roomId: string) {
  const section = document.querySelector<HTMLElement>("main.loombus-v2-page-bg section#discussions");
  if (!section) return;

  const articles = Array.from(section.querySelectorAll<HTMLElement>("article"));
  if (!articles.length) return;

  const { data: postData } = await supabase
    .from("room_posts")
    .select("id")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(articles.length);

  const posts = (postData ?? []) as PostIdRow[];
  const postIds = posts.map((post) => post.id).filter(Boolean);
  if (!postIds.length) return;

  const { data: attachmentData } = await supabase
    .from("room_post_attachments")
    .select("id, post_id, storage_path, file_name, mime_type, file_size, kind")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  const attachments = ((attachmentData ?? []) as AttachmentRow[]).reduce<Record<string, AttachmentRow[]>>((acc, attachment) => {
    acc[attachment.post_id] = [...(acc[attachment.post_id] ?? []), attachment];
    return acc;
  }, {});

  articles.forEach((article, index) => {
    const post = posts[index];
    if (!post || article.dataset.roomAttachmentsRendered === post.id) return;
    article.dataset.roomAttachmentsRendered = post.id;
    (attachments[post.id] ?? []).forEach((attachment) => {
      void renderAttachment(article, attachment);
    });
  });
}

function mountComposerEnhancer(roomId: string) {
  const section = document.querySelector<HTMLElement>("main.loombus-v2-page-bg section#discussions");
  const form = section?.querySelector<HTMLFormElement>("form");
  if (!form || form.dataset.roomAttachmentComposer === "true") return;

  form.dataset.roomAttachmentComposer = "true";

  let selectedFiles: File[] = [];
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.accept = "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";
  fileInput.className = "hidden";

  const preview = document.createElement("div");
  preview.className = "mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600";

  const buttonMount = document.createElement("div");
  buttonMount.className = "mt-3 flex items-center justify-between gap-3";

  const status = document.createElement("p");
  status.className = "text-xs font-bold text-slate-500";

  function refreshPreview() {
    preview.innerHTML = "";
    selectedFiles.forEach((file) => {
      const pill = document.createElement("span");
      pill.className = "rounded-full bg-white px-3 py-1 ring-1 ring-slate-200";
      pill.textContent = `${file.name} · ${formatBytes(file.size)}`;
      preview.appendChild(pill);
    });
    status.textContent = selectedFiles.length ? `${selectedFiles.length} attachment${selectedFiles.length === 1 ? "" : "s"} selected` : "Images, videos, and files stay inside this room.";
  }

  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files ?? []).filter((file) => file.size <= MAX_FILE_SIZE).slice(0, MAX_FILES);
    selectedFiles = files;
    refreshPreview();
  });

  form.appendChild(fileInput);
  form.appendChild(buttonMount);
  form.appendChild(preview);

  createRoot(buttonMount).render(<RoomAttachmentButton onAttach={() => fileInput.click()} />);
  buttonMount.appendChild(status);
  refreshPreview();

  form.addEventListener(
    "submit",
    async (event) => {
      if (!selectedFiles.length) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const titleInput = form.querySelector<HTMLInputElement>('input[placeholder*="title" i]');
      const bodyInput = form.querySelector<HTMLTextAreaElement>("textarea");
      const title = titleInput?.value.trim() || null;
      const body = bodyInput?.value.trim() || "Shared attachment";

      status.textContent = "Uploading attachments...";

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        status.textContent = "Sign in required before uploading.";
        return;
      }

      const { data: post, error: postError } = await supabase
        .from("room_posts")
        .insert({ room_id: roomId, author_id: userId, title, body })
        .select("id")
        .single();

      if (postError || !post?.id) {
        status.textContent = "Loombus could not create this room post.";
        return;
      }

      const records = [];
      for (const file of selectedFiles) {
        const fileId = crypto.randomUUID();
        const fileName = cleanFileName(file.name);
        const storagePath = `${roomId}/${post.id}/${fileId}-${fileName}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (uploadError) {
          status.textContent = `Upload failed for ${file.name}.`;
          return;
        }
        records.push({
          room_id: roomId,
          post_id: post.id,
          uploader_id: userId,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
          kind: getKind(file),
        });
      }

      const { error: attachmentError } = await supabase.from("room_post_attachments").insert(records);
      if (attachmentError) {
        status.textContent = "Post created, but attachment records could not be saved.";
        return;
      }

      selectedFiles = [];
      if (titleInput) titleInput.value = "";
      if (bodyInput) bodyInput.value = "";
      status.textContent = "Posted.";
      window.location.reload();
    },
    true,
  );
}

export function RoomPostAttachments({ roomId }: { roomId: string }) {
  useEffect(() => {
    let renderTimer: number | null = null;

    function refresh() {
      mountComposerEnhancer(roomId);
      if (renderTimer) window.clearTimeout(renderTimer);
      renderTimer = window.setTimeout(() => {
        void renderFeedAttachments(roomId);
      }, 100);
    }

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (renderTimer) window.clearTimeout(renderTimer);
      observer.disconnect();
    };
  }, [roomId]);

  return null;
}
