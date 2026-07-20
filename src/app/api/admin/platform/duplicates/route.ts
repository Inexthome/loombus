import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

export const maxDuration = 60;

type Db = any;
type Row = Record<string, any>;
type ErrorLike = { code?: string; message?: string };

class DuplicateAdminError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "media_duplicate_admin_error",
  ) {
    super(message);
  }
}

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof DuplicateAdminError) {
    return response({ error: error.message, code: error.code }, error.status);
  }

  console.error("Media duplicate administrator request failed:", error);
  return response(
    {
      error: "Media Duplicate Review could not complete this request.",
      code: "media_duplicate_admin_failed",
    },
    500,
  );
}

function text(value: unknown, maximum = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function schemaUnavailable(error: ErrorLike | null | undefined) {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "42883" ||
        error.code === "PGRST205" ||
        /media_fingerprints|media_duplicate_signals|claim_media_fingerprint_scan|schema cache|could not find the function/i.test(
          error.message ?? "",
        )),
  );
}

function ensureQuery(error: ErrorLike | null | undefined, fallback: string) {
  if (!error) return;
  throw new DuplicateAdminError(
    schemaUnavailable(error)
      ? "The Media Duplicate Review migration has not been applied."
      : error.message || fallback,
    503,
    schemaUnavailable(error)
      ? "media_duplicate_schema_unavailable"
      : "media_duplicate_unavailable",
  );
}

async function requireAdministrator(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));

  if (!access.ok) {
    throw new DuplicateAdminError(
      access.error,
      access.status,
      access.code ?? "account_access_denied",
    );
  }

  if (access.profile.is_admin !== true) {
    throw new DuplicateAdminError(
      "Administrator access is required.",
      403,
      "administrator_required",
    );
  }

  return {
    administratorId: access.user.id,
    service: createRoomServiceSupabase() as Db,
  };
}

async function exactCount(
  query: PromiseLike<{ count: number | null; error: ErrorLike | null }>,
  fallback: string,
) {
  const result = await query;
  ensureQuery(result.error, fallback);
  return result.count ?? 0;
}

function unique(values: unknown[]) {
  return [...new Set(values.map((value) => text(value, 80)).filter(Boolean))];
}

function sourceHref(
  sourceType: string,
  sourceRecordId: string | null,
  source: Row | null,
) {
  if (!sourceRecordId || !source) return null;

  if (sourceType === "discussion_attachment") {
    return source.deleted_at ? null : `/discussions/${sourceRecordId}`;
  }

  if (sourceType === "marketplace_photo") {
    return source.status === "published" && source.slug
      ? `/marketplace/${source.slug}`
      : "/marketplace/manage";
  }

  if (sourceType === "request_attachment") {
    return source.status === "open" && source.slug
      ? `/requests/${source.slug}`
      : "/requests/manage";
  }

  if (sourceType === "service_attachment") {
    return source.status === "published" && source.slug
      ? `/services/${source.slug}`
      : "/services/manage";
  }

  return null;
}

function sourceTypeLabel(sourceType: string) {
  if (sourceType === "discussion_attachment") return "Discussion attachment";
  if (sourceType === "marketplace_photo") return "Marketplace photo";
  if (sourceType === "request_attachment") return "Request attachment";
  if (sourceType === "service_attachment") return "Service attachment";
  return "Platform media";
}

async function loadSourceMaps(service: Db, mediaRows: Row[]) {
  const discussionIds = unique(
    mediaRows
      .filter((row) => row.source_type === "discussion_attachment")
      .map((row) => row.source_record_id),
  );
  const marketplaceIds = unique(
    mediaRows
      .filter((row) => row.source_type === "marketplace_photo")
      .map((row) => row.source_record_id),
  );
  const requestIds = unique(
    mediaRows
      .filter((row) => row.source_type === "request_attachment")
      .map((row) => row.source_record_id),
  );
  const serviceIds = unique(
    mediaRows
      .filter((row) => row.source_type === "service_attachment")
      .map((row) => row.source_record_id),
  );
  const ownerIds = unique(mediaRows.map((row) => row.owner_user_id));

  const [discussions, marketplace, requests, services, profiles] =
    await Promise.all([
      discussionIds.length
        ? service
            .from("discussions")
            .select("id,title,deleted_at")
            .in("id", discussionIds)
        : Promise.resolve({ data: [], error: null }),
      marketplaceIds.length
        ? service
            .from("marketplace_listings")
            .select("id,title,slug,status")
            .in("id", marketplaceIds)
        : Promise.resolve({ data: [], error: null }),
      requestIds.length
        ? service
            .from("service_requests")
            .select("id,title,slug,status")
            .in("id", requestIds)
        : Promise.resolve({ data: [], error: null }),
      serviceIds.length
        ? service
            .from("provider_services")
            .select("id,title,slug,status")
            .in("id", serviceIds)
        : Promise.resolve({ data: [], error: null }),
      ownerIds.length
        ? service
            .from("profiles")
            .select("id,full_name,username")
            .in("id", ownerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  for (const result of [discussions, marketplace, requests, services, profiles]) {
    ensureQuery(result.error, "Media source metadata could not load.");
  }

  return {
    discussions: new Map(
      ((discussions.data ?? []) as Row[]).map((row) => [String(row.id), row]),
    ),
    marketplace: new Map(
      ((marketplace.data ?? []) as Row[]).map((row) => [String(row.id), row]),
    ),
    requests: new Map(
      ((requests.data ?? []) as Row[]).map((row) => [String(row.id), row]),
    ),
    services: new Map(
      ((services.data ?? []) as Row[]).map((row) => [String(row.id), row]),
    ),
    profiles: new Map(
      ((profiles.data ?? []) as Row[]).map((row) => [String(row.id), row]),
    ),
  };
}

function sourceRow(media: Row, maps: Awaited<ReturnType<typeof loadSourceMaps>>) {
  const sourceRecordId = media.source_record_id
    ? String(media.source_record_id)
    : null;
  let source: Row | null = null;

  if (media.source_type === "discussion_attachment" && sourceRecordId) {
    source = maps.discussions.get(sourceRecordId) ?? null;
  } else if (media.source_type === "marketplace_photo" && sourceRecordId) {
    source = maps.marketplace.get(sourceRecordId) ?? null;
  } else if (media.source_type === "request_attachment" && sourceRecordId) {
    source = maps.requests.get(sourceRecordId) ?? null;
  } else if (media.source_type === "service_attachment" && sourceRecordId) {
    source = maps.services.get(sourceRecordId) ?? null;
  }

  const profile = maps.profiles.get(String(media.owner_user_id)) ?? null;
  const ownerName =
    text(profile?.full_name, 200) ||
    text(profile?.username, 100) ||
    "Loombus member";
  const sourceTitle =
    text(source?.title, 200) ||
    (sourceRecordId
      ? `${sourceTypeLabel(String(media.source_type))} record`
      : `Unattached ${sourceTypeLabel(String(media.source_type)).toLowerCase()}`);

  return {
    mediaId: String(media.id),
    ownerUserId: String(media.owner_user_id),
    ownerName,
    sourceType: String(media.source_type),
    sourceTypeLabel: sourceTypeLabel(String(media.source_type)),
    sourceRecordId,
    title: sourceTitle,
    sourceStatus: text(source?.status, 40) || (source?.deleted_at ? "deleted" : null),
    href: sourceHref(String(media.source_type), sourceRecordId, source),
    fileName: text(media.file_name, 255) || "Stored media",
    mimeType: text(media.mime_type, 120) || "application/octet-stream",
    mediaKind: text(media.media_kind, 40) || "file",
    byteSize:
      media.byte_size === null || media.byte_size === undefined
        ? null
        : Number(media.byte_size),
    durationSeconds:
      media.duration_seconds === null || media.duration_seconds === undefined
        ? null
        : Number(media.duration_seconds),
    scannedAt: media.scanned_at ? String(media.scanned_at) : null,
    createdAt: String(media.created_at),
  };
}

async function loadHealth(service: Db) {
  const [
    pendingScans,
    scanErrors,
    readyMedia,
    openSignals,
    confirmedSignals,
    dismissedSignals,
    signalResult,
  ] = await Promise.all([
    exactCount(
      service
        .from("media_fingerprints")
        .select("id", { count: "exact", head: true })
        .in("scan_status", ["pending", "scanning"]),
      "Pending media count could not load.",
    ),
    exactCount(
      service
        .from("media_fingerprints")
        .select("id", { count: "exact", head: true })
        .eq("scan_status", "error"),
      "Media scan error count could not load.",
    ),
    exactCount(
      service
        .from("media_fingerprints")
        .select("id", { count: "exact", head: true })
        .eq("scan_status", "ready"),
      "Ready media count could not load.",
    ),
    exactCount(
      service
        .from("media_duplicate_signals")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      "Open media signal count could not load.",
    ),
    exactCount(
      service
        .from("media_duplicate_signals")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed"),
      "Confirmed media signal count could not load.",
    ),
    exactCount(
      service
        .from("media_duplicate_signals")
        .select("id", { count: "exact", head: true })
        .eq("status", "dismissed"),
      "Dismissed media signal count could not load.",
    ),
    service
      .from("media_duplicate_signals")
      .select(
        "id,left_media_id,right_media_id,signal_kind,confidence,cross_account,status,reviewed_by,reviewed_at,review_note,created_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  ensureQuery(signalResult.error, "Media duplicate signals could not load.");
  const signalRows = (signalResult.data ?? []) as Row[];
  const mediaIds = unique(
    signalRows.flatMap((row) => [row.left_media_id, row.right_media_id]),
  );
  const mediaResult = mediaIds.length
    ? await service
        .from("media_fingerprints")
        .select(
          "id,owner_user_id,source_type,source_record_id,file_name,mime_type,media_kind,byte_size,duration_seconds,scanned_at,created_at",
        )
        .in("id", mediaIds)
    : { data: [], error: null };

  ensureQuery(mediaResult.error, "Media fingerprint metadata could not load.");
  const mediaRows = (mediaResult.data ?? []) as Row[];
  const mediaMap = new Map(mediaRows.map((row) => [String(row.id), row]));
  const maps = await loadSourceMaps(service, mediaRows);

  const signals = signalRows
    .map((row) => {
      const left = mediaMap.get(String(row.left_media_id));
      const right = mediaMap.get(String(row.right_media_id));
      if (!left || !right) return null;
      return {
        id: String(row.id),
        signalKind: String(row.signal_kind),
        confidence: Number(row.confidence ?? 1),
        crossAccount: row.cross_account === true,
        status: String(row.status),
        reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
        reviewNote: text(row.review_note, 1000) || null,
        createdAt: String(row.created_at),
        left: sourceRow(left, maps),
        right: sourceRow(right, maps),
      };
    })
    .filter(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      pendingScans,
      scanErrors,
      readyMedia,
      openSignals,
      confirmedSignals,
      dismissedSignals,
    },
    signals,
    boundaries: {
      exactStoredByteComparison: true,
      automaticRemoval: false,
      automaticMerge: false,
      accountEnforcementMutation: false,
      sourceLifecycleMutation: false,
      publicContentLoaded: false,
      privateRoomMediaCataloged: false,
      rawStoragePathsExposed: false,
    },
  };
}

async function scanPendingMedia(
  service: Db,
  administratorId: string,
  requestedLimit: number,
) {
  const batchLimit = Math.min(Math.max(Math.floor(requestedLimit || 5), 1), 10);
  const claim = await service.rpc("claim_media_fingerprint_scan", {
    batch_limit: batchLimit,
  });
  ensureQuery(claim.error, "Pending media could not be claimed for scanning.");

  const rows = (claim.data ?? []) as Row[];
  let scanned = 0;
  let signalsCreated = 0;
  const failures: Array<{ mediaId: string; error: string }> = [];

  for (const row of rows) {
    const mediaId = String(row.id);
    try {
      const download = await service.storage
        .from(String(row.storage_bucket))
        .download(String(row.storage_path));

      if (download.error || !download.data) {
        throw new Error(download.error?.message || "Stored object could not be downloaded.");
      }

      const bytes = Buffer.from(await download.data.arrayBuffer());
      if (!bytes.length) throw new Error("Stored object is empty.");

      const hash = createHash("sha256").update(bytes).digest("hex");
      const completion = await service.rpc("complete_media_fingerprint_scan", {
        target_media_id: mediaId,
        target_exact_sha256: hash,
        target_byte_size: bytes.length,
        target_mime_type:
          text(download.data.type, 120) ||
          text(row.mime_type, 120) ||
          "application/octet-stream",
      });
      ensureQuery(completion.error, "Media fingerprint could not be completed.");

      scanned += 1;
      const result =
        completion.data &&
        typeof completion.data === "object" &&
        !Array.isArray(completion.data)
          ? (completion.data as Row)
          : {};
      signalsCreated += Number(result.signalsCreated ?? 0);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Media could not be scanned.";
      failures.push({ mediaId, error: message });
      await service.rpc("fail_media_fingerprint_scan", {
        target_media_id: mediaId,
        target_error: message,
      });
    }
  }

  await logAuditEvent({
    actor_id: administratorId,
    action: "admin.media_duplicate_scan_completed",
    target_type: "media_duplicate_scan",
    target_id: null,
    metadata: {
      claimed: rows.length,
      scanned,
      failed: failures.length,
      signals_created: signalsCreated,
      batch_limit: batchLimit,
    },
  });

  return {
    claimed: rows.length,
    scanned,
    failed: failures.length,
    signalsCreated,
    failures,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { service } = await requireAdministrator(request);
    return response({ isAdmin: true, ...(await loadHealth(service)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { administratorId, service } = await requireAdministrator(request);
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new DuplicateAdminError(
        "Invalid Media Duplicate Review request.",
        400,
        "invalid_payload",
      );
    }

    const input = body as Record<string, unknown>;
    const action = text(input.action, 80);

    if (action === "scan_pending") {
      const result = await scanPendingMedia(
        service,
        administratorId,
        Number(input.limit ?? 5),
      );
      return response({ updated: true, operation: result });
    }

    if (action === "review_signal") {
      const signalId = text(input.signalId, 60);
      const decision = text(input.decision, 30);
      const note = text(input.note, 1000);

      if (!validUuid(signalId)) {
        throw new DuplicateAdminError(
          "Invalid media duplicate signal id.",
          400,
          "invalid_media_duplicate_signal_id",
        );
      }
      if (!["confirmed", "dismissed"].includes(decision)) {
        throw new DuplicateAdminError(
          "Choose Confirm match or Dismiss signal.",
          400,
          "invalid_media_duplicate_decision",
        );
      }

      const existing = await service
        .from("media_duplicate_signals")
        .select("id,left_media_id,right_media_id,status")
        .eq("id", signalId)
        .maybeSingle();
      ensureQuery(existing.error, "The media duplicate signal could not be verified.");

      if (!existing.data) {
        throw new DuplicateAdminError(
          "Media duplicate signal not found.",
          404,
          "media_duplicate_signal_not_found",
        );
      }

      const update = await service
        .from("media_duplicate_signals")
        .update({
          status: decision,
          reviewed_by: administratorId,
          reviewed_at: new Date().toISOString(),
          review_note: note || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", signalId)
        .eq("status", "open")
        .select("id")
        .maybeSingle();
      ensureQuery(update.error, "The media duplicate decision could not be saved.");

      if (!update.data) {
        throw new DuplicateAdminError(
          "The signal changed before the review was saved. Refresh and try again.",
          409,
          "media_duplicate_signal_changed",
        );
      }

      await logAuditEvent({
        actor_id: administratorId,
        action:
          decision === "confirmed"
            ? "admin.media_duplicate_confirmed"
            : "admin.media_duplicate_dismissed",
        target_type: "media_duplicate_signal",
        target_id: signalId,
        metadata: {
          left_media_id: existing.data.left_media_id,
          right_media_id: existing.data.right_media_id,
          previous_status: existing.data.status,
          note_present: Boolean(note),
        },
      });

      return response({ updated: true, status: decision });
    }

    throw new DuplicateAdminError(
      "Unsupported Media Duplicate Review action.",
      400,
      "unsupported_action",
    );
  } catch (error) {
    return errorResponse(error);
  }
}
