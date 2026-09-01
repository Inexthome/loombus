from pathlib import Path

composer_path = Path("src/components/create-discussion-composer.tsx")
s = composer_path.read_text()
anchor = 'import { supabase } from "@/lib/supabase/client";\n'
helper = 'import { uploadDiscussionAttachments } from "@/lib/discussion-attachment-upload-client";\n'
if helper not in s:
    s = s.replace(anchor, anchor + helper, 1)
s = s.replace('''    if (attachmentsRestricted) {
      setAttachmentMessage(
        "Attachments require Public visibility. Change Future Discussion visibility in Settings."
      );
      event.target.value = "";
      return;
    }
''', "", 1)
s = s.replace('''    if (attachmentsRestricted && contextItems.length > 0) {
      setMessage(
        "Remove staged attachments or change Future Discussion visibility to Public in Settings."
      );
      setPublishing(false);
      return;
    }
''', "", 1)
s = s.replace("disabled={attachmentsRestricted}", "disabled={false}", 1)
start = s.index("  async function uploadContext({")
end = s.index("\n\n  async function publishDiscussion", start)
wrapper = '''  async function uploadContext({
    discussionId,
    accessToken,
    userId,
  }: {
    discussionId: string;
    accessToken: string;
    userId: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    return uploadDiscussionAttachments({
      items: contextItems,
      discussionId,
      accessToken,
      userId,
      protectedUpload: attachmentsRestricted,
    });
  }'''
s = s[:start] + wrapper + s[end:]
composer_path.write_text(s)

model_path = Path("src/app/discussions/[id]/discussion-detail-v2-model.ts")
s = model_path.read_text()
s = s.replace(
    "  public_url: string;\n",
    "  public_url: string | null;\n  media_url?: string | null;\n",
    1,
)
model_path.write_text(s)

hook_path = Path("src/app/discussions/[id]/use-discussion-detail-v2.ts")
s = hook_path.read_text()
s = s.replace(
    '"id, public_url, file_name, mime_type, file_size_bytes, attachment_kind, video_duration_seconds, sort_order"',
    '"id, storage_bucket, public_url, file_name, mime_type, file_size_bytes, attachment_kind, video_duration_seconds, sort_order"',
    1,
)
old = "    setDiscussionAttachments((attachmentResult.data ?? []) as DiscussionAttachment[]);\n"
new = '''    const rawAttachments = (attachmentResult.data ?? []) as DiscussionAttachment[];
    const mediaToken = viewer ? await getAccessToken() : null;
    const resolvedAttachments = await Promise.all(
      rawAttachments.map(async (attachment) => {
        if (attachment.public_url) return { ...attachment, media_url: attachment.public_url };
        try {
          const response = await fetch(
            `/api/discussions/attachments/access?attachmentId=${encodeURIComponent(attachment.id)}`,
            {
              headers: mediaToken ? { Authorization: `Bearer ${mediaToken}` } : {},
              cache: "no-store",
            }
          );
          if (!response.ok) return { ...attachment, media_url: null };
          const result = (await response.json().catch(() => ({}))) as { url?: string };
          return { ...attachment, media_url: result.url ?? null };
        } catch {
          return { ...attachment, media_url: null };
        }
      })
    );
    setDiscussionAttachments(resolvedAttachments);
'''
if old not in s:
    raise SystemExit("detail attachment assignment changed; refusing patch")
hook_path.write_text(s.replace(old, new, 1))

components_path = Path("src/app/discussions/[id]/discussion-detail-v2-components.tsx")
s = components_path.read_text()
marker = "      {attachments.map((attachment) => {\n"
if marker not in s:
    raise SystemExit("attachment gallery changed; refusing patch")
s = s.replace(
    marker,
    marker + "        const mediaUrl = attachment.media_url ?? attachment.public_url;\n        if (!mediaUrl) return null;\n",
    1,
)
s = s.replace("attachment.public_url", "mediaUrl")
components_path.write_text(s)
