import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  formatRoomBytes,
  getRoomPlanEntitlements,
} from "@/lib/room-plan-entitlements";
import {
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
  type RoomRow,
} from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const BUCKET = "room-resources";
const SIGNED_URL_SECONDS = 60 * 60;
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

type AuthorizedContext =
  | {
      ok: true;
      userId: string;
      serviceSupabase: ReturnType<typeof createRoomServiceSupabase>;
    }
  | { ok: false; response: NextResponse };

type StoredObjectInfo = {
  sizeBytes: number;
  mimeType: string | null;
};

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedMimeType(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function extensionMimeType(fileName: string) {
  const normalizedName = fileName.toLowerCase();
  const extension = Object.keys(MIME_BY_EXTENSION).find((candidate) =>
    normalizedName.endsWith(candidate)
  );
  return extension ? MIME_BY_EXTENSION[extension] : null;
}

function uploadMimeType(fileName: string, value: unknown) {
  const supplied = normalizedMimeType(value);
  if (supplied && supplied !== "application/octet-stream") return supplied;
  return extensionMimeType(fileName) ?? supplied ?? "";
}

async function authorize(request: NextRequest): Promise<AuthorizedContext> {
  try {
    const requestSupabase = createRequestSupabase(request);
    const accountAccess = await verifyRequestAccountAccess(requestSupabase);
    if (!accountAccess.ok) {
      return {
        ok: false,
        response: jsonError(
          accountAccess.error,
          accountAccess.status,
          accountAccess.code
        ),
      };
    }
    return {
      ok: true,
      userId: accountAccess.user.id,
      serviceSupabase: createRoomServiceSupabase(),
    };
  } catch {
    return {
      ok: false,
      response: jsonError("Rooms service is not configured.", 500),
    };
  }
}

function safeFileName(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[\\/\0<>:"|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 180)
    .trim();
  return cleaned || "room-resource";
}

function mediaKind(mimeType: string) {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  return "file";
}

function serializeEntitlements(
  entitlements: ReturnType<typeof getRoomPlanEntitlements>
) {
  return {
    id: entitlements.id,
    label: entitlements.label,
    roomLimit: entitlements.roomLimit,
    memberLimit: entitlements.memberLimit,
    fileUploads: entitlements.fileUploads,
    inlineVideo: entitlements.inlineVideo,
    maxFileBytes: entitlements.maxFileBytes,
    maxFileLabel: formatRoomBytes(entitlements.maxFileBytes),
    storageBytes: entitlements.storageBytes,
    storageLabel: formatRoomBytes(entitlements.storageBytes),
    features: entitlements.features,
  };
}

async function resourceUsage(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string
) {
  const result = await serviceSupabase
    .from("room_resources")
    .select("file_size_bytes")
    .eq("room_id", roomId);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).reduce(
    (total, row) => total + Number(row.file_size_bytes ?? 0),
    0
  );
}

async function getStoredObjectInfo(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  storagePath: string
): Promise<StoredObjectInfo | null> {
  const slash = storagePath.lastIndexOf("/");
  if (slash < 1) return null;
  const folder = storagePath.slice(0, slash);
  const name = storagePath.slice(slash + 1);
  const result = await serviceSupabase.storage
    .from(BUCKET)
    .list(folder, { limit: 10, search: name });
  if (result.error) return null;

  const item = result.data?.find((candidate) => candidate.name === name);
  if (!item) return null;

  const itemRecord = item as unknown as Record<string, unknown>;
  const metadata = isRecord(itemRecord.metadata) ? itemRecord.metadata : {};
  const rawSize =
    metadata.size ??
    metadata.contentLength ??
    metadata.content_length ??
    itemRecord.size ??
    0;
  const sizeBytes = Number(rawSize);
  const mimeType =
    normalizedMimeType(metadata.mimetype) ??
    normalizedMimeType(metadata.mime_type) ??
    normalizedMimeType(metadata.contentType) ??
    normalizedMimeType(metadata.content_type) ??
    normalizedMimeType(itemRecord.mimetype) ??
    normalizedMimeType(itemRecord.mime_type);

  return {
    sizeBytes:
      Number.isSafeInteger(sizeBytes) && sizeBytes > 0 ? sizeBytes : 0,
    mimeType,
  };
}

async function removeStoredObject(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  storagePath: string
) {
  await serviceSupabase.storage.from(BUCKET).remove([storagePath]);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid Room id.", 400);

  const { userId, serviceSupabase } = authorized;
  const access = await getRoomAccess(serviceSupabase, roomId, userId).catch(
    () => null
  );
  if (!access) return jsonError("Room not found.", 404);
  if (!access.allowed) return jsonError("Room membership is required.", 403);

  const entitlements = getRoomPlanEntitlements(
    access.room.subscriptionPlan,
    access.room.subscriptionStatus
  );
  const result = await serviceSupabase
    .from("room_resources")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (result.error) {
    return jsonError("Room resources could not be loaded.", 503);
  }

  const rows = (result.data ?? []) as RoomRow[];
  const resources = await Promise.all(
    rows.map(async (row) => {
      const storagePath = asString(row.storage_path);
      const signed = await serviceSupabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
      return {
        id: asString(row.id),
        fileName: asString(row.file_name) || "Room resource",
        mimeType: asString(row.mime_type) || "application/octet-stream",
        mediaKind: asString(row.media_kind) || "file",
        fileSizeBytes: Number(row.file_size_bytes ?? 0),
        uploadedBy: asString(row.uploaded_by),
        createdAt: asString(row.created_at) || null,
        url: signed.data?.signedUrl ?? null,
        canDelete:
          access.canManage || asString(row.uploaded_by) === userId,
      };
    })
  );

  const usedBytes = resources.reduce(
    (total, resource) => total + resource.fileSizeBytes,
    0
  );

  return NextResponse.json(
    {
      roomId,
      resources,
      usedBytes,
      usedLabel: formatRoomBytes(usedBytes),
      entitlements: serializeEntitlements(entitlements),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid Room id.", 400);

  const { userId, serviceSupabase } = authorized;
  const access = await getRoomAccess(serviceSupabase, roomId, userId).catch(
    () => null
  );
  if (!access) return jsonError("Room not found.", 404);
  if (!access.allowed) return jsonError("Room membership is required.", 403);

  const entitlements = getRoomPlanEntitlements(
    access.room.subscriptionPlan,
    access.room.subscriptionStatus
  );
  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "create_upload") {
    if (!entitlements.fileUploads) {
      return jsonError(
        "Private file uploads begin with Room Starter.",
        403,
        "room_plan_file_upload_locked"
      );
    }

    const fileName = safeFileName(body?.fileName);
    const mimeType = uploadMimeType(fileName, body?.mimeType);
    const fileSizeBytes = Number(body?.fileSizeBytes ?? 0);
    const kind = mediaKind(mimeType);

    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
      return jsonError("This file type is not supported in Room resources.", 400);
    }
    if (kind === "video" && !entitlements.inlineVideo) {
      return jsonError(
        "Inline video begins with Room Pro.",
        403,
        "room_plan_inline_video_locked"
      );
    }
    if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes <= 0) {
      return jsonError("The upload size is invalid.", 400);
    }
    if (fileSizeBytes > entitlements.maxFileBytes) {
      return jsonError(
        `This plan allows up to ${formatRoomBytes(
          entitlements.maxFileBytes
        )} per upload.`,
        413,
        "room_resource_file_too_large"
      );
    }

    const usedBytes = await resourceUsage(serviceSupabase, roomId).catch(
      () => -1
    );
    if (usedBytes < 0) {
      return jsonError("Room storage usage could not be verified.", 503);
    }
    if (usedBytes + fileSizeBytes > entitlements.storageBytes) {
      return jsonError(
        `This Room has reached its ${formatRoomBytes(
          entitlements.storageBytes
        )} resource storage allowance.`,
        413,
        "room_resource_storage_limit"
      );
    }

    const storagePath = `${roomId}/${userId}/${randomUUID()}-${fileName}`;
    const signed = await serviceSupabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);
    if (signed.error || !signed.data?.token) {
      return jsonError("A secure Room upload could not be prepared.", 503);
    }

    return NextResponse.json(
      {
        storagePath,
        token: signed.data.token,
        fileName,
        mimeType,
        mediaKind: kind,
        fileSizeBytes,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (action === "complete_upload") {
    if (!entitlements.fileUploads) {
      return jsonError("File uploads are not included in this Room plan.", 403);
    }

    const storagePath = asString(body?.storagePath);
    const fileName = safeFileName(body?.fileName);
    const declaredMimeType = uploadMimeType(fileName, body?.mimeType);
    const declaredSizeBytes = Number(body?.fileSizeBytes ?? 0);
    const expectedPrefix = `${roomId}/${userId}/`;

    if (!storagePath.startsWith(expectedPrefix)) {
      return jsonError("The Room upload path is invalid.", 400);
    }
    if (!ACCEPTED_MIME_TYPES.has(declaredMimeType)) {
      await removeStoredObject(serviceSupabase, storagePath);
      return jsonError("This file type is not supported in Room resources.", 400);
    }
    if (
      !Number.isSafeInteger(declaredSizeBytes) ||
      declaredSizeBytes <= 0 ||
      declaredSizeBytes > entitlements.maxFileBytes
    ) {
      await removeStoredObject(serviceSupabase, storagePath);
      return jsonError("The Room resource size is invalid.", 400);
    }

    const storedObject = await getStoredObjectInfo(
      serviceSupabase,
      storagePath
    );
    if (!storedObject || storedObject.sizeBytes <= 0 || !storedObject.mimeType) {
      await removeStoredObject(serviceSupabase, storagePath);
      return jsonError(
        "The uploaded Room resource metadata could not be verified.",
        400
      );
    }

    if (
      !ACCEPTED_MIME_TYPES.has(storedObject.mimeType) ||
      storedObject.mimeType !== declaredMimeType
    ) {
      await removeStoredObject(serviceSupabase, storagePath);
      return jsonError(
        "The stored file type does not match the prepared Room upload.",
        400,
        "room_resource_type_mismatch"
      );
    }

    const actualSizeBytes = storedObject.sizeBytes;
    const actualMimeType = storedObject.mimeType;
    const kind = mediaKind(actualMimeType);

    if (kind === "video" && !entitlements.inlineVideo) {
      await removeStoredObject(serviceSupabase, storagePath);
      return jsonError("Inline video is not included in this Room plan.", 403);
    }
    if (actualSizeBytes > entitlements.maxFileBytes) {
      await removeStoredObject(serviceSupabase, storagePath);
      return jsonError(
        `This plan allows up to ${formatRoomBytes(
          entitlements.maxFileBytes
        )} per upload.`,
        413,
        "room_resource_file_too_large"
      );
    }

    const usedBytes = await resourceUsage(serviceSupabase, roomId).catch(
      () => -1
    );
    if (
      usedBytes < 0 ||
      usedBytes + actualSizeBytes > entitlements.storageBytes
    ) {
      await removeStoredObject(serviceSupabase, storagePath);
      return jsonError("The Room resource storage allowance was exceeded.", 413);
    }

    const inserted = await serviceSupabase
      .from("room_resources")
      .insert({
        room_id: roomId,
        uploaded_by: userId,
        file_name: fileName,
        storage_path: storagePath,
        mime_type: actualMimeType,
        media_kind: kind,
        file_size_bytes: actualSizeBytes,
      })
      .select("id")
      .single();

    if (inserted.error) {
      await removeStoredObject(serviceSupabase, storagePath);
      return jsonError("The Room resource could not be saved.", 503);
    }

    await logAuditEvent({
      actor_id: userId,
      action: "room.resource.uploaded",
      target_type: "room_resource",
      target_id: asString(inserted.data?.id),
      metadata: {
        room_id: roomId,
        room_plan: entitlements.id,
        media_kind: kind,
        file_size_bytes: actualSizeBytes,
      },
    });

    return NextResponse.json(
      { ok: true, resourceId: asString(inserted.data?.id) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  return jsonError("Unsupported Room resource action.", 400);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid Room id.", 400);

  const { userId, serviceSupabase } = authorized;
  const access = await getRoomAccess(serviceSupabase, roomId, userId).catch(
    () => null
  );
  if (!access) return jsonError("Room not found.", 404);
  if (!access.allowed) return jsonError("Room membership is required.", 403);

  const body = await request.json().catch(() => null);
  const resourceId = asString(body?.resourceId);
  if (!validUuid(resourceId)) return jsonError("Invalid resource id.", 400);

  const found = await serviceSupabase
    .from("room_resources")
    .select("*")
    .eq("id", resourceId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (found.error) return jsonError("The Room resource could not be verified.", 503);
  if (!found.data) return jsonError("Room resource not found.", 404);

  const row = found.data as RoomRow;
  if (!access.canManage && asString(row.uploaded_by) !== userId) {
    return jsonError("You cannot delete this Room resource.", 403);
  }

  const storagePath = asString(row.storage_path);
  const removedObject = await serviceSupabase.storage
    .from(BUCKET)
    .remove([storagePath]);
  if (removedObject.error) {
    return jsonError("The stored Room resource could not be removed.", 503);
  }

  const removedRow = await serviceSupabase
    .from("room_resources")
    .delete()
    .eq("id", resourceId)
    .eq("room_id", roomId);
  if (removedRow.error) {
    return jsonError("The Room resource record could not be removed.", 503);
  }

  await logAuditEvent({
    actor_id: userId,
    action: "room.resource.deleted",
    target_type: "room_resource",
    target_id: resourceId,
    metadata: { room_id: roomId },
  });

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
