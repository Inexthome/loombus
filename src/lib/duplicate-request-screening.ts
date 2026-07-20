import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";
import { normalizePublicText } from "@/lib/public-text";

const DUPLICATE_API_PATHS = new Set([
  "/api/discussions/create",
  "/api/replies/create",
  "/api/businesses",
]);

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

type JsonRecord = Record<string, unknown>;

type ClaimResult = {
  claimed?: boolean;
  pending?: boolean;
  fingerprint?: string;
  targetId?: string | null;
  targetType?: string | null;
};

type DiscussionCandidate = {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
  topic: string | null;
  discussion_type: string | null;
  created_at: string | null;
};

type BusinessCandidate = {
  id: string;
  created_by: string;
  owner_id: string | null;
  slug: string;
  name: string;
  category: string | null;
  phone: string | null;
  contact_email: string | null;
  website_url: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  status: string | null;
};

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: unknown) {
  const normalized = normalizeText(value);
  return new Set(normalized ? normalized.split(" ").filter((token) => token.length > 1) : []);
}

function jaccard(leftValue: unknown, rightValue: unknown) {
  const left = tokens(leftValue);
  const right = tokens(rightValue);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  return digits.length >= 7 ? digits : "";
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeWebsiteHost(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return normalizeText(raw);
  }
}

function sameNonEmpty(left: string, right: string) {
  return Boolean(left && right && left === right);
}

function utcDateBucket() {
  return new Date().toISOString().slice(0, 10);
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthenticatedUserId(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = getBearerToken(request);
  if (!url || !anonKey || !token) return "";

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error) return "";
  return data.user?.id ?? "";
}

async function claimRequest(
  service: SupabaseClient,
  input: {
    kind: "discussion" | "reply" | "business";
    userId: string;
    scope: string;
    title: string;
    body: string;
    identity: string;
    bucketDate: string;
  },
) {
  const { data, error } = await service.rpc("claim_duplicate_request", {
    request_kind: input.kind,
    actor_user_id: input.userId,
    scope_key: input.scope,
    title_value: input.title,
    body_value: input.body,
    identity_value: input.identity,
    bucket_date: input.bucketDate,
    ttl_seconds: 120,
  });

  if (error || !data || typeof data !== "object") return null;
  return data as ClaimResult;
}

async function releaseClaim(service: SupabaseClient, fingerprint: string | undefined) {
  if (!fingerprint) return;
  await service.from("duplicate_request_keys").delete().eq("fingerprint", fingerprint);
}

async function resolveClaimedTarget(
  service: SupabaseClient,
  kind: "discussion" | "reply" | "business",
  userId: string,
  targetId: string,
) {
  if (kind === "discussion") {
    const { data } = await service
      .from("discussions")
      .select("*")
      .eq("id", targetId)
      .eq("user_id", userId)
      .maybeSingle();
    return data ? json({ discussion: data, deduplicated: true }) : null;
  }

  if (kind === "reply") {
    const { data } = await service
      .from("replies")
      .select("*")
      .eq("id", targetId)
      .eq("user_id", userId)
      .maybeSingle();
    return data ? json({ reply: data, deduplicated: true }) : null;
  }

  const { data } = await service
    .from("businesses")
    .select("id, slug, status")
    .eq("id", targetId)
    .eq("created_by", userId)
    .maybeSingle();
  return data ? json({ business: data, deduplicated: true }) : null;
}

async function getBlockedRelationshipIds(service: SupabaseClient, userId: string) {
  const { data } = await service
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  const hidden = new Set<string>();
  for (const row of (data ?? []) as Array<{ blocker_id: string; blocked_id: string }>) {
    hidden.add(row.blocker_id === userId ? row.blocked_id : row.blocker_id);
  }
  return hidden;
}

function discussionSimilarity(
  input: { title: string; body: string; discussionType: string },
  candidate: DiscussionCandidate,
) {
  const normalizedTitle = normalizeText(input.title);
  const normalizedBody = normalizeText(input.body);
  const candidateTitle = normalizeText(candidate.title);
  const candidateBody = normalizeText(candidate.body);
  const exactTitle = Boolean(normalizedTitle && normalizedTitle === candidateTitle);
  const exactBody = Boolean(normalizedBody && normalizedBody === candidateBody);
  const titleScore = jaccard(normalizedTitle, candidateTitle);
  const bodyScore = jaccard(normalizedBody, candidateBody);
  const typeMatch = normalizeText(input.discussionType) === normalizeText(candidate.discussion_type);
  const score = Math.min(1, titleScore * 0.55 + bodyScore * 0.4 + (typeMatch ? 0.05 : 0));
  const strong =
    (exactTitle && exactBody) ||
    (exactTitle && bodyScore >= 0.72) ||
    (exactBody && titleScore >= 0.72) ||
    (normalizedTitle.length >= 12 && normalizedBody.length >= 40 && titleScore >= 0.9 && bodyScore >= 0.82);

  return { exactTitle, exactBody, titleScore, bodyScore, score, strong };
}

async function findStrongDiscussionDuplicates(
  service: SupabaseClient,
  userId: string,
  input: { title: string; body: string; topic: string; discussionType: string },
) {
  const since = new Date(Date.now() - ONE_YEAR_MS).toISOString();
  const [{ data }, hiddenIds] = await Promise.all([
    service
      .from("discussions")
      .select("id, user_id, title, body, topic, discussion_type, created_at")
      .eq("topic", input.topic)
      .is("deleted_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
    getBlockedRelationshipIds(service, userId),
  ]);

  return ((data ?? []) as DiscussionCandidate[])
    .filter((candidate) => !hiddenIds.has(candidate.user_id))
    .map((candidate) => ({ candidate, match: discussionSimilarity(input, candidate) }))
    .filter(({ match }) => match.strong)
    .sort((left, right) => right.match.score - left.match.score)
    .slice(0, 3);
}

function businessDuplicateReason(input: JsonRecord, candidate: BusinessCandidate, userId: string) {
  const inputName = normalizeText(input.name);
  const candidateName = normalizeText(candidate.name);
  const nameExact = Boolean(inputName && inputName === candidateName);
  const nameScore = jaccard(inputName, candidateName);
  const phoneMatch = sameNonEmpty(normalizePhone(input.phone), normalizePhone(candidate.phone));
  const emailMatch = sameNonEmpty(normalizeEmail(input.contactEmail), normalizeEmail(candidate.contact_email));
  const websiteMatch = sameNonEmpty(
    normalizeWebsiteHost(input.websiteUrl),
    normalizeWebsiteHost(candidate.website_url),
  );
  const inputAddress = normalizeText(`${String(input.addressLine1 ?? "")} ${String(input.addressLine2 ?? "")}`);
  const candidateAddress = normalizeText(`${candidate.address_line_1 ?? ""} ${candidate.address_line_2 ?? ""}`);
  const addressMatch = sameNonEmpty(inputAddress, candidateAddress);
  const cityMatch = sameNonEmpty(normalizeText(input.city), normalizeText(candidate.city));
  const regionMatch = sameNonEmpty(normalizeText(input.region), normalizeText(candidate.region));
  const postalMatch = sameNonEmpty(normalizeText(input.postalCode), normalizeText(candidate.postal_code));
  const sameCreator = candidate.created_by === userId;

  if (websiteMatch && (nameExact || nameScore >= 0.55)) return "website";
  if (phoneMatch && (nameExact || nameScore >= 0.55)) return "phone";
  if (emailMatch && (nameExact || nameScore >= 0.55)) return "email";
  if (nameExact && addressMatch && (cityMatch || postalMatch)) return "address";
  if (sameCreator && nameExact && cityMatch && (regionMatch || postalMatch)) return "owned_listing";
  return "";
}

async function findBusinessDuplicate(
  service: SupabaseClient,
  userId: string,
  input: JsonRecord,
) {
  const { data } = await service
    .from("businesses")
    .select(
      "id, created_by, owner_id, slug, name, category, phone, contact_email, website_url, address_line_1, address_line_2, city, region, postal_code, country_code, status",
    )
    .in("status", ["draft", "pending", "published"])
    .order("created_at", { ascending: false })
    .limit(500);

  const matches = ((data ?? []) as BusinessCandidate[])
    .map((candidate) => ({ candidate, reason: businessDuplicateReason(input, candidate, userId) }))
    .filter(({ reason }) => Boolean(reason));

  return (
    matches.find(({ candidate }) => candidate.status === "published") ??
    matches.find(({ candidate }) => candidate.created_by === userId) ??
    matches[0] ??
    null
  );
}

async function screenDiscussion(
  service: SupabaseClient,
  userId: string,
  body: JsonRecord,
) {
  const title = normalizePublicText(String(body.title ?? "")).trim();
  const content = normalizePublicText(String(body.body ?? "")).trim();
  const topic = String(body.topic ?? "").trim();
  const discussionType = String(body.discussionType ?? body.discussion_type ?? "open_discussion").trim();
  if (!title || !content || !topic) return null;

  const claim = await claimRequest(service, {
    kind: "discussion",
    userId,
    scope: topic,
    title,
    body: content,
    identity: discussionType,
    bucketDate: utcDateBucket(),
  });
  if (!claim) return null;

  if (claim.targetId) {
    return resolveClaimedTarget(service, "discussion", userId, claim.targetId);
  }
  if (claim.pending) {
    return json(
      {
        error: "This discussion submission is already being processed.",
        code: "duplicate_submission_processing",
      },
      409,
    );
  }

  const matches = await findStrongDiscussionDuplicates(service, userId, {
    title,
    body: content,
    topic,
    discussionType,
  });
  if (matches.length === 0) return null;

  await releaseClaim(service, claim.fingerprint);
  const first = matches[0].candidate;
  const duplicatePayload = matches.map(({ candidate, match }) => ({
    id: candidate.id,
    title: candidate.title ?? "Untitled discussion",
    topic: candidate.topic,
    createdAt: candidate.created_at,
    href: `/discussions/${candidate.id}`,
    similarity: Math.round(match.score * 100),
  }));
  return json(
    {
      error: `A very similar discussion already exists: "${first.title ?? "Untitled discussion"}". Open /discussions/${first.id} or revise this draft so it adds a distinct question or purpose.`,
      code: matches.some(({ candidate, match }) => candidate.user_id === userId && match.exactTitle && match.exactBody)
        ? "exact_duplicate_discussion"
        : "similar_discussion_detected",
      duplicates: duplicatePayload,
    },
    409,
  );
}

async function screenReply(
  service: SupabaseClient,
  userId: string,
  body: JsonRecord,
) {
  const discussionId = String(body.discussionId ?? "").trim();
  const content = normalizePublicText(String(body.body ?? "")).trim();
  const referencedReplyId = String(body.referencedReplyId ?? body.referenced_reply_id ?? "").trim();
  if (!discussionId || !content) return null;

  const claim = await claimRequest(service, {
    kind: "reply",
    userId,
    scope: `${discussionId}:${referencedReplyId}`,
    title: "",
    body: content,
    identity: "",
    bucketDate: utcDateBucket(),
  });
  if (!claim) return null;

  if (claim.targetId) {
    return resolveClaimedTarget(service, "reply", userId, claim.targetId);
  }
  if (claim.pending) {
    return json(
      {
        error: "This reply submission is already being processed.",
        code: "duplicate_submission_processing",
      },
      409,
    );
  }
  return null;
}

async function canRunDuplicateScreen(service: SupabaseClient, userId: string) {
  const { data } = await service
    .from("profiles")
    .select("is_admin, account_status, enforcement_reason, suspended_until, full_name, username, bio")
    .eq("id", userId)
    .maybeSingle();

  const profile = (data ?? null) as {
    is_admin: boolean | null;
    account_status: string | null;
    enforcement_reason: string | null;
    suspended_until: string | null;
    full_name: string | null;
    username: string | null;
    bio: string | null;
  } | null;
  const enforcement = getAccountEnforcementResult(profile);
  if (!enforcement.allowed) return false;
  if (profile?.is_admin) return true;
  return validatePublicProfileCompletion({
    fullName: profile?.full_name ?? null,
    username: profile?.username ?? null,
    bio: profile?.bio ?? null,
  }).ok;
}

async function screenBusiness(
  service: SupabaseClient,
  userId: string,
  body: JsonRecord,
) {
  if (String(body.action ?? "").trim() !== "create") return null;
  const name = String(body.name ?? "").trim();
  if (!name) return null;

  const scope = String(body.countryCode ?? "US").trim().toUpperCase();
  const address = `${String(body.addressLine1 ?? "")} | ${String(body.addressLine2 ?? "")}`;
  const identity = [
    body.phone,
    body.contactEmail,
    normalizeWebsiteHost(body.websiteUrl),
    body.city,
    body.region,
    body.postalCode,
  ]
    .map((value) => String(value ?? "").trim())
    .join("|");

  const claim = await claimRequest(service, {
    kind: "business",
    userId,
    scope,
    title: name,
    body: address,
    identity,
    bucketDate: "1970-01-01",
  });
  if (!claim) return null;

  if (claim.targetId) {
    return resolveClaimedTarget(service, "business", userId, claim.targetId);
  }
  if (claim.pending) {
    return json(
      {
        error: "This business submission is already being processed.",
        code: "duplicate_submission_processing",
      },
      409,
    );
  }

  const duplicate = await findBusinessDuplicate(service, userId, body);
  if (!duplicate) return null;
  await releaseClaim(service, claim.fingerprint);

  const { candidate, reason } = duplicate;
  const isPublished = candidate.status === "published";
  const isOwnedRecord = candidate.created_by === userId;
  const message = isPublished
    ? `A matching business listing already exists: "${candidate.name}". Open /businesses/${candidate.slug} instead of creating another record.`
    : isOwnedRecord
      ? `You already have a matching business listing named "${candidate.name}". Open Business records and update the existing listing instead.`
      : "A matching business listing already exists or is under review. Search the directory or submit an ownership claim instead of creating another record.";

  return json(
    {
      error: message,
      code: "business_duplicate_detected",
      duplicates: [
        {
          id: candidate.id,
          name: candidate.name,
          status: candidate.status,
          city: candidate.city,
          region: candidate.region,
          href: isPublished ? `/businesses/${candidate.slug}` : null,
          reason,
        },
      ],
    },
    409,
  );
}

export async function screenDuplicateRequest(request: NextRequest) {
  if (request.method !== "POST" || !DUPLICATE_API_PATHS.has(request.nextUrl.pathname)) {
    return null;
  }

  const service = createServiceClient();
  if (!service) return null;

  try {
    const body = await request.clone().json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const input = body as JsonRecord;
    if (
      request.nextUrl.pathname === "/api/businesses" &&
      String(input.action ?? "").trim() !== "create"
    ) {
      return null;
    }

    const userId = await getAuthenticatedUserId(request);
    if (!userId || !(await canRunDuplicateScreen(service, userId))) return null;

    if (request.nextUrl.pathname === "/api/discussions/create") {
      return await screenDiscussion(service, userId, input);
    }
    if (request.nextUrl.pathname === "/api/replies/create") {
      return await screenReply(service, userId, input);
    }
    return await screenBusiness(service, userId, input);
  } catch (error) {
    console.error("Duplicate request screening failed:", error);
    return null;
  }
}
