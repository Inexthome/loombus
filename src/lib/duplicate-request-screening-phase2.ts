import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";
import { normalizePublicText } from "@/lib/public-text";

type Kind = "marketplace" | "job" | "event" | "request" | "service";
type Input = Record<string, unknown>;
type Row = Record<string, any>;
type Db = any;
type Claim = { pending?: boolean; fingerprint?: string; targetId?: string | null };

const PATH_KIND: Record<string, Kind> = {
  "/api/marketplace": "marketplace",
  "/api/jobs": "job",
  "/api/events": "event",
  "/api/requests": "request",
  "/api/services": "service",
};

const TARGET: Record<Kind, { table: string; actor: string; key?: "listing" | "job" }> = {
  marketplace: { table: "marketplace_listings", actor: "seller_id", key: "listing" },
  job: { table: "job_postings", actor: "created_by", key: "job" },
  event: { table: "public_events", actor: "organizer_id" },
  request: { table: "service_requests", actor: "requester_id" },
  service: { table: "provider_services", actor: "provider_id" },
};

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function norm(value: unknown) {
  return text(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function words(value: unknown) {
  const valueText = norm(value);
  return new Set(valueText ? valueText.split(" ").filter((item) => item.length > 1) : []);
}

function score(leftValue: unknown, rightValue: unknown) {
  const left = words(leftValue);
  const right = words(rightValue);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function contentMatch(title: unknown, body: unknown, row: Row) {
  const leftTitle = norm(title);
  const leftBody = norm(body);
  const rightTitle = norm(row.title);
  const rightBody = norm(row.description ?? `${row.summary ?? ""} ${row.description ?? ""}`);
  return {
    titleExact: Boolean(leftTitle && leftTitle === rightTitle),
    bodyExact: Boolean(leftBody && leftBody === rightBody),
    titleScore: score(leftTitle, rightTitle),
    bodyScore: score(leftBody, rightBody),
  };
}

function host(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
      .hostname.toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return norm(raw);
  }
}

function email(value: unknown) {
  return text(value).toLowerCase();
}

function numberText(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : text(value);
}

function epoch(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const milliseconds = new Date(raw).getTime();
  return Number.isFinite(milliseconds) ? String(Math.floor(milliseconds / 1000)) : raw;
}

function list(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function same(left: string, right: string) {
  return Boolean(left && right && left === right);
}

function sameLocation(input: Input, row: Row) {
  const city = norm(input.city);
  const region = norm(input.region);
  const postal = norm(input.postalCode);
  const rowCity = norm(row.city);
  const rowRegion = norm(row.region);
  const rowPostal = norm(row.postal_code);
  if (!city && !region && !postal && !rowCity && !rowRegion && !rowPostal) return true;
  return same(postal, rowPostal) || (same(city, rowCity) && same(region, rowRegion));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function bearer(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function createService(): Db | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as Db;
}

async function userIdFor(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = bearer(request);
  if (!url || !key || !token) return "";
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  return error ? "" : data.user?.id ?? "";
}

async function eligible(db: Db, userId: string) {
  const { data } = await db
    .from("profiles")
    .select("is_admin, account_status, enforcement_reason, suspended_until, full_name, username, bio")
    .eq("id", userId)
    .maybeSingle();
  if (!getAccountEnforcementResult(data ?? null).allowed) return false;
  if (data?.is_admin) return true;
  return validatePublicProfileCompletion({
    fullName: data?.full_name,
    username: data?.username,
    bio: data?.bio,
  }).ok;
}

function claimParts(kind: Kind, input: Input) {
  const title = normalizePublicText(text(input.title));
  const description = normalizePublicText(text(input.description));
  if (kind === "marketplace") {
    const isFree = input.isFree === true || input.isFree === "true";
    const isDraft = input.saveAsDraft === true || input.saveAsDraft === "true";
    return {
      title,
      body: description,
      scope: [isDraft ? "draft" : "pending", text(input.businessId), text(input.category)].join("|"),
      identity: [
        input.condition ?? "good",
        numberText(isFree ? 0 : input.price),
        text(input.currency || "USD").toUpperCase(),
        isFree ? "1" : "0",
        input.city,
        input.region,
        input.postalCode,
        list(input.photoPaths).join(","),
      ].map(text).join("|"),
      bucket: today(),
    };
  }
  if (kind === "job") {
    const summary = normalizePublicText(text(input.summary));
    return {
      title,
      body: `${summary}\n${description}`,
      scope: text(input.businessId),
      identity: [
        host(input.applicationUrl),
        email(input.applicationEmail),
        input.employmentType ?? "full_time",
        input.workplaceType ?? "on_site",
        input.city,
        input.region,
        input.postalCode,
      ].map(text).join("|"),
      bucket: today(),
    };
  }
  if (kind === "event") {
    return {
      title,
      body: description,
      scope: [text(input.businessId), text(input.format || "in_person"), epoch(input.startsAt)].join("|"),
      identity: [
        input.venueName,
        input.addressLine1,
        input.addressLine2,
        input.city,
        input.region,
        input.postalCode,
        host(input.onlineUrl),
      ].map(text).join("|"),
      bucket: "1970-01-01",
    };
  }
  if (kind === "request") {
    return {
      title,
      body: description,
      scope: [
        text(input.businessId),
        text(input.requestType || "service_needed"),
        text(input.category),
        text(input.serviceMode || "flexible"),
      ].join("|"),
      identity: [input.city, input.region, input.postalCode, epoch(input.deadline)].map(text).join("|"),
      bucket: today(),
    };
  }
  const priceType = text(input.priceType || "contact");
  const minimum = priceType === "contact" ? "" : numberText(input.priceMin);
  const maximum = priceType === "contact" ? "" : priceType === "fixed" ? minimum : numberText(input.priceMax);
  return {
    title,
    body: description,
    scope: [
      text(input.businessId),
      text(input.appointmentServiceId),
      text(input.category),
      text(input.serviceMode || "flexible"),
    ].join("|"),
    identity: [
      input.city,
      input.region,
      input.postalCode,
      priceType,
      minimum,
      maximum,
      text(input.currency || "USD").toUpperCase(),
    ].map(text).join("|"),
    bucket: "1970-01-01",
  };
}

async function claimRequest(db: Db, kind: Kind, userId: string, input: Input) {
  const parts = claimParts(kind, input);
  if (!parts.title || !parts.body) return null;
  const { data, error } = await db.rpc("claim_duplicate_request", {
    request_kind: kind,
    actor_user_id: userId,
    scope_key: parts.scope,
    title_value: parts.title,
    body_value: parts.body,
    identity_value: parts.identity,
    bucket_date: parts.bucket,
    ttl_seconds: 120,
  });
  return error || !data || typeof data !== "object" ? null : (data as Claim);
}

async function release(db: Db, fingerprint?: string) {
  if (fingerprint) {
    await db.from("duplicate_request_keys").delete().eq("fingerprint", fingerprint);
  }
}

async function resolved(db: Db, kind: Kind, userId: string, claim: Claim) {
  if (!claim.targetId && !claim.fingerprint) return null;
  const config = TARGET[kind];
  let query = db
    .from(config.table)
    .select("id, slug, status")
    .eq(config.actor, userId);
  query = claim.targetId
    ? query.eq("id", claim.targetId)
    : query.eq("submission_fingerprint", claim.fingerprint);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  return config.key
    ? json({ [config.key]: data, deduplicated: true })
    : json({ ...data, deduplicated: true });
}

function pending(label: string) {
  return json(
    { error: `This ${label} submission is already being processed.`, code: "duplicate_submission_processing" },
    409,
  );
}

async function exactResult(db: Db, kind: Kind, userId: string, claim: Claim, label: string) {
  const target = await resolved(db, kind, userId, claim);
  if (target) return target;
  return claim.pending ? pending(label) : null;
}

async function marketplaceDuplicate(db: Db, userId: string, input: Input) {
  if (input.saveAsDraft === true || input.saveAsDraft === "true") return null;
  const title = normalizePublicText(text(input.title));
  const description = normalizePublicText(text(input.description));
  const category = text(input.category);
  const isFree = input.isFree === true || input.isFree === "true";
  const paths = new Set(list(input.photoPaths));
  const { data } = await db
    .from("marketplace_listings")
    .select("id, slug, title, description, category, item_condition, price, currency, is_free, city, region, postal_code, photo_paths, status")
    .eq("seller_id", userId)
    .in("status", ["draft", "pending", "published"])
    .order("updated_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).find((row) => {
    const match = contentMatch(title, description, row);
    const photoMatch = paths.size > 0 && list(row.photo_paths).some((path) => paths.has(path));
    return (
      norm(category) === norm(row.category) &&
      norm(input.condition ?? "good") === norm(row.item_condition) &&
      row.is_free === isFree &&
      Math.abs(Number(row.price ?? 0) - Number(isFree ? 0 : input.price ?? 0)) < 0.01 &&
      norm(input.currency ?? "USD") === norm(row.currency) &&
      ((match.titleExact && match.bodyExact) ||
        (match.titleExact && match.bodyScore >= 0.82 && (photoMatch || sameLocation(input, row))) ||
        (match.titleScore >= 0.92 && match.bodyScore >= 0.88 && (photoMatch || sameLocation(input, row))))
    );
  }) ?? null;
}

async function jobDuplicate(db: Db, input: Input) {
  const title = normalizePublicText(text(input.title));
  const body = `${normalizePublicText(text(input.summary))} ${normalizePublicText(text(input.description))}`;
  const { data } = await db
    .from("job_postings")
    .select("id, slug, title, summary, description, employment_type, workplace_type, city, region, postal_code, application_url, application_email, status")
    .eq("business_id", text(input.businessId))
    .in("status", ["draft", "pending", "published"])
    .order("updated_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).find((row) => {
    const match = contentMatch(title, body, { ...row, description: `${row.summary ?? ""} ${row.description ?? ""}` });
    const applicationMatch = same(host(input.applicationUrl), host(row.application_url)) || same(email(input.applicationEmail), email(row.application_email));
    return (
      applicationMatch &&
      norm(input.employmentType ?? "full_time") === norm(row.employment_type) &&
      norm(input.workplaceType ?? "on_site") === norm(row.workplace_type) &&
      sameLocation(input, row) &&
      ((match.titleExact && match.bodyScore >= 0.8) ||
        (match.titleScore >= 0.92 && match.bodyScore >= 0.86))
    );
  }) ?? null;
}

async function eventDuplicate(db: Db, userId: string, input: Input) {
  const title = normalizePublicText(text(input.title));
  const description = normalizePublicText(text(input.description));
  const startsAt = epoch(input.startsAt);
  const { data } = await db
    .from("public_events")
    .select("id, business_id, slug, title, description, event_format, venue_name, city, region, postal_code, online_url, starts_at, status")
    .eq("organizer_id", userId)
    .in("status", ["pending", "published"])
    .order("updated_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).find((row) => {
    const match = contentMatch(title, description, row);
    const venueMatch = same(norm(input.venueName), norm(row.venue_name)) || same(host(input.onlineUrl), host(row.online_url)) || sameLocation(input, row);
    return (
      startsAt === epoch(row.starts_at) &&
      norm(input.format || "in_person") === norm(row.event_format) &&
      norm(input.businessId) === norm(row.business_id) &&
      venueMatch &&
      ((match.titleExact && match.bodyScore >= 0.75) ||
        (match.titleScore >= 0.92 && match.bodyScore >= 0.84))
    );
  }) ?? null;
}

async function requestDuplicate(db: Db, userId: string, input: Input) {
  const title = normalizePublicText(text(input.title));
  const description = normalizePublicText(text(input.description));
  const deadline = epoch(input.deadline);
  const { data } = await db
    .from("service_requests")
    .select("id, business_id, slug, title, description, request_type, category, service_mode, city, region, postal_code, deadline, status")
    .eq("requester_id", userId)
    .in("status", ["draft", "pending", "open", "reviewing", "in_progress"])
    .order("updated_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).find((row) => {
    const match = contentMatch(title, description, row);
    return (
      norm(input.businessId) === norm(row.business_id) &&
      norm(input.requestType || "service_needed") === norm(row.request_type) &&
      norm(input.category) === norm(row.category) &&
      norm(input.serviceMode || "flexible") === norm(row.service_mode) &&
      sameLocation(input, row) &&
      deadline === epoch(row.deadline) &&
      ((match.titleExact && match.bodyScore >= 0.78) ||
        (match.titleScore >= 0.92 && match.bodyScore >= 0.86))
    );
  }) ?? null;
}

async function serviceDuplicate(db: Db, userId: string, input: Input) {
  const title = normalizePublicText(text(input.title));
  const description = normalizePublicText(text(input.description));
  const priceType = text(input.priceType || "contact");
  const minimum = priceType === "contact" ? "" : numberText(input.priceMin);
  const maximum = priceType === "contact" ? "" : priceType === "fixed" ? minimum : numberText(input.priceMax);
  const { data } = await db
    .from("provider_services")
    .select("id, business_id, appointment_service_id, slug, title, description, category, service_mode, city, region, postal_code, price_type, price_min, price_max, currency, status")
    .eq("provider_id", userId)
    .in("status", ["draft", "pending", "published", "paused", "rejected", "archived"])
    .order("updated_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).find((row) => {
    const match = contentMatch(title, description, row);
    return (
      norm(input.businessId) === norm(row.business_id) &&
      norm(input.appointmentServiceId) === norm(row.appointment_service_id) &&
      norm(input.category) === norm(row.category) &&
      norm(input.serviceMode || "flexible") === norm(row.service_mode) &&
      sameLocation(input, row) &&
      norm(priceType) === norm(row.price_type) &&
      minimum === numberText(row.price_min) &&
      maximum === numberText(row.price_max) &&
      norm(input.currency || "USD") === norm(row.currency) &&
      ((match.titleExact && match.bodyScore >= 0.78) ||
        (match.titleScore >= 0.92 && match.bodyScore >= 0.86))
    );
  }) ?? null;
}

async function findDuplicate(db: Db, kind: Kind, userId: string, input: Input) {
  if (kind === "marketplace") return marketplaceDuplicate(db, userId, input);
  if (kind === "job") return jobDuplicate(db, input);
  if (kind === "event") return eventDuplicate(db, userId, input);
  if (kind === "request") return requestDuplicate(db, userId, input);
  return serviceDuplicate(db, userId, input);
}

function duplicateResponse(kind: Kind, row: Row) {
  const publicStatus = kind === "request"
    ? ["open", "reviewing", "in_progress"].includes(row.status)
    : row.status === "published";
  const base = kind === "marketplace" ? "marketplace" : kind === "job" ? "jobs" : kind === "event" ? "events" : kind === "request" ? "requests" : "services";
  const href = publicStatus ? `/${base}/${row.slug}` : `/${base}/manage`;
  const noun = kind === "marketplace" ? "Marketplace listing" : kind === "job" ? "job posting" : kind === "event" ? "event" : kind === "request" ? "Request" : "Service";
  const lifecycle = kind === "marketplace"
    ? "update, reopen, or relist"
    : kind === "job"
      ? "update, close, reopen, or renew"
      : kind === "event"
        ? "update or reopen"
        : kind === "request"
          ? "update, resolve, close, or reopen"
          : "edit, activate, archive, or reopen";
  const recurrence = kind === "event" ? " A recurring event with a different date or time is still allowed." : "";
  return json(
    {
      error: `A matching ${noun} already exists: "${row.title}". Open ${href} to ${lifecycle} the existing record.${recurrence}`,
      code: `${kind}_duplicate_detected`,
      duplicates: [{ id: row.id, title: row.title, status: row.status, href }],
    },
    409,
  );
}

export async function screenPhase2DuplicateRequest(request: NextRequest) {
  const kind = PATH_KIND[request.nextUrl.pathname];
  if (request.method !== "POST" || !kind) return null;
  const db = createService();
  if (!db) return null;

  try {
    const body = await request.clone().json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const input = body as Input;
    if (text(input.action) !== "create") return null;

    const userId = await userIdFor(request);
    if (!userId || !(await eligible(db, userId))) return null;

    const claim = await claimRequest(db, kind, userId, input);
    if (!claim) return null;
    const exact = await exactResult(db, kind, userId, claim, kind === "request" ? "Request" : kind);
    if (exact) return exact;

    const duplicate = await findDuplicate(db, kind, userId, input);
    if (!duplicate) return null;
    await release(db, claim.fingerprint);
    return duplicateResponse(kind, duplicate);
  } catch (error) {
    console.error("Phase 2 duplicate request screening failed:", error);
    return null;
  }
}
