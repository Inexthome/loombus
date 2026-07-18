import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase, createRoomServiceSupabase } from "@/lib/room-operations";

const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
}

function safeFilename(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "request-attachment";
}

async function authorize(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!access.ok) return { ok: false as const, response: response({ error: access.error, code: access.code }, access.status) };
  const service = createRoomServiceSupabase();
  const { data: sensitive, error } = await service
    .from("profile_sensitive")
    .select("age_band, guardian_required")
    .eq("id", access.user.id)
    .maybeSingle();
  const ageBand = String(sensitive?.age_band ?? "unknown");
  if (error || ageBand === "unknown" || ageBand === "under_13" || sensitive?.guardian_required === true) {
    return {
      ok: false as const,
      response: response(
        {
          error:
            ageBand === "under_13" || sensitive?.guardian_required === true
              ? "Loombus is not available to children under 13."
              : "Complete age safety before uploading a public Request attachment.",
          code:
            ageBand === "under_13" || sensitive?.guardian_required === true
              ? "under_13_not_allowed"
              : "age_gate_required",
        },
        403,
      ),
    };
  }
  return { ok: true as const, userId: access.user.id, service };
}

export async function POST(request: NextRequest) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await authorized.service
      .from("action_rate_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authorized.userId)
      .eq("action_key", "service_request_attachment_upload")
      .gte("created_at", since);
    if (countError) return response({ error: "Unable to verify the attachment upload limit." }, 503);
    if ((count ?? 0) >= 40) return response({ error: "You have reached the Request attachment upload limit for this hour." }, 429);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return response({ error: "Choose a request attachment." }, 400);
    if (!ALLOWED_TYPES.has(file.type)) return response({ error: "Request attachments must be JPEG, PNG, WebP, or PDF." }, 400);
    if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) return response({ error: "Each request attachment must be 12 MB or smaller." }, 400);

    const rawName = safeFilename(file.name.replace(/\.[^.]+$/, ""));
    const extension = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : file.type === "application/pdf" ? ".pdf" : ".jpg";
    const path = `${authorized.userId}/${new Date().getUTCFullYear()}/${crypto.randomUUID()}-${rawName}${extension}`;

    const { error: rateError } = await authorized.service.from("action_rate_events").insert({
      user_id: authorized.userId,
      action_key: "service_request_attachment_upload",
      target_id: null,
    });
    if (rateError) return response({ error: "Unable to reserve the attachment upload." }, 503);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await authorized.service.storage
      .from("service-request-attachments")
      .upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: "31536000" });
    if (uploadError) return response({ error: "Unable to upload the request attachment." }, 503);

    const { data } = authorized.service.storage.from("service-request-attachments").getPublicUrl(path);
    return response({ attachment: { path, url: data.publicUrl, type: file.type, name: file.name.slice(0, 200) } }, 201);
  } catch (error) {
    console.error("Request attachment upload failed:", error);
    return response({ error: "Unable to upload the request attachment." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  try {
    const body = await request.json().catch(() => null);
    const path = body && typeof body === "object" && !Array.isArray(body)
      ? String((body as Record<string, unknown>).path ?? "").trim().slice(0, 600)
      : "";
    if (!path || !path.startsWith(`${authorized.userId}/`)) return response({ error: "This request attachment cannot be removed." }, 403);
    const { data: attached } = await authorized.service.from("service_requests").select("id").contains("attachment_paths", [path]).limit(1);
    if ((attached ?? []).length > 0) return response({ error: "Remove the attachment from the request before deleting it." }, 409);
    const { error } = await authorized.service.storage.from("service-request-attachments").remove([path]);
    if (error) return response({ error: "Unable to delete the request attachment." }, 503);
    return response({ deleted: true });
  } catch (error) {
    console.error("Request attachment deletion failed:", error);
    return response({ error: "Unable to delete the request attachment." }, 500);
  }
}
