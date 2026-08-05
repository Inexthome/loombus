import { NextResponse, type NextRequest } from "next/server";
import { createNotifications } from "@/lib/notifications";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
} from "@/lib/room-operations";

export const dynamic = "force-dynamic";
const BUCKET = "room-resources";
const SIGNED_URL_SECONDS = 60 * 60;
const CATEGORIES = new Set([
  "governing",
  "minutes",
  "financial",
  "forms",
  "policies",
  "newsletters",
  "maps",
  "emergency",
  "other",
]);
const VISIBILITIES = new Set(["members", "board", "managers"]);

type Context = { params: Promise<{ roomId: string }> };
type Row = Record<string, any>;

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function text(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function uuid(value: unknown) {
  const candidate = text(value, 60);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : "";
}

function tags(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return [...new Set(values.map((item) => text(item, 40).toLowerCase()).filter(Boolean))].slice(0, 20);
}

async function authorize(request: NextRequest, roomId: string) {
  const account = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!account.ok) return { ok: false as const, response: json({ error: account.error, code: account.code }, account.status) };
  const service = createRoomServiceSupabase();
  const access = await getRoomAccess(service, roomId, account.user.id).catch(() => null);
  if (!access) return { ok: false as const, response: json({ error: "Room not found." }, 404) };
  if (!access.allowed && !access.isOwner) {
    return { ok: false as const, response: json({ error: "Active Room membership is required." }, 403) };
  }
  return { ok: true as const, userId: account.user.id, service, access };
}

function canSee(row: Row, access: Awaited<ReturnType<typeof getRoomAccess>>) {
  if (!access) return false;
  const visibility = text(row.visibility, 20) || "members";
  if (visibility === "members") return true;
  if (visibility === "managers") return access.canManage || access.isOwner;
  return access.canModerate || access.canManage || access.isOwner;
}

async function serializeDocument(
  service: ReturnType<typeof createRoomServiceSupabase>,
  row: Row,
  access: NonNullable<Awaited<ReturnType<typeof getRoomAccess>>>
) {
  const resource = row.resource ?? {};
  const storagePath = text(resource.storage_path, 1000);
  const signed = storagePath
    ? await service.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS)
    : { data: null };
  return {
    id: String(row.id),
    resourceId: String(row.resource_id),
    documentGroupId: String(row.document_group_id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    category: String(row.category),
    visibility: String(row.visibility),
    tags: Array.isArray(row.tags) ? row.tags : [],
    versionNumber: Number(row.version_number),
    isCurrent: Boolean(row.is_current),
    isPinned: Boolean(row.is_pinned),
    status: String(row.status),
    downloadCount: Number(row.download_count ?? 0),
    publishedAt: String(row.published_at),
    updatedAt: String(row.updated_at),
    fileName: text(resource.file_name, 200) || "Room document",
    mimeType: text(resource.mime_type, 200) || "application/octet-stream",
    fileSizeBytes: Number(resource.file_size_bytes ?? 0),
    url: signed.data?.signedUrl ?? null,
    canManage: access.canManage || access.isOwner,
  };
}

export async function GET(request: NextRequest, context: Context) {
  const { roomId } = await context.params;
  const authorized = await authorize(request, roomId);
  if (!authorized.ok) return authorized.response;

  const result = await authorized.service
    .from("room_documents")
    .select("*, resource:room_resources(id,file_name,storage_path,mime_type,file_size_bytes,uploaded_by,created_at)")
    .eq("room_id", roomId)
    .eq("status", "published")
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(500);

  if (result.error) {
    if (result.error.code === "42P01" || /room_documents|schema cache/i.test(result.error.message ?? "")) {
      return json({ error: "Room Documents require the pending database migration.", code: "room_documents_migration_required" }, 503);
    }
    return json({ error: "Room documents could not be loaded." }, 503);
  }

  const visible = (result.data ?? []).filter((row) => canSee(row as Row, authorized.access));
  const documents = await Promise.all(
    visible.map((row) => serializeDocument(authorized.service, row as Row, authorized.access))
  );
  return json({
    room: { id: authorized.access.room.id, name: authorized.access.room.name },
    access: {
      role: authorized.access.role,
      canManage: authorized.access.canManage || authorized.access.isOwner,
      canModerate: authorized.access.canModerate,
    },
    documents,
  });
}

async function notifyMembers(
  service: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string,
  actorId: string,
  documentId: string,
  message: string
) {
  const members = await service
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("status", "active")
    .limit(1000);
  if (members.error) return;
  const payloads = (members.data ?? [])
    .map((row) => text(row.user_id, 60))
    .filter((id) => id && id !== actorId)
    .map((userId) => ({
      user_id: userId,
      actor_id: actorId,
      type: "room_document_published",
      target_type: "room_document",
      target_id: documentId,
      room_id: roomId,
      message,
    }));
  await createNotifications(payloads).catch(() => null);
}

export async function POST(request: NextRequest, context: Context) {
  const { roomId } = await context.params;
  const authorized = await authorize(request, roomId);
  if (!authorized.ok) return authorized.response;
  const body = await request.json().catch(() => ({}));
  const action = text(body.action, 40);

  if (action === "register") {
    if (!authorized.access.canManage && !authorized.access.isOwner) {
      return json({ error: "Room management access is required." }, 403);
    }
    const resourceId = uuid(body.resourceId);
    const title = text(body.title, 200);
    const description = text(body.description, 4000) || null;
    const category = CATEGORIES.has(text(body.category, 30)) ? text(body.category, 30) : "other";
    const visibility = VISIBILITIES.has(text(body.visibility, 30)) ? text(body.visibility, 30) : "members";
    const previousId = uuid(body.previousDocumentId);
    if (!resourceId || title.length < 2) return json({ error: "Choose an uploaded file and add a document title." }, 400);

    const resource = await authorized.service
      .from("room_resources")
      .select("id,uploaded_by")
      .eq("id", resourceId)
      .eq("room_id", roomId)
      .maybeSingle();
    if (resource.error || !resource.data) return json({ error: "Uploaded Room file not found." }, 404);

    let groupId: string | null = null;
    let versionNumber = 1;
    if (previousId) {
      const previous = await authorized.service
        .from("room_documents")
        .select("id,document_group_id,version_number")
        .eq("id", previousId)
        .eq("room_id", roomId)
        .maybeSingle();
      if (!previous.data) return json({ error: "Previous document version not found." }, 404);
      groupId = String(previous.data.document_group_id);
      versionNumber = Number(previous.data.version_number ?? 0) + 1;
      await authorized.service
        .from("room_documents")
        .update({ is_current: false, updated_at: new Date().toISOString() })
        .eq("document_group_id", groupId)
        .eq("room_id", roomId);
    }

    const inserted = await authorized.service
      .from("room_documents")
      .insert({
        room_id: roomId,
        resource_id: resourceId,
        ...(groupId ? { document_group_id: groupId } : {}),
        uploaded_by: authorized.userId,
        title,
        description,
        category,
        visibility,
        tags: tags(body.tags),
        version_number: versionNumber,
        is_current: true,
        is_pinned: body.isPinned === true,
        status: "published",
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) return json({ error: inserted.error?.message || "Document metadata could not be saved." }, 400);

    if (body.notifyMembers === true && visibility === "members") {
      await notifyMembers(
        authorized.service,
        roomId,
        authorized.userId,
        String(inserted.data.id),
        `${title} was published in ${authorized.access.room.name}.`
      );
    }
    return json({ id: inserted.data.id }, 201);
  }

  if (action === "set_pinned" || action === "archive") {
    if (!authorized.access.canManage && !authorized.access.isOwner) {
      return json({ error: "Room management access is required." }, 403);
    }
    const documentId = uuid(body.documentId);
    if (!documentId) return json({ error: "Invalid document id." }, 400);
    const values = action === "set_pinned"
      ? { is_pinned: body.isPinned === true, updated_at: new Date().toISOString() }
      : { status: "archived", is_current: false, is_pinned: false, updated_at: new Date().toISOString() };
    const updated = await authorized.service
      .from("room_documents")
      .update(values)
      .eq("id", documentId)
      .eq("room_id", roomId)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) return json({ error: "Document could not be updated." }, 404);
    return json({ updated: true });
  }

  if (action === "download") {
    const documentId = uuid(body.documentId);
    if (!documentId) return json({ error: "Invalid document id." }, 400);
    const found = await authorized.service
      .from("room_documents")
      .select("id,visibility,download_count")
      .eq("id", documentId)
      .eq("room_id", roomId)
      .eq("status", "published")
      .maybeSingle();
    if (!found.data || !canSee(found.data as Row, authorized.access)) return json({ error: "Document not found." }, 404);
    await authorized.service
      .from("room_documents")
      .update({ download_count: Number(found.data.download_count ?? 0) + 1 })
      .eq("id", documentId)
      .eq("room_id", roomId);
    return json({ tracked: true });
  }

  return json({ error: "Unsupported Room document action." }, 400);
}
