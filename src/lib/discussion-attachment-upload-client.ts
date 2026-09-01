import { supabase } from "@/lib/supabase/client";
import { getAttachmentKindForMimeType } from "@/lib/video-context-limits";

const PUBLIC_BUCKET = "discussion-attachments";
const PROTECTED_BUCKET = "discussion-attachments-protected";

type UploadItem = { file: File; kind: string };

type UploadArgs = {
  items: UploadItem[];
  discussionId: string;
  accessToken: string;
  userId: string;
  protectedUpload: boolean;
};

function safeExtension(name: string) {
  const clean = name.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  return clean.split(".").pop() || "file";
}

function readVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(objectUrl);
      video.remove();
      if (Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error("Unable to read video duration."));
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      video.remove();
      reject(new Error("Unable to read video duration."));
    };
    video.src = objectUrl;
  });
}

async function cleanupProtectedUpload(args: {
  discussionId: string;
  storagePath: string;
  accessToken: string;
}) {
  await fetch("/api/discussions/attachments/upload-cleanup", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify({ discussionId: args.discussionId, storagePath: args.storagePath }),
  }).catch(() => null);
}

export async function uploadDiscussionAttachments({
  items,
  discussionId,
  accessToken,
  userId,
  protectedUpload,
}: UploadArgs): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const [index, item] of items.entries()) {
    const attachmentKind = getAttachmentKindForMimeType(item.file.type);
    if (!attachmentKind) return { ok: false, error: "Attachment type is not allowed." };

    let videoDurationSeconds: number | null = null;
    if (attachmentKind === "video") {
      try {
        videoDurationSeconds = await readVideoDuration(item.file);
      } catch {
        return { ok: false, error: "Unable to read video duration. Please choose a different video." };
      }
    }

    const storagePath = `${userId}/${discussionId}/${crypto.randomUUID()}.${safeExtension(item.file.name)}`;
    let storageBucket = PUBLIC_BUCKET;
    let publicUrl: string | null = null;

    if (protectedUpload) {
      const authorizeResponse = await fetch("/api/discussions/attachments/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ discussionId, storagePath }),
      });
      const authorization = await authorizeResponse.json().catch(() => ({}));
      if (!authorizeResponse.ok || !authorization.token) {
        return {
          ok: false,
          error: authorization.error ?? `Discussion was saved, but ${item.file.name} could not be authorized for upload.`,
        };
      }

      storageBucket = authorization.bucket ?? PROTECTED_BUCKET;
      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .uploadToSignedUrl(storagePath, authorization.token, item.file, {
          contentType: item.file.type,
        });
      if (uploadError) {
        return {
          ok: false,
          error: `Discussion was saved, but ${item.file.name} could not upload: ${uploadError.message}`,
        };
      }
    } else {
      const { error: uploadError } = await supabase.storage
        .from(PUBLIC_BUCKET)
        .upload(storagePath, item.file, { contentType: item.file.type, upsert: false });
      if (uploadError) {
        return {
          ok: false,
          error: `Discussion was saved, but ${item.file.name} could not upload: ${uploadError.message}`,
        };
      }
      publicUrl = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(storagePath).data.publicUrl;
    }

    const response = await fetch("/api/discussions/attachments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        discussionId,
        storageBucket,
        storagePath,
        publicUrl,
        fileName: item.file.name,
        mimeType: item.file.type,
        fileSizeBytes: item.file.size,
        videoDurationSeconds,
        sortOrder: index,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (protectedUpload) {
        await cleanupProtectedUpload({ discussionId, storagePath, accessToken });
      } else {
        await supabase.storage.from(PUBLIC_BUCKET).remove([storagePath]);
      }
      return {
        ok: false,
        error: result.error ?? `Discussion was saved, but ${item.file.name} could not be attached.`,
      };
    }
  }
  return { ok: true };
}
