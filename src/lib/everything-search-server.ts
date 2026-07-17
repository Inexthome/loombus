import "server-only";

import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  type EverythingSearchIntent,
  type EverythingSearchResponse,
  type EverythingSearchResult,
  type EverythingSearchType,
  getEverythingSearchGroup,
  getEverythingSearchTypeLabel,
} from "@/lib/everything-search";
import { PLATFORM_ROUTE_REGISTRY } from "@/lib/platform-route-registry";
import {
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

const MAX_QUERY_LENGTH = 280;
const MAX_RESULT_LIMIT = 80;

type SearchViewer = {
  user: User | null;
  premium: boolean;
  blockedIds: Set<string>;
};

type IndexedSearchRow = {
  document_id: string;
  entity_type: string;
  entity_id: string;
  parent_id: string | null;
  room_id: string | null;
  owner_id: string | null;
  title: string;
  snippet: string;
  href: string;
  visibility: string;
  signal_score: number | string | null;
  source_created_at: string | null;
  metadata: Record<string, unknown> | null;
  rank: number | string | null;
};

type ProfileSummary = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export class EverythingSearchError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "everything_search_error") {
    super(message);
    this.name = "EverythingSearchError";
    this.status = status;
    this.code = code;
  }
}

function cleanQuery(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

function normalizedQuery(value: string) {
  return value.toLowerCase();
}

function safePattern(value: string) {
  return `%${value.replace(/[%_]/g, "").trim()}%`;
}

function isPremiumTier(value: unknown) {
  return ["premium", "premium_plus", "admin"].includes(
    String(value ?? "").toLowerCase()
  );
}

function classifyIntent(query: string): {
  intent: EverythingSearchIntent;
  intentLabel: string;
  locationQuery: string | null;
} {
  const clean = normalizedQuery(query);
  const locationMatch = query.match(
    /\b(?:in|near|around)\s+([a-z0-9][a-z0-9 .'-]{1,60}?)(?:\?|$|,\s| for | with | that | who )/i
  );
  const locationQuery =
    locationMatch?.[1]?.trim() || (clean.includes("near me") ? "Near me" : null);

  const rules: Array<{
    intent: EverythingSearchIntent;
    label: string;
    terms: string[];
  }> = [
    {
      intent: "local_service",
      label: "Local services and community experience",
      terms: [
        "near me",
        "dentist",
        "doctor",
        "contractor",
        "roofer",
        "roofing",
        "plumber",
        "electrician",
        "mechanic",
        "lawyer",
        "service",
        "company",
        "business",
        "insurance accepted",
        "appointment",
      ],
    },
    {
      intent: "commerce",
      label: "Products, listings, and buying intent",
      terms: [
        "buy",
        "sell",
        "price",
        "product",
        "marketplace",
        "for sale",
        "shop",
        "store",
        "deal",
      ],
    },
    {
      intent: "event",
      label: "Events and scheduled activity",
      terms: [
        "event",
        "meeting",
        "calendar",
        "workshop",
        "conference",
        "class",
        "when is",
      ],
    },
    {
      intent: "person",
      label: "People and expertise",
      terms: [
        "who is",
        "expert",
        "specialist",
        "member",
        "person",
        "profile",
        "contributor",
      ],
    },
    {
      intent: "community",
      label: "Rooms and communities",
      terms: ["room", "community", "group", "hoa", "classroom", "team", "join"],
    },
    {
      intent: "media",
      label: "Videos, images, and documents",
      terms: [
        "video",
        "image",
        "photo",
        "document",
        "pdf",
        "file",
        "watch",
        "download",
      ],
    },
    {
      intent: "navigate",
      label: "Loombus navigation",
      terms: [
        "go to",
        "open",
        "settings",
        "dashboard",
        "notifications",
        "saved",
        "premium",
      ],
    },
    {
      intent: "learn",
      label: "Knowledge and discussion",
      terms: [
        "how",
        "why",
        "what",
        "learn",
        "explain",
        "research",
        "invest",
        "best",
        "should",
      ],
    },
  ];

  for (const rule of rules) {
    if (rule.terms.some((term) => clean.includes(term))) {
      return { intent: rule.intent, intentLabel: rule.label, locationQuery };
    }
  }

  return {
    intent: "general",
    intentLabel: "Everything across Loombus",
    locationQuery,
  };
}

function intentBoost(intent: EverythingSearchIntent, type: EverythingSearchType) {
  const group = getEverythingSearchGroup(type);
  if (intent === "navigate" && type === "page") return 0.55;
  if (intent === "person" && type === "person") return 0.5;
  if (
    intent === "community" &&
    (type === "room" || type === "room_discussion")
  ) {
    return 0.5;
  }
  if (
    intent === "local_service" &&
    ["service", "company", "event"].includes(type)
  ) {
    return 0.55;
  }
  if (intent === "local_service" && group === "discussions") return 0.25;
  if (intent === "event" && type === "event") return 0.55;
  if (intent === "media" && group === "media") return 0.5;
  if (
    intent === "commerce" &&
    ["product", "marketplace", "service", "company"].includes(type)
  ) {
    return 0.55;
  }
  if (
    intent === "learn" &&
    ["discussion", "reply", "knowledge"].includes(type)
  ) {
    return 0.35;
  }
  return 0;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textScore(value: string, query: string) {
  const haystack = value.toLowerCase();
  const needle = query.toLowerCase();
  if (haystack === needle) return 1;
  if (haystack.startsWith(needle)) return 0.82;
  if (haystack.includes(needle)) return 0.56;
  return 0;
}

function scorePage(
  title: string,
  description: string,
  keywords: string[],
  query: string
) {
  return Math.max(
    textScore(title, query),
    textScore(description, query) * 0.7,
    ...keywords.map((keyword) => textScore(keyword, query) * 0.85)
  );
}

function summarizeCounts(results: EverythingSearchResult[]) {
  const groups = results.reduce<Record<string, number>>((counts, result) => {
    const group = getEverythingSearchGroup(result.type);
    counts[group] = (counts[group] ?? 0) + 1;
    return counts;
  }, {});

  const labels: Record<string, string> = {
    discussions: "discussion results",
    people: "people",
    rooms: "Rooms",
    services: "services and events",
    knowledge: "knowledge items",
    media: "media and documents",
    commerce: "commerce listings",
    saved: "saved items",
    pages: "Loombus pages",
  };

  const parts = Object.entries(groups)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([group, count]) => `${count} ${labels[group] ?? group}`);

  if (parts.length === 0) {
    return "No matching Loombus signal is indexed yet. The search can still become a new discussion or future listing.";
  }

  return `Found ${parts.join(", ")}. Results are ordered by direct relevance, source signal, and recency.`;
}

async function resolveViewer(
  requestSupabase: SupabaseClient,
  serviceSupabase: SupabaseClient
): Promise<SearchViewer> {
  const {
    data: { user },
  } = await requestSupabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      premium: false,
      blockedIds: new Set<string>(),
    };
  }

  const [{ data: profile, error: profileError }, { data: entitlement }] =
    await Promise.all([
      serviceSupabase
        .from("profiles")
        .select("is_admin, account_status, enforcement_reason, suspended_until")
        .eq("id", user.id)
        .maybeSingle(),
      serviceSupabase
        .from("user_ai_entitlements")
        .select("tier, ai_assisted_enabled")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (profileError) {
    throw new EverythingSearchError(
      "Unable to verify search access.",
      503,
      "search_access_unavailable"
    );
  }

  const enforcement = getAccountEnforcementResult(profile ?? null);
  if (!enforcement.allowed) {
    throw new EverythingSearchError(
      enforcement.errorMessage ?? "Account access is restricted.",
      403,
      enforcement.code ?? "account_restricted"
    );
  }

  const isAdmin = Boolean(profile?.is_admin) || entitlement?.tier === "admin";
  const premium =
    isAdmin ||
    (entitlement?.ai_assisted_enabled === true &&
      isPremiumTier(entitlement?.tier));

  const { data: blockRows } = await serviceSupabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

  const blockedIds = new Set<string>();
  for (const row of blockRows ?? []) {
    const blockerId = asString(row.blocker_id);
    const blockedId = asString(row.blocked_id);
    blockedIds.add(blockerId === user.id ? blockedId : blockerId);
  }

  return { user, premium, blockedIds };
}

function normalizeVisibility(
  value: unknown
): EverythingSearchResult["visibility"] {
  const visibility = String(value ?? "public");
  if (
    ["public", "authenticated", "premium", "member", "private"].includes(
      visibility
    )
  ) {
    return visibility as EverythingSearchResult["visibility"];
  }
  return "public";
}

function normalizeType(value: unknown): EverythingSearchType {
  const type = String(value ?? "discussion");
  return type as EverythingSearchType;
}

async function hydrateIndexedResults(
  serviceSupabase: SupabaseClient,
  rows: IndexedSearchRow[],
  viewer: SearchViewer,
  intent: EverythingSearchIntent
) {
  const ownerIds = [
    ...new Set(rows.map((row) => asString(row.owner_id)).filter(Boolean)),
  ].filter((id) => !viewer.blockedIds.has(id));
  const roomIds = [
    ...new Set(rows.map((row) => asString(row.room_id)).filter(Boolean)),
  ];

  const [profileResult, roomResult] = await Promise.all([
    ownerIds.length > 0
      ? serviceSupabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", ownerIds)
      : Promise.resolve({ data: [], error: null }),
    roomIds.length > 0
      ? serviceSupabase.from("rooms").select("id, name").in("id", roomIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profiles = new Map<string, ProfileSummary>();
  for (const profile of (profileResult.data ?? []) as ProfileSummary[]) {
    profiles.set(profile.id, profile);
  }

  const roomNames = new Map<string, string>();
  for (const room of roomResult.data ?? []) {
    roomNames.set(asString(room.id), asString(room.name));
  }

  return rows
    .filter((row) => !row.owner_id || !viewer.blockedIds.has(row.owner_id))
    .map<EverythingSearchResult>((row) => {
      const type = normalizeType(row.entity_type);
      const owner = row.owner_id ? profiles.get(row.owner_id) : null;
      const baseRank = numeric(row.rank);
      const score = baseRank + intentBoost(intent, type);

      return {
        id: row.document_id || `${type}:${row.entity_id}`,
        type,
        title: row.title || getEverythingSearchTypeLabel(type),
        snippet: row.snippet || "",
        href: row.href || "/search",
        sourceLabel: getEverythingSearchTypeLabel(type),
        createdAt: row.source_created_at,
        score,
        ownerId: row.owner_id,
        ownerName:
          owner?.full_name?.trim() || owner?.username?.trim() || null,
        ownerUsername: owner?.username ?? null,
        ownerAvatarUrl: owner?.avatar_url ?? null,
        roomId: row.room_id,
        roomName: row.room_id ? roomNames.get(row.room_id) ?? null : null,
        visibility: normalizeVisibility(row.visibility),
        metadata: row.metadata ?? {},
      };
    });
}

async function searchIndexedDocuments({
  serviceSupabase,
  query,
  viewer,
  limit,
  intent,
}: {
  serviceSupabase: SupabaseClient;
  query: string;
  viewer: SearchViewer;
  limit: number;
  intent: EverythingSearchIntent;
}) {
  const { data, error } = await serviceSupabase.rpc("search_loombus_documents", {
    search_text: query,
    viewer_user_id: viewer.user?.id ?? null,
    viewer_has_premium: viewer.premium,
    result_limit: limit,
  });

  if (error) {
    const missing =
      error.code === "42883" ||
      /search_loombus_documents|schema cache|could not find the function/i.test(
        error.message ?? ""
      );
    if (missing) return null;
    throw new EverythingSearchError(
      "Everything Search could not query the Loombus index.",
      503,
      "search_index_unavailable"
    );
  }

  return hydrateIndexedResults(
    serviceSupabase,
    (data ?? []) as IndexedSearchRow[],
    viewer,
    intent
  );
}

async function legacyFallbackSearch({
  serviceSupabase,
  query,
  viewer,
  limit,
  intent,
}: {
  serviceSupabase: SupabaseClient;
  query: string;
  viewer: SearchViewer;
  limit: number;
  intent: EverythingSearchIntent;
}) {
  const pattern = safePattern(query);
  const discussionSelect =
    "id, title, topic, body, created_at, user_id, reality_lens, purpose_lane";
  const discussionQueries = [
    serviceSupabase
      .from("discussions")
      .select(discussionSelect)
      .is("deleted_at", null)
      .ilike("title", pattern)
      .limit(limit),
    serviceSupabase
      .from("discussions")
      .select(discussionSelect)
      .is("deleted_at", null)
      .ilike("topic", pattern)
      .limit(limit),
    serviceSupabase
      .from("discussions")
      .select(discussionSelect)
      .is("deleted_at", null)
      .ilike("body", pattern)
      .limit(limit),
  ];

  const [discussionResponses, profileResponses] = await Promise.all([
    Promise.all(discussionQueries),
    viewer.user
      ? Promise.all([
          serviceSupabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, bio")
            .ilike("username", pattern)
            .limit(12),
          serviceSupabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, bio")
            .ilike("full_name", pattern)
            .limit(12),
          serviceSupabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, bio")
            .ilike("bio", pattern)
            .limit(12),
        ])
      : Promise.resolve([]),
  ]);

  const resultMap = new Map<string, EverythingSearchResult>();

  for (const response of discussionResponses) {
    for (const discussion of response.data ?? []) {
      const ownerId = asString(discussion.user_id);
      if (viewer.blockedIds.has(ownerId)) continue;
      const id = asString(discussion.id);
      const score =
        Math.max(
          textScore(asString(discussion.title), query),
          textScore(asString(discussion.topic), query) * 0.85,
          textScore(asString(discussion.body), query) * 0.55
        ) + intentBoost(intent, "discussion");
      resultMap.set(`discussion:${id}`, {
        id: `discussion:${id}`,
        type: "discussion",
        title: asString(discussion.title) || "Discussion",
        snippet: [discussion.topic, discussion.purpose_lane, discussion.body]
          .map(asString)
          .filter(Boolean)
          .join(" · ")
          .slice(0, 500),
        href: `/discussions/${encodeURIComponent(id)}`,
        sourceLabel: "Discussion",
        createdAt: asString(discussion.created_at) || null,
        score,
        ownerId,
        ownerName: null,
        ownerUsername: null,
        ownerAvatarUrl: null,
        roomId: null,
        roomName: null,
        visibility: "public",
        metadata: {
          topic: asString(discussion.topic),
          purposeLane: asString(discussion.purpose_lane),
          realityLens: asString(discussion.reality_lens),
        },
      });
    }
  }

  for (const response of profileResponses) {
    for (const profile of response.data ?? []) {
      const id = asString(profile.id);
      if (!id || viewer.blockedIds.has(id)) continue;
      const username = asString(profile.username);
      const name = asString(profile.full_name) || username || "Loombus member";
      resultMap.set(`person:${id}`, {
        id: `person:${id}`,
        type: "person",
        title: name,
        snippet: [username ? `@${username}` : "", asString(profile.bio)]
          .filter(Boolean)
          .join(" · "),
        href: username ? `/u/${encodeURIComponent(username)}` : "/people",
        sourceLabel: "Person",
        createdAt: null,
        score:
          Math.max(
            textScore(name, query),
            textScore(username, query),
            textScore(asString(profile.bio), query) * 0.6
          ) + intentBoost(intent, "person"),
        ownerId: id,
        ownerName: name,
        ownerUsername: username || null,
        ownerAvatarUrl: asString(profile.avatar_url) || null,
        roomId: null,
        roomName: null,
        visibility: "authenticated",
        metadata: {},
      });
    }
  }

  return [...resultMap.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

async function searchSavedItems({
  serviceSupabase,
  query,
  viewer,
}: {
  serviceSupabase: SupabaseClient;
  query: string;
  viewer: SearchViewer;
}) {
  if (!viewer.user) return [];

  const { data, error } = await serviceSupabase
    .from("bookmarks")
    .select(`
      id,
      created_at,
      private_note,
      discussion_id,
      discussions (
        id,
        title,
        topic,
        body,
        created_at,
        user_id,
        deleted_at
      )
    `)
    .eq("user_id", viewer.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return [];

  const clean = normalizedQuery(query);
  const savedResults: EverythingSearchResult[] = [];

  for (const row of data ?? []) {
    const joined = Array.isArray(row.discussions)
      ? row.discussions[0] ?? null
      : row.discussions;
    if (!joined || joined.deleted_at) continue;

    const searchable = [
      joined.title,
      joined.topic,
      joined.body,
      row.private_note,
    ]
      .map(asString)
      .join(" ")
      .toLowerCase();
    if (!searchable.includes(clean)) continue;

    const id = asString(row.id);
    savedResults.push({
      id: `saved:${id}`,
      type: "saved",
      title: asString(joined.title) || "Saved discussion",
      snippet: [
        asString(joined.topic),
        row.private_note ? `Private note: ${asString(row.private_note)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/discussions/${encodeURIComponent(asString(joined.id))}`,
      sourceLabel: "Saved",
      createdAt: asString(row.created_at) || null,
      score:
        Math.max(
          textScore(asString(joined.title), query),
          textScore(asString(joined.topic), query) * 0.8,
          textScore(asString(row.private_note), query) * 0.75,
          textScore(asString(joined.body), query) * 0.45
        ) + 0.12,
      ownerId: viewer.user?.id ?? null,
      ownerName: "You",
      ownerUsername: null,
      ownerAvatarUrl: null,
      roomId: null,
      roomName: null,
      visibility: "private",
      metadata: {},
    });
  }

  return savedResults.slice(0, 12);
}

function searchPlatformPages(query: string, intent: EverythingSearchIntent) {
  const pageResults: EverythingSearchResult[] = [];

  for (const page of PLATFORM_ROUTE_REGISTRY) {
    const score = scorePage(page.title, page.description, page.keywords, query);
    if (score <= 0) continue;

    pageResults.push({
      id: `page:${page.href}`,
      type: "page",
      title: page.title,
      snippet: page.description,
      href: page.href,
      sourceLabel: "Loombus page",
      createdAt: null,
      score: score + intentBoost(intent, "page"),
      ownerId: null,
      ownerName: null,
      ownerUsername: null,
      ownerAvatarUrl: null,
      roomId: null,
      roomName: null,
      visibility: "public",
      metadata: { category: page.category },
    });
  }

  return pageResults
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);
}

export async function runEverythingSearch({
  request,
  query: rawQuery,
  limit: rawLimit = 60,
}: {
  request: NextRequest;
  query: unknown;
  limit?: number;
}): Promise<EverythingSearchResponse> {
  const query = cleanQuery(rawQuery);
  if (query.length < 2) {
    throw new EverythingSearchError(
      "Enter at least two characters.",
      400,
      "search_query_too_short"
    );
  }

  const limit = Math.min(Math.max(Number(rawLimit) || 60, 1), MAX_RESULT_LIMIT);
  const requestSupabase = createRequestSupabase(request);
  const serviceSupabase = createRoomServiceSupabase();
  const viewer = await resolveViewer(requestSupabase, serviceSupabase);
  const { intent, intentLabel, locationQuery } = classifyIntent(query);

  const indexedResults = await searchIndexedDocuments({
    serviceSupabase,
    query,
    viewer,
    limit,
    intent,
  });
  const indexed = indexedResults !== null;
  const contentResults =
    indexedResults ??
    (await legacyFallbackSearch({
      serviceSupabase,
      query,
      viewer,
      limit,
      intent,
    }));

  const [savedResults, pageResults] = await Promise.all([
    searchSavedItems({ serviceSupabase, query, viewer }),
    Promise.resolve(searchPlatformPages(query, intent)),
  ]);

  const deduped = new Map<string, EverythingSearchResult>();
  for (const result of [...contentResults, ...savedResults, ...pageResults]) {
    const key = `${result.type}:${result.href}:${result.title}`;
    const current = deduped.get(key);
    if (!current || result.score > current.score) deduped.set(key, result);
  }

  const results = [...deduped.values()]
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, limit);

  const counts = results.reduce<Record<string, number>>((next, result) => {
    next[result.type] = (next[result.type] ?? 0) + 1;
    const group = getEverythingSearchGroup(result.type);
    if (group !== result.type) {
      next[group] = (next[group] ?? 0) + 1;
    }
    return next;
  }, { all: results.length });

  return {
    query,
    intent,
    intentLabel,
    locationQuery,
    brief: summarizeCounts(results),
    results,
    counts,
    authenticated: Boolean(viewer.user),
    premium: viewer.premium,
    indexed,
  };
}
