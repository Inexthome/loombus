import "server-only";

import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { createRoomServiceSupabase } from "@/lib/room-operations";

const BUCKETS = ["room-resources", "room-post-attachments"] as const;
const ACTIVE_STATUSES = [
  "building_manifest",
  "ready",
  "deleting_storage",
  "storage_complete",
] as const;
const PAGE_SIZE = 500;
const REMOVE_SIZE = 100;
const MAX_BATCHES_PER_JOB = 4;
const DEFAULT_MAX_JOBS = 2;
const DEFAULT_BUDGET_MS = 240_000;
const MIN_REMAINING_MS = 8_000;
const MANIFEST_LIMIT = 100_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;
type Bucket = (typeof BUCKETS)[number];

type Job = {
  id: string;
  roomId: string;
  requestedBy: string | null;
  status: string;
  snapshot: JsonRecord;
  quietUntil: string;
};

type Candidate = {
  bucketId: Bucket;
  path: string;
  source: string;
  sourceId?: string | null;
  metadata?: JsonRecord;
};

type ClaimedObject = {
  object_id: string;
  bucket_id: string;
  object_path: string;
};

type JobResult = {
  jobId: string;
  roomId: string;
  phase: string;
  completed: boolean;
  objectsDeleted: number;
  objectsFailed: number;
  message?: string;
};

export type RoomDeletionWorkerResult = {
  ok: boolean;
  enabled: boolean;
  checked: number;
  completed: number;
  objectsDeleted: number;
  objectsFailed: number;
  jobs: JobResult[];
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const record = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
const uuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);
const enabled = () =>
  process.env.ROOM_PERMANENT_DELETION_ENABLED?.trim().toLowerCase() === "true";
const hasTime = (deadline: number) => Date.now() + MIN_REMAINING_MS < deadline;
const key = (bucket: string, path: string) => `${bucket}\n${path}`;
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown Room deletion worker error.";
const chunks = <T>(values: T[], size: number) => {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
};

function isBucket(value: string): value is Bucket {
  return (BUCKETS as readonly string[]).includes(value);
}

function assertOwnedPath(job: Job, bucket: string, path: string) {
  if (!isBucket(bucket)) throw new Error("Unsupported Room Storage bucket.");
  if (path !== job.roomId && !path.startsWith(`${job.roomId}/`)) {
    throw new Error("A Storage path is outside the Room prefix.");
  }
}

function missingCompatibilityTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("room_resource_attachments") &&
      (message.includes("does not exist") || message.includes("could not find")))
  );
}

async function rpc<T>(
  service: SupabaseClient,
  name: string,
  args: JsonRecord
): Promise<T> {
  const result = await service.rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

function mapJob(row: JsonRecord): Job {
  return {
    id: text(row.id),
    roomId: text(row.room_id),
    requestedBy: uuid(row.requested_by) ? row.requested_by : null,
    status: text(row.status),
    snapshot: record(row.room_snapshot),
    quietUntil: text(row.storage_quiet_until),
  };
}

async function loadJobs(service: SupabaseClient, limit: number) {
  const result = await service
    .from("room_deletion_jobs")
    .select(
      "id,room_id,requested_by,status,room_snapshot,storage_quiet_until,created_at"
    )
    .in("status", [...ACTIVE_STATUSES])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map((row: JsonRecord) => mapJob(row));
}

async function loadJob(service: SupabaseClient, jobId: string) {
  const result = await service
    .from("room_deletion_jobs")
    .select("id,room_id,requested_by,status,room_snapshot,storage_quiet_until")
    .eq("id", jobId)
    .single();
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Room deletion job not found.");
  }
  return mapJob(result.data as JsonRecord);
}

async function manifestState(service: SupabaseClient, jobId: string) {
  const state = new Map<string, string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await service
      .from("room_deletion_objects")
      .select("bucket_id,object_path,status")
      .eq("job_id", jobId)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (result.error) throw new Error(result.error.message);
    for (const row of result.data ?? []) {
      const bucket = text(row.bucket_id);
      const path = text(row.object_path);
      if (bucket && path) state.set(key(bucket, path), text(row.status));
    }
    if (state.size > MANIFEST_LIMIT) {
      throw new Error("The Room deletion manifest exceeded its safety limit.");
    }
    if ((result.data?.length ?? 0) < PAGE_SIZE) return state;
  }
}

async function register(
  service: SupabaseClient,
  job: Job,
  candidates: Candidate[],
  state: Map<string, string>,
  deadline: number
) {
  const unique = new Map<string, Candidate>();
  for (const candidate of candidates) {
    assertOwnedPath(job, candidate.bucketId, candidate.path);
    const manifestKey = key(candidate.bucketId, candidate.path);
    const status = state.get(manifestKey);
    if (!status || status === "deleted") unique.set(manifestKey, candidate);
  }

  let count = 0;
  for (const group of chunks([...unique.values()], PAGE_SIZE)) {
    if (!hasTime(deadline)) return { complete: false, count };
    if (state.size + group.length > MANIFEST_LIMIT) {
      throw new Error("The Room deletion manifest reached its safety limit.");
    }
    await rpc(service, "register_room_deletion_objects_batch", {
      target_job_id: job.id,
      objects: group.map((candidate) => ({
        bucket_id: candidate.bucketId,
        object_path: candidate.path,
        source_kind: candidate.source,
        source_record_id: uuid(candidate.sourceId) ? candidate.sourceId : null,
        source_metadata: candidate.metadata ?? {},
      })),
    });
    for (const candidate of group) {
      state.set(key(candidate.bucketId, candidate.path), "pending");
    }
    count += group.length;
  }
  return { complete: true, count };
}

async function registerTable(args: {
  service: SupabaseClient;
  job: Job;
  table: string;
  select: string;
  optional?: boolean;
  convert: (row: JsonRecord) => Candidate | null;
  state: Map<string, string>;
  deadline: number;
}) {
  let count = 0;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    if (!hasTime(args.deadline)) return { complete: false, count };
    const result = await args.service
      .from(args.table)
      .select(args.select)
      .eq("room_id", args.job.roomId)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (result.error) {
      if (args.optional && missingCompatibilityTable(result.error)) {
        return { complete: true, count };
      }
      throw new Error(result.error.message);
    }
    const candidates = (result.data ?? [])
      .map((row: JsonRecord) => args.convert(row))
      .filter((value: Candidate | null): value is Candidate => Boolean(value));
    const page = await register(
      args.service,
      args.job,
      candidates,
      args.state,
      args.deadline
    );
    count += page.count;
    if (!page.complete) return { complete: false, count };
    if ((result.data?.length ?? 0) < PAGE_SIZE) return { complete: true, count };
  }
}

function resourceCandidate(row: JsonRecord): Candidate | null {
  const path = text(row.storage_path);
  if (!path) return null;
  return {
    bucketId: "room-resources",
    path,
    source: "room_resource",
    sourceId: text(row.id),
    metadata: {
      mediaKind: text(row.media_kind) || null,
      createdAt: text(row.created_at) || null,
    },
  };
}

function postCandidate(row: JsonRecord): Candidate | null {
  const path = text(row.storage_path);
  if (!path) return null;
  const bucket = text(row.storage_bucket) || "room-post-attachments";
  if (!isBucket(bucket)) {
    throw new Error("A Room post attachment uses an unsupported Storage bucket.");
  }
  return {
    bucketId: bucket,
    path,
    source: "room_post_attachment",
    sourceId: text(row.id),
    metadata: {
      postId: text(row.post_id) || null,
      createdAt: text(row.created_at) || null,
    },
  };
}

function compatibilityCandidate(row: JsonRecord): Candidate | null {
  const path = text(row.storage_path) || text(row.object_path) || text(row.path);
  if (!path) return null;
  const bucket =
    text(row.storage_bucket) || text(row.bucket_id) || "room-resources";
  if (!isBucket(bucket)) {
    throw new Error(
      "A compatibility Room attachment uses an unsupported Storage bucket."
    );
  }
  return {
    bucketId: bucket,
    path,
    source: "room_resource_attachment_compatibility",
    sourceId: text(row.id),
    metadata: { compatibilityRecord: true },
  };
}

async function registerMetadata(
  service: SupabaseClient,
  job: Job,
  state: Map<string, string>,
  deadline: number
) {
  const sources = [
    {
      table: "room_resources",
      select: "id,room_id,storage_path,media_kind,created_at",
      convert: resourceCandidate,
    },
    {
      table: "room_post_attachments",
      select: "id,room_id,post_id,storage_bucket,storage_path,created_at",
      convert: postCandidate,
    },
    {
      table: "room_resource_attachments",
      select: "*",
      optional: true,
      convert: compatibilityCandidate,
    },
  ];
  let count = 0;
  for (const source of sources) {
    const result = await registerTable({
      service,
      job,
      state,
      deadline,
      ...source,
    });
    count += result.count;
    if (!result.complete) return { complete: false, count };
  }
  return { complete: true, count };
}

async function registerStoredObjects(
  service: SupabaseClient,
  job: Job,
  state: Map<string, string>,
  deadline: number
) {
  let afterBucket: string | null = null;
  let afterPath: string | null = null;
  let count = 0;

  for (;;) {
    if (!hasTime(deadline)) return { complete: false, count };
    const rows = await rpc<Array<{ bucket_id: string; object_path: string }>>(
      service,
      "list_room_deletion_storage_objects",
      {
        target_room_id: job.roomId,
        after_bucket_id: afterBucket,
        after_object_path: afterPath,
        requested_limit: PAGE_SIZE,
      }
    );
    if (!rows?.length) return { complete: true, count };
    const candidates = rows.map((row) => {
      const bucket = text(row.bucket_id);
      const path = text(row.object_path);
      if (!isBucket(bucket)) throw new Error("Storage scan returned an invalid bucket.");
      return {
        bucketId: bucket,
        path,
        source: "bucket_prefix_scan",
      } satisfies Candidate;
    });
    const page = await register(service, job, candidates, state, deadline);
    count += page.count;
    if (!page.complete) return { complete: false, count };
    const last = rows.at(-1);
    afterBucket = text(last?.bucket_id);
    afterPath = text(last?.object_path);
    if (rows.length < PAGE_SIZE) return { complete: true, count };
  }
}

async function buildManifest(service: SupabaseClient, job: Job, deadline: number) {
  const state = await manifestState(service, job.id);
  const metadata = await registerMetadata(service, job, state, deadline);
  if (!metadata.complete) return metadata;
  const stored = await registerStoredObjects(service, job, state, deadline);
  if (!stored.complete) {
    return { complete: false, count: metadata.count + stored.count };
  }
  await rpc(service, "mark_room_deletion_manifest_ready", {
    target_job_id: job.id,
  });
  return { complete: true, count: metadata.count + stored.count };
}

async function refreshStorage(service: SupabaseClient, job: Job, deadline: number) {
  const state = await manifestState(service, job.id);
  return registerStoredObjects(service, job, state, deadline);
}

async function recordResults(
  service: SupabaseClient,
  jobId: string,
  results: Array<{ objectId: string; succeeded: boolean; message?: string }>
) {
  if (!results.length) return;
  await rpc(service, "record_room_deletion_object_results_batch", {
    target_job_id: jobId,
    results: results.map((result) => ({
      object_id: result.objectId,
      succeeded: result.succeeded,
      failure_message: result.message ?? null,
    })),
  });
}

async function deleteClaimed(
  service: SupabaseClient,
  job: Job,
  claimed: ClaimedObject[],
  deadline: number
) {
  const grouped = new Map<Bucket, ClaimedObject[]>();
  const results: Array<{ objectId: string; succeeded: boolean; message?: string }> = [];
  let deleted = 0;
  let failed = 0;

  for (const item of claimed) {
    try {
      assertOwnedPath(job, item.bucket_id, item.object_path);
      const bucket = item.bucket_id as Bucket;
      grouped.set(bucket, [...(grouped.get(bucket) ?? []), item]);
    } catch (error) {
      results.push({ objectId: item.object_id, succeeded: false, message: errorText(error) });
      failed += 1;
    }
  }

  for (const [bucket, objects] of grouped) {
    const batches = chunks(objects, REMOVE_SIZE);
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      if (!hasTime(deadline)) {
        for (const item of batches.slice(index).flat()) {
          results.push({
            objectId: item.object_id,
            succeeded: false,
            message: "The worker time budget ended before Storage deletion.",
          });
          failed += 1;
        }
        await recordResults(service, job.id, results);
        return { deleted, failed, complete: false };
      }

      const removed = await service.storage
        .from(bucket)
        .remove(batch.map((item) => item.object_path));
      const message = removed.error?.message;
      for (const item of batch) {
        results.push({
          objectId: item.object_id,
          succeeded: !message,
          message,
        });
        if (message) failed += 1;
        else deleted += 1;
      }
      if (message) {
        for (const item of batches.slice(index + 1).flat()) {
          results.push({
            objectId: item.object_id,
            succeeded: false,
            message: "Storage deletion was deferred after a batch failure.",
          });
          failed += 1;
        }
        await recordResults(service, job.id, results);
        return { deleted, failed, complete: true };
      }
    }
  }

  await recordResults(service, job.id, results);
  return { deleted, failed, complete: true };
}

async function deleteBatches(service: SupabaseClient, job: Job, deadline: number) {
  let deleted = 0;
  let failed = 0;
  for (let batch = 0; batch < MAX_BATCHES_PER_JOB; batch += 1) {
    if (!hasTime(deadline)) break;
    const claimed = await rpc<ClaimedObject[]>(
      service,
      "claim_room_deletion_object_batch",
      { target_job_id: job.id, requested_batch_size: PAGE_SIZE }
    );
    if (!claimed?.length) break;
    const result = await deleteClaimed(service, job, claimed, deadline);
    deleted += result.deleted;
    failed += result.failed;
    if (!result.complete || result.failed) break;
  }
  return { deleted, failed };
}

async function undeletedCount(service: SupabaseClient, jobId: string) {
  const result = await service
    .from("room_deletion_objects")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .neq("status", "deleted");
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

function ownerId(job: Job) {
  const snapshotOwner = text(job.snapshot.ownerId);
  const creator = text(job.snapshot.createdBy);
  if (uuid(job.requestedBy)) return job.requestedBy;
  if (uuid(snapshotOwner)) return snapshotOwner;
  if (uuid(creator)) return creator;
  throw new Error("The Room deletion job has no valid owner identity.");
}

export async function verifyRoomBillingInactive(
  service: SupabaseClient,
  roomId: string
) {
  const result = await service
    .from("rooms")
    .select("subscription_plan,subscription_status,stripe_subscription_id")
    .eq("id", roomId)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("Room not found for billing verification.");

  const plan = text(result.data.subscription_plan).toLowerCase() || "free";
  const localStatus = text(result.data.subscription_status).toLowerCase();
  const subscriptionId = text(result.data.stripe_subscription_id);
  const verifiedAt = new Date().toISOString();

  if (!subscriptionId) {
    if (plan !== "free") {
      throw new Error("A paid Room has no Stripe subscription identifier.");
    }
    return {
      billingActive: false,
      billingVerifiedAt: verifiedAt,
      billingSource: "free_room",
      roomPlan: plan,
      localSubscriptionStatus: localStatus || null,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
    };
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe is not configured for billing verification.");
  const subscription = await new Stripe(secret).subscriptions.retrieve(subscriptionId);
  const billingActive = !["canceled", "incomplete_expired"].includes(
    subscription.status
  );
  if (billingActive) {
    throw new Error(`Room billing remains active in Stripe (${subscription.status}).`);
  }
  return {
    billingActive: false,
    billingVerifiedAt: verifiedAt,
    billingSource: "stripe_subscription_retrieval",
    roomPlan: plan,
    localSubscriptionStatus: localStatus || null,
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: subscription.status,
  };
}

async function processJob(
  service: SupabaseClient,
  initial: Job,
  deadline: number
): Promise<JobResult> {
  let job = initial;
  let objectsDeleted = 0;
  let objectsFailed = 0;

  if (job.status === "building_manifest") {
    const built = await buildManifest(service, job, deadline);
    if (!built.complete) {
      return {
        jobId: job.id,
        roomId: job.roomId,
        phase: "building_manifest",
        completed: false,
        objectsDeleted,
        objectsFailed,
        message: "Manifest registration will continue on the next worker run.",
      };
    }
    job = await loadJob(service, job.id);
  }

  if (["ready", "deleting_storage"].includes(job.status)) {
    const deletion = await deleteBatches(service, job, deadline);
    objectsDeleted += deletion.deleted;
    objectsFailed += deletion.failed;
    if (deletion.failed || !hasTime(deadline)) {
      return {
        jobId: job.id,
        roomId: job.roomId,
        phase: "deleting_storage",
        completed: false,
        objectsDeleted,
        objectsFailed,
        message: deletion.failed
          ? "Storage deletion failures will be retried."
          : "Storage deletion will continue on the next worker run.",
      };
    }
    job = await loadJob(service, job.id);
  }

  const quietUntil = new Date(job.quietUntil).getTime();
  if (!Number.isFinite(quietUntil)) {
    throw new Error("The Storage quiet period is invalid.");
  }
  if (quietUntil > Date.now()) {
    return {
      jobId: job.id,
      roomId: job.roomId,
      phase: "waiting_for_storage_quiet_period",
      completed: false,
      objectsDeleted,
      objectsFailed,
      message: `Storage reconciliation is deferred until ${new Date(
        quietUntil
      ).toISOString()}.`,
    };
  }

  const refreshed = await refreshStorage(service, job, deadline);
  if (!refreshed.complete) {
    return {
      jobId: job.id,
      roomId: job.roomId,
      phase: "reconciling_storage",
      completed: false,
      objectsDeleted,
      objectsFailed,
      message: "Storage reconciliation will continue on the next worker run.",
    };
  }
  if (refreshed.count) {
    const deletion = await deleteBatches(service, job, deadline);
    objectsDeleted += deletion.deleted;
    objectsFailed += deletion.failed;
    if (deletion.failed || !hasTime(deadline)) {
      return {
        jobId: job.id,
        roomId: job.roomId,
        phase: "deleting_reconciled_storage",
        completed: false,
        objectsDeleted,
        objectsFailed,
        message: "Newly discovered Storage objects will continue processing.",
      };
    }
  }

  const remaining = await undeletedCount(service, job.id);
  if (remaining) {
    return {
      jobId: job.id,
      roomId: job.roomId,
      phase: "deleting_storage",
      completed: false,
      objectsDeleted,
      objectsFailed,
      message: `${remaining} manifest objects still require deletion.`,
    };
  }

  await rpc(service, "mark_room_deletion_storage_reconciled", {
    target_job_id: job.id,
  });
  const actingOwner = ownerId(job);
  const billing = await verifyRoomBillingInactive(service, job.roomId);
  await rpc(service, "refresh_room_deletion_billing_preflight", {
    target_job_id: job.id,
    acting_owner_id: actingOwner,
    billing_preflight: billing,
  });
  await rpc(service, "finalize_room_deletion_job", {
    target_job_id: job.id,
    acting_owner_id: actingOwner,
  });

  await logAuditEvent({
    actor_id: actingOwner,
    action: "room.deletion.completed",
    target_type: "room",
    target_id: job.roomId,
    metadata: { deletion_job_id: job.id, storage_objects_deleted: objectsDeleted },
  }).catch(() => undefined);

  return {
    jobId: job.id,
    roomId: job.roomId,
    phase: "completed",
    completed: true,
    objectsDeleted,
    objectsFailed,
  };
}

async function setJobError(service: SupabaseClient, jobId: string, message: string) {
  await service
    .from("room_deletion_jobs")
    .update({ last_error: message.slice(0, 4000) })
    .eq("id", jobId);
}

function expectedContinuation(message?: string) {
  return Boolean(
    message?.includes("next worker run") ||
      message?.includes("deferred until") ||
      message?.includes("still require deletion") ||
      message?.includes("will continue processing")
  );
}

export async function runRoomDeletionWorker(options?: {
  maxJobs?: number;
  runBudgetMs?: number;
}): Promise<RoomDeletionWorkerResult> {
  if (!enabled()) {
    return {
      ok: true,
      enabled: false,
      checked: 0,
      completed: 0,
      objectsDeleted: 0,
      objectsFailed: 0,
      jobs: [],
    };
  }

  const service = createRoomServiceSupabase();
  const maxJobs = Math.max(1, Math.min(options?.maxJobs ?? DEFAULT_MAX_JOBS, 10));
  const budget = Math.max(
    30_000,
    Math.min(options?.runBudgetMs ?? DEFAULT_BUDGET_MS, 280_000)
  );
  const deadline = Date.now() + budget;
  const jobs = await loadJobs(service, maxJobs);
  const results: JobResult[] = [];

  for (const job of jobs) {
    if (!hasTime(deadline)) break;
    try {
      results.push(await processJob(service, job, deadline));
    } catch (error) {
      const message = errorText(error);
      await setJobError(service, job.id, message).catch(() => undefined);
      results.push({
        jobId: job.id,
        roomId: job.roomId,
        phase: job.status,
        completed: false,
        objectsDeleted: 0,
        objectsFailed: 0,
        message,
      });
    }
  }

  return {
    ok: !results.some((result) => !result.completed && !expectedContinuation(result.message)),
    enabled: true,
    checked: results.length,
    completed: results.filter((result) => result.completed).length,
    objectsDeleted: results.reduce((total, result) => total + result.objectsDeleted, 0),
    objectsFailed: results.reduce((total, result) => total + result.objectsFailed, 0),
    jobs: results,
  };
}
