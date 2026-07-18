import "server-only";

import type { NextRequest } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  DEFAULT_MATCHING_PREFERENCES,
  matchingConfidenceLabel,
  type IntelligentMatch,
  type IntelligentMatchingResponse,
  type MatchDirection,
  type MatchFactorScores,
  type MatchFeedbackType,
  type MatchingEntityType,
  type MatchingPreferences,
  type MatchingRule,
} from "@/lib/intelligent-matching";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

type Row = Record<string, any>;
type Service = ReturnType<typeof createRoomServiceSupabase>;
type MatchingInput = Record<string, unknown>;
type LocationRow = {
  source_table: string;
  entity_id: string;
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
};
type PairDescriptor = {
  key: string;
  direction: MatchDirection;
  sourceType: MatchingEntityType;
  source: Row;
  targetType: MatchingEntityType;
  target: Row;
  confidence: number;
  explanation: string[];
  factors: MatchFactorScores;
  expiresAt: string | null;
  actedOn: boolean;
};

const REQUEST_SELECT = [
  "id",
  "requester_id",
  "business_id",
  "slug",
  "title",
  "description",
  "category",
  "urgency",
  "service_mode",
  "city",
  "region",
  "postal_code",
  "country_code",
  "budget_min",
  "budget_max",
  "currency",
  "budget_type",
  "deadline",
  "preferred_start",
  "preferred_end",
  "tags",
  "status",
  "selected_response_id",
  "published_at",
  "updated_at",
].join(", ");

const SERVICE_SELECT = [
  "id",
  "provider_id",
  "business_id",
  "slug",
  "title",
  "description",
  "category",
  "specialties",
  "service_mode",
  "city",
  "region",
  "postal_code",
  "country_code",
  "price_type",
  "price_min",
  "price_max",
  "currency",
  "typical_duration_minutes",
  "availability_text",
  "status",
  "published_at",
  "updated_at",
].join(", ");

const STOP_WORDS = new Set([
  "and",
  "are",
  "for",
  "from",
  "have",
  "help",
  "into",
  "need",
  "that",
  "the",
  "this",
  "with",
  "your",
  "service",
  "services",
  "request",
]);

export class IntelligentMatchingError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "intelligent_matching_error",
  ) {
    super(message);
  }
}

function text(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringArray(value: unknown, maxItems = 24, maxLength = 120) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => text(item, maxLength))
        .filter(Boolean)
        .slice(0, maxItems),
    ),
  ];
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), minimum), maximum);
}

function uuid(value: unknown, label: string) {
  const result = text(value, 60);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) {
    throw new IntelligentMatchingError(
      `Invalid ${label}.`,
      400,
      `invalid_${label.replaceAll(" ", "_")}`,
    );
  }
  return result;
}

function preferenceRow(row: Row | null): MatchingPreferences {
  if (!row) return { ...DEFAULT_MATCHING_PREFERENCES };
  const activeSections = stringArray(row.active_sections, 2, 20).filter(
    (section): section is "requests" | "services" =>
      section === "requests" || section === "services",
  );
  const frequency = text(row.notification_frequency, 20);
  return {
    activeSections: activeSections.length
      ? activeSections
      : [...DEFAULT_MATCHING_PREFERENCES.activeSections],
    categories: stringArray(row.categories, 24, 120),
    radiusMiles: integer(row.radius_miles, 25, 1, 250),
    includeRemote: row.include_remote !== false,
    minimumRelevance: integer(row.minimum_relevance, 55, 0, 100),
    notificationFrequency:
      frequency === "none" || frequency === "daily" || frequency === "weekly"
        ? frequency
        : "weekly",
    matchingPaused: row.matching_paused === true,
  };
}

function ruleRow(row: Row): MatchingRule {
  return {
    id: String(row.id),
    name: text(row.name, 80),
    sourceType: row.source_type === "service" ? "service" : "request",
    targetType: row.target_type === "request" ? "request" : "service",
    categories: stringArray(row.categories, 24, 120),
    radiusMiles: integer(row.radius_miles, 25, 1, 250),
    includeRemote: row.include_remote !== false,
    minimumRelevance: integer(row.minimum_relevance, 55, 0, 100),
    isActive: row.is_active !== false,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function requireMatchingAccount(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!access.ok) {
    throw new IntelligentMatchingError(
      access.error,
      access.status,
      access.code ?? "account_access_denied",
    );
  }
  const service = createRoomServiceSupabase();
  const { data: sensitive, error } = await service
    .from("profile_sensitive")
    .select("age_band, guardian_required")
    .eq("id", access.user.id)
    .maybeSingle();
  const ageBand = String(sensitive?.age_band ?? "unknown");
  if (ageBand === "under_13" || sensitive?.guardian_required === true) {
    throw new IntelligentMatchingError(
      "Loombus is not available to children under 13.",
      403,
      "under_13_not_allowed",
    );
  }
  if (error || ageBand === "unknown") {
    throw new IntelligentMatchingError(
      "Complete age safety before using Intelligent Matching.",
      403,
      "age_gate_required",
    );
  }
  return { access, service };
}

async function loadPreferences(service: Service, userId: string) {
  const { data, error } = await service
    .from("matching_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (/matching_preferences|schema cache|does not exist/i.test(error.message ?? "")) {
      throw new IntelligentMatchingError(
        "The Intelligent Matching migration has not been applied.",
        503,
        "matching_schema_unavailable",
      );
    }
    throw new IntelligentMatchingError(
      "Unable to load matching preferences.",
      503,
      "matching_preferences_unavailable",
    );
  }
  if (data) return preferenceRow(data as Row);
  const defaults = DEFAULT_MATCHING_PREFERENCES;
  const { data: created, error: createError } = await service
    .from("matching_preferences")
    .insert({
      user_id: userId,
      active_sections: defaults.activeSections,
      categories: defaults.categories,
      radius_miles: defaults.radiusMiles,
      include_remote: defaults.includeRemote,
      minimum_relevance: defaults.minimumRelevance,
      notification_frequency: defaults.notificationFrequency,
      matching_paused: defaults.matchingPaused,
    })
    .select("*")
    .single();
  if (createError) {
    throw new IntelligentMatchingError(
      "Unable to initialize matching preferences.",
      503,
      "matching_preferences_unavailable",
    );
  }
  return preferenceRow(created as Row);
}

async function loadRules(service: Service, userId: string) {
  const { data, error } = await service
    .from("matching_rules")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    throw new IntelligentMatchingError(
      "Unable to load saved matching rules.",
      503,
      "matching_rules_unavailable",
    );
  }
  return ((data ?? []) as Row[]).map(ruleRow);
}

function tokens(...values: unknown[]) {
  const result = new Set<string>();
  for (const value of values) {
    const parts = Array.isArray(value) ? value : [value];
    for (const part of parts) {
      const normalized = text(part, 20_000)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, " ")
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
      for (const word of normalized) result.add(word);
    }
  }
  return result;
}

function overlapTerms(requestRow: Row, serviceRow: Row) {
  const requestTerms = tokens(
    requestRow.tags,
    requestRow.title,
    requestRow.description,
  );
  const serviceTerms = tokens(
    serviceRow.specialties,
    serviceRow.title,
    serviceRow.description,
  );
  return [...requestTerms].filter((term) => serviceTerms.has(term)).slice(0, 8);
}

function modeCompatibility(
  requestMode: string,
  serviceMode: string,
  includeRemote: boolean,
) {
  const requestRemote = requestMode === "remote";
  const serviceRemote = serviceMode === "remote";
  if (requestRemote || serviceRemote) {
    const compatible =
      includeRemote &&
      (requestRemote || requestMode === "flexible") &&
      (serviceRemote || serviceMode === "flexible");
    return { eligible: compatible, score: compatible ? 15 : 0, remote: compatible };
  }
  if (requestMode === serviceMode) {
    return { eligible: true, score: 15, remote: false };
  }
  if (requestMode === "flexible" || serviceMode === "flexible") {
    return { eligible: true, score: 12, remote: false };
  }
  return { eligible: false, score: 0, remote: false };
}

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMiles(first: LocationRow, second: LocationRow) {
  const earthRadius = 3958.7613;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function sameText(first: unknown, second: unknown) {
  const left = text(first, 120).toLowerCase();
  const right = text(second, 120).toLowerCase();
  return Boolean(left && right && left === right);
}

function locationCompatibility(
  requestRow: Row,
  serviceRow: Row,
  requestLocation: LocationRow | null,
  serviceLocation: LocationRow | null,
  radiusMiles: number,
  remote: boolean,
) {
  if (remote) {
    return { eligible: true, score: 15, distance: null, label: "Remote-compatible" };
  }
  if (requestLocation && serviceLocation) {
    const distance = distanceMiles(requestLocation, serviceLocation);
    if (distance > radiusMiles) {
      return { eligible: false, score: 0, distance, label: "Outside your radius" };
    }
    const score = distance <= 5 ? 15 : distance <= 25 ? 12 : 8;
    return {
      eligible: true,
      score,
      distance,
      label: `${distance.toFixed(1)} miles apart`,
    };
  }
  const requestPostal = requestLocation?.postal_code ?? requestRow.postal_code;
  const servicePostal = serviceLocation?.postal_code ?? serviceRow.postal_code;
  const requestCity = requestLocation?.city ?? requestRow.city;
  const serviceCity = serviceLocation?.city ?? serviceRow.city;
  const requestRegion = requestLocation?.region ?? requestRow.region;
  const serviceRegion = serviceLocation?.region ?? serviceRow.region;
  const requestCountry = requestLocation?.country_code ?? requestRow.country_code;
  const serviceCountry = serviceLocation?.country_code ?? serviceRow.country_code;
  if (sameText(requestPostal, servicePostal)) {
    return { eligible: true, score: 13, distance: null, label: "Same postal area" };
  }
  if (sameText(requestCity, serviceCity) && sameText(requestRegion, serviceRegion)) {
    return { eligible: true, score: 11, distance: null, label: "Same local area" };
  }
  if (sameText(requestRegion, serviceRegion) && sameText(requestCountry, serviceCountry)) {
    return { eligible: true, score: 6, distance: null, label: "Same region" };
  }
  const bothHaveRegion = Boolean(text(requestRegion) && text(serviceRegion));
  const countriesConflict =
    Boolean(text(requestCountry) && text(serviceCountry)) &&
    !sameText(requestCountry, serviceCountry);
  if (countriesConflict || bothHaveRegion) {
    return { eligible: false, score: 0, distance: null, label: "Different service area" };
  }
  return { eligible: true, score: 3, distance: null, label: "Location needs confirmation" };
}

function numeric(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function budgetCompatibility(requestRow: Row, serviceRow: Row) {
  const requestMin = numeric(requestRow.budget_min);
  const requestMax = numeric(requestRow.budget_max);
  const serviceMin = numeric(serviceRow.price_min);
  const serviceMax = numeric(serviceRow.price_max);
  if (
    requestRow.budget_type === "flexible" ||
    serviceRow.price_type === "contact" ||
    (requestMin === null && requestMax === null) ||
    (serviceMin === null && serviceMax === null)
  ) {
    return { score: 8, label: "Pricing can be discussed" };
  }
  if (text(requestRow.currency, 3) !== text(serviceRow.currency, 3)) {
    return { score: 0, label: "Different currencies" };
  }
  const requestLow = requestMin ?? 0;
  const requestHigh = requestMax ?? Number.POSITIVE_INFINITY;
  const serviceLow = serviceMin ?? 0;
  const serviceHigh = serviceMax ?? Number.POSITIVE_INFINITY;
  if (requestHigh >= serviceLow && serviceHigh >= requestLow) {
    return { score: 15, label: "Budget and price overlap" };
  }
  if (
    Number.isFinite(requestHigh) &&
    Number.isFinite(serviceLow) &&
    serviceLow <= requestHigh * 1.2
  ) {
    return { score: 8, label: "Pricing is close to the stated budget" };
  }
  return { score: 0, label: "Pricing may need adjustment" };
}

function timingScore(requestRow: Row, serviceRow: Row) {
  let score = 2;
  if (requestRow.urgency === "urgent") score = 4;
  else if (requestRow.urgency === "soon") score = 3;
  if (text(serviceRow.availability_text, 500)) score += 1;
  return Math.min(score, 5);
}

function expirationFor(requestRow: Row) {
  const deadline = text(requestRow.deadline, 100);
  if (deadline) return deadline;
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 30);
  return expiration.toISOString();
}

function candidateKey(
  sourceType: MatchingEntityType,
  sourceId: string,
  targetType: MatchingEntityType,
  targetId: string,
) {
  return `${sourceType}:${sourceId}:${targetType}:${targetId}`;
}

function effectivePolicy(
  direction: MatchDirection,
  category: string,
  preferences: MatchingPreferences,
  rules: MatchingRule[],
) {
  const sourceType: MatchingEntityType =
    direction === "request_to_service" ? "request" : "service";
  const targetType: MatchingEntityType =
    direction === "request_to_service" ? "service" : "request";
  const matchingRules = rules.filter(
    (rule) =>
      rule.isActive &&
      rule.sourceType === sourceType &&
      rule.targetType === targetType &&
      (!rule.categories.length || rule.categories.includes(category)),
  );
  const categoryAllowed =
    !preferences.categories.length ||
    preferences.categories.includes(category) ||
    matchingRules.some((rule) => rule.categories.includes(category));
  return {
    categoryAllowed,
    radiusMiles: Math.max(
      preferences.radiusMiles,
      ...matchingRules.map((rule) => rule.radiusMiles),
    ),
    includeRemote:
      preferences.includeRemote || matchingRules.some((rule) => rule.includeRemote),
    minimumRelevance: Math.min(
      preferences.minimumRelevance,
      ...matchingRules.map((rule) => rule.minimumRelevance),
    ),
    matchedRules: matchingRules.map((rule) => rule.name),
  };
}

function scorePair(
  direction: MatchDirection,
  requestRow: Row,
  serviceRow: Row,
  requestLocation: LocationRow | null,
  serviceLocation: LocationRow | null,
  preferences: MatchingPreferences,
  rules: MatchingRule[],
  actedOn: boolean,
): PairDescriptor | null {
  const category = text(requestRow.category, 120);
  if (!category || category !== text(serviceRow.category, 120)) return null;
  const policy = effectivePolicy(direction, category, preferences, rules);
  if (!policy.categoryAllowed) return null;
  const mode = modeCompatibility(
    text(requestRow.service_mode, 40),
    text(serviceRow.service_mode, 40),
    policy.includeRemote,
  );
  if (!mode.eligible) return null;
  const location = locationCompatibility(
    requestRow,
    serviceRow,
    requestLocation,
    serviceLocation,
    policy.radiusMiles,
    mode.remote,
  );
  if (!location.eligible) return null;
  const overlappingTerms = overlapTerms(requestRow, serviceRow);
  const specialtyScore = Math.min(
    20,
    overlappingTerms.length ? 8 + (overlappingTerms.length - 1) * 4 : 0,
  );
  const budget = budgetCompatibility(requestRow, serviceRow);
  const timing = timingScore(requestRow, serviceRow);
  const confidence = Math.min(
    100,
    30 + specialtyScore + mode.score + location.score + budget.score + timing,
  );
  if (confidence < policy.minimumRelevance) return null;
  const explanation = [
    `Same ${category} category`,
    overlappingTerms.length
      ? `Shared terms: ${overlappingTerms.slice(0, 4).join(", ")}`
      : "Category compatibility is the primary signal",
    location.label,
    budget.label,
  ];
  if (policy.matchedRules.length) {
    explanation.push(`Saved rule: ${policy.matchedRules.join(", ")}`);
  }
  const sourceType: MatchingEntityType =
    direction === "request_to_service" ? "request" : "service";
  const targetType: MatchingEntityType =
    direction === "request_to_service" ? "service" : "request";
  const source = direction === "request_to_service" ? requestRow : serviceRow;
  const target = direction === "request_to_service" ? serviceRow : requestRow;
  return {
    key: candidateKey(sourceType, String(source.id), targetType, String(target.id)),
    direction,
    sourceType,
    source,
    targetType,
    target,
    confidence,
    explanation,
    factors: {
      category: 30,
      specialty: specialtyScore,
      serviceMode: mode.score,
      location: location.score,
      budget: budget.score,
      timing,
      distanceMiles:
        location.distance === null ? null : Math.round(location.distance * 10) / 10,
      remoteCompatible: mode.remote,
      overlappingTerms,
      matchedRules: policy.matchedRules,
    },
    expiresAt: expirationFor(requestRow),
    actedOn,
  };
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function requestBudgetLabel(row: Row) {
  const minimum = numeric(row.budget_min);
  const maximum = numeric(row.budget_max);
  if (minimum === null && maximum === null) return "Budget not stated";
  const suffix = row.budget_type === "hourly" ? " per hour" : "";
  if (minimum !== null && maximum !== null) {
    return `${formatMoney(minimum, row.currency)} to ${formatMoney(maximum, row.currency)}${suffix}`;
  }
  if (minimum !== null) return `From ${formatMoney(minimum, row.currency)}${suffix}`;
  return `Up to ${formatMoney(maximum ?? 0, row.currency)}${suffix}`;
}

function servicePriceLabel(row: Row) {
  if (row.price_type === "contact") return "Contact for pricing";
  const minimum = numeric(row.price_min);
  const maximum = numeric(row.price_max);
  const suffix = row.price_type === "hourly" ? " per hour" : "";
  if (minimum !== null && maximum !== null && minimum !== maximum) {
    return `${formatMoney(minimum, row.currency)} to ${formatMoney(maximum, row.currency)}${suffix}`;
  }
  if (minimum !== null) return `${formatMoney(minimum, row.currency)}${suffix}`;
  if (maximum !== null) return `Up to ${formatMoney(maximum, row.currency)}${suffix}`;
  return "Contact for pricing";
}

function locationLabel(row: Row) {
  if (row.service_mode === "remote") return "Remote or online";
  return [text(row.city, 100), text(row.region, 100)].filter(Boolean).join(", ") || "Location on listing";
}

function profileLabel(profile: Row | undefined) {
  return (
    text(profile?.full_name, 120) ||
    (text(profile?.username, 100) ? `@${text(profile?.username, 100)}` : "Loombus member")
  );
}

function ownerLabel(row: Row, type: MatchingEntityType, profiles: Map<string, Row>, businesses: Map<string, Row>) {
  const business = row.business_id ? businesses.get(String(row.business_id)) : undefined;
  if (business) return text(business.name, 160) || "Loombus business";
  const ownerId = type === "request" ? String(row.requester_id) : String(row.provider_id);
  return profileLabel(profiles.get(ownerId));
}

function toMatch(
  candidate: Row,
  descriptor: PairDescriptor,
  profiles: Map<string, Row>,
  businesses: Map<string, Row>,
): IntelligentMatch {
  const sourceType = descriptor.sourceType;
  const targetType = descriptor.targetType;
  const source = descriptor.source;
  const target = descriptor.target;
  return {
    id: String(candidate.id),
    direction: descriptor.direction,
    confidence: Number(candidate.internal_confidence ?? descriptor.confidence),
    confidenceLabel: matchingConfidenceLabel(
      Number(candidate.internal_confidence ?? descriptor.confidence),
    ),
    explanation: Array.isArray(candidate.explanation)
      ? candidate.explanation.map(String)
      : descriptor.explanation,
    factors:
      candidate.factors && typeof candidate.factors === "object"
        ? (candidate.factors as MatchFactorScores)
        : descriptor.factors,
    source: {
      type: sourceType,
      id: String(source.id),
      title: text(source.title, 200),
      href:
        sourceType === "request"
          ? `/requests/${text(source.slug, 120)}`
          : `/services/${text(source.slug, 120)}`,
      category: text(source.category, 120),
      ownerLabel:
        sourceType === "request" ? "Your Request" : "Your Service",
    },
    target: {
      type: targetType,
      id: String(target.id),
      title: text(target.title, 200),
      href:
        targetType === "request"
          ? `/requests/${text(target.slug, 120)}`
          : `/services/${text(target.slug, 120)}`,
      category: text(target.category, 120),
      ownerLabel: ownerLabel(target, targetType, profiles, businesses),
      summary: text(target.description, 600),
      locationLabel: locationLabel(target),
      priceLabel:
        targetType === "request" ? requestBudgetLabel(target) : servicePriceLabel(target),
    },
    saved: Boolean(candidate.saved_at),
    dismissed: Boolean(candidate.dismissed_at),
    viewed: Boolean(candidate.viewed_at),
    actedOn: Boolean(candidate.acted_on_at) || descriptor.actedOn,
    expiresAt: candidate.expires_at ? String(candidate.expires_at) : descriptor.expiresAt,
    refreshedAt: String(candidate.refreshed_at ?? new Date().toISOString()),
  };
}

async function loadMatchingRows(service: Service, userId: string, preferences: MatchingPreferences, rules: MatchingRule[]) {
  const categoryFilter = preferences.categories.length
    ? [
        ...new Set([
          ...preferences.categories,
          ...rules.flatMap((rule) => rule.categories),
        ]),
      ]
    : [];
  let ownRequestsQuery = service
    .from("service_requests")
    .select(REQUEST_SELECT)
    .eq("requester_id", userId)
    .in("status", ["open", "reviewing"])
    .is("selected_response_id", null)
    .order("updated_at", { ascending: false })
    .limit(100);
  let ownServicesQuery = service
    .from("provider_services")
    .select(SERVICE_SELECT)
    .eq("provider_id", userId)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (categoryFilter.length) {
    ownRequestsQuery = ownRequestsQuery.in("category", categoryFilter);
    ownServicesQuery = ownServicesQuery.in("category", categoryFilter);
  }
  const [ownRequestsResult, ownServicesResult] = await Promise.all([
    ownRequestsQuery,
    ownServicesQuery,
  ]);
  if (ownRequestsResult.error || ownServicesResult.error) {
    throw new IntelligentMatchingError(
      "Unable to load your active Requests and Services.",
      503,
      "matching_sources_unavailable",
    );
  }
  const now = Date.now();
  const ownRequests = preferences.activeSections.includes("requests")
    ? ((ownRequestsResult.data ?? []) as Row[]).filter(
        (row) => !row.deadline || new Date(row.deadline).getTime() > now,
      )
    : [];
  const ownServices = preferences.activeSections.includes("services")
    ? ((ownServicesResult.data ?? []) as Row[])
    : [];
  const sourceCategories = [
    ...new Set(
      [...ownRequests, ...ownServices]
        .map((row) => text(row.category, 120))
        .filter(Boolean),
    ),
  ];
  if (!sourceCategories.length) {
    return { ownRequests, ownServices, targetRequests: [], targetServices: [] };
  }
  const [targetRequestsResult, targetServicesResult] = await Promise.all([
    service
      .from("service_requests")
      .select(REQUEST_SELECT)
      .neq("requester_id", userId)
      .eq("status", "open")
      .is("selected_response_id", null)
      .in("category", sourceCategories)
      .order("urgency_rank", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(500),
    service
      .from("provider_services")
      .select(SERVICE_SELECT)
      .neq("provider_id", userId)
      .eq("status", "published")
      .in("category", sourceCategories)
      .order("published_at", { ascending: false })
      .limit(500),
  ]);
  if (targetRequestsResult.error || targetServicesResult.error) {
    throw new IntelligentMatchingError(
      "Unable to load compatible Requests and Services.",
      503,
      "matching_targets_unavailable",
    );
  }
  return {
    ownRequests,
    ownServices,
    targetRequests: ((targetRequestsResult.data ?? []) as Row[]).filter(
      (row) => !row.deadline || new Date(row.deadline).getTime() > now,
    ),
    targetServices: (targetServicesResult.data ?? []) as Row[],
  };
}

async function supportingMaps(service: Service, rows: Row[], userId: string) {
  const ownerIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.requester_id, row.provider_id])
        .filter((value) => typeof value === "string" && value)
        .map(String),
    ),
  ];
  const businessIds = [
    ...new Set(
      rows
        .map((row) => row.business_id)
        .filter((value) => typeof value === "string" && value)
        .map(String),
    ),
  ];
  const entityIds = rows.map((row) => String(row.id));
  const [profilesResult, businessesResult, blocksResult, locationsResult] = await Promise.all([
    ownerIds.length
      ? service
          .from("profiles")
          .select("id, full_name, username, account_status, enforcement_reason, suspended_until")
          .in("id", ownerIds)
      : Promise.resolve({ data: [], error: null }),
    businessIds.length
      ? service.from("businesses").select("id, name, slug").in("id", businessIds)
      : Promise.resolve({ data: [], error: null }),
    service
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
    entityIds.length || businessIds.length
      ? service
          .from("loombus_local_locations")
          .select("source_table, entity_id, latitude, longitude, city, region, postal_code, country_code")
          .in("source_table", ["service_requests", "provider_services", "businesses"])
          .in("entity_id", [...new Set([...entityIds, ...businessIds])])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error || businessesResult.error || blocksResult.error) {
    throw new IntelligentMatchingError(
      "Unable to verify matching eligibility.",
      503,
      "matching_eligibility_unavailable",
    );
  }
  const profiles = new Map<string, Row>(
    ((profilesResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
  );
  const businesses = new Map<string, Row>(
    ((businessesResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
  );
  const blocked = new Set<string>();
  for (const row of (blocksResult.data ?? []) as Row[]) {
    const other = String(row.blocker_id) === userId ? row.blocked_id : row.blocker_id;
    if (other) blocked.add(String(other));
  }
  const locations = new Map<string, LocationRow>();
  if (!locationsResult.error) {
    for (const row of (locationsResult.data ?? []) as Row[]) {
      locations.set(`${row.source_table}:${row.entity_id}`, {
        source_table: String(row.source_table),
        entity_id: String(row.entity_id),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        city: text(row.city, 100) || null,
        region: text(row.region, 100) || null,
        postal_code: text(row.postal_code, 30) || null,
        country_code: text(row.country_code, 2) || null,
      });
    }
  }
  return { profiles, businesses, blocked, locations };
}

function rowOwnerId(row: Row, type: MatchingEntityType) {
  return String(type === "request" ? row.requester_id : row.provider_id);
}

function activeOwnerAllowed(
  ownerId: string,
  profiles: Map<string, Row>,
  blocked: Set<string>,
) {
  if (blocked.has(ownerId)) return false;

  const profile = profiles.get(ownerId);
  if (!profile) return false;

  return getAccountEnforcementResult({
    account_status:
      typeof profile.account_status === "string"
        ? profile.account_status
        : null,
    enforcement_reason:
      typeof profile.enforcement_reason === "string"
        ? profile.enforcement_reason
        : null,
    suspended_until:
      typeof profile.suspended_until === "string"
        ? profile.suspended_until
        : null,
  }).allowed;
}

function sourceLocation(
  row: Row,
  type: MatchingEntityType,
  locations: Map<string, LocationRow>,
) {
  const directTable = type === "request" ? "service_requests" : "provider_services";
  return (
    locations.get(`${directTable}:${row.id}`) ??
    (row.business_id ? locations.get(`businesses:${row.business_id}`) : null) ??
    null
  );
}

async function loadActedPairs(service: Service, userId: string) {
  const [responsesResult, inquiriesResult] = await Promise.all([
    service
      .from("service_request_responses")
      .select("request_id, provider_service_id, status")
      .eq("responder_id", userId)
      .neq("status", "withdrawn")
      .limit(1000),
    service
      .from("provider_service_inquiries")
      .select("service_id, linked_request_id, status")
      .eq("requester_id", userId)
      .in("status", ["submitted", "accepted", "closed"])
      .limit(1000),
  ]);
  const serviceToRequest = new Set<string>();
  for (const row of (responsesResult.data ?? []) as Row[]) {
    if (row.provider_service_id) {
      serviceToRequest.add(`${row.provider_service_id}:${row.request_id}`);
    }
  }
  const requestToService = new Set<string>();
  for (const row of (inquiriesResult.data ?? []) as Row[]) {
    if (row.linked_request_id) {
      requestToService.add(`${row.linked_request_id}:${row.service_id}`);
    }
  }
  return { serviceToRequest, requestToService };
}

export async function getIntelligentMatches(
  request: NextRequest,
): Promise<IntelligentMatchingResponse> {
  const { access, service } = await requireMatchingAccount(request);
  const [preferences, rules] = await Promise.all([
    loadPreferences(service, access.user.id),
    loadRules(service, access.user.id),
  ]);
  const rows = await loadMatchingRows(service, access.user.id, preferences, rules);
  const allRows = [
    ...rows.ownRequests,
    ...rows.ownServices,
    ...rows.targetRequests,
    ...rows.targetServices,
  ];
  const [{ profiles, businesses, blocked, locations }, actedPairs, existingResult] =
    await Promise.all([
      supportingMaps(service, allRows, access.user.id),
      loadActedPairs(service, access.user.id),
      service
        .from("match_candidates")
        .select("*")
        .eq("viewer_id", access.user.id)
        .order("internal_confidence", { ascending: false })
        .limit(1000),
    ]);
  if (existingResult.error) {
    throw new IntelligentMatchingError(
      "Unable to load current match candidates.",
      503,
      "match_candidates_unavailable",
    );
  }
  const existingRows = (existingResult.data ?? []) as Row[];
  const existingKeys = new Set(
    existingRows.map((row) =>
      candidateKey(
        row.source_type as MatchingEntityType,
        String(row.source_id),
        row.target_type as MatchingEntityType,
        String(row.target_id),
      ),
    ),
  );
  const descriptors = new Map<string, PairDescriptor>();
  const servicesByCategory = new Map<string, Row[]>();
  for (const row of rows.targetServices) {
    const ownerId = rowOwnerId(row, "service");
    if (!activeOwnerAllowed(ownerId, profiles, blocked)) continue;
    const category = text(row.category, 120);
    servicesByCategory.set(category, [...(servicesByCategory.get(category) ?? []), row]);
  }
  for (const requestRow of rows.ownRequests) {
    for (const serviceRow of servicesByCategory.get(text(requestRow.category, 120)) ?? []) {
      const descriptor = scorePair(
        "request_to_service",
        requestRow,
        serviceRow,
        sourceLocation(requestRow, "request", locations),
        sourceLocation(serviceRow, "service", locations),
        preferences,
        rules,
        actedPairs.requestToService.has(`${requestRow.id}:${serviceRow.id}`),
      );
      if (descriptor && (!preferences.matchingPaused || existingKeys.has(descriptor.key))) {
        descriptors.set(descriptor.key, descriptor);
      }
    }
  }
  const requestsByCategory = new Map<string, Row[]>();
  for (const row of rows.targetRequests) {
    const ownerId = rowOwnerId(row, "request");
    if (!activeOwnerAllowed(ownerId, profiles, blocked)) continue;
    const category = text(row.category, 120);
    requestsByCategory.set(category, [...(requestsByCategory.get(category) ?? []), row]);
  }
  for (const serviceRow of rows.ownServices) {
    for (const requestRow of requestsByCategory.get(text(serviceRow.category, 120)) ?? []) {
      const descriptor = scorePair(
        "service_to_request",
        requestRow,
        serviceRow,
        sourceLocation(requestRow, "request", locations),
        sourceLocation(serviceRow, "service", locations),
        preferences,
        rules,
        actedPairs.serviceToRequest.has(`${serviceRow.id}:${requestRow.id}`),
      );
      if (descriptor && (!preferences.matchingPaused || existingKeys.has(descriptor.key))) {
        descriptors.set(descriptor.key, descriptor);
      }
    }
  }
  if (!preferences.matchingPaused) {
    const refreshedAt = new Date().toISOString();
    const upserts = [...descriptors.values()].map((descriptor) => ({
      viewer_id: access.user.id,
      source_type: descriptor.sourceType,
      source_id: descriptor.source.id,
      target_type: descriptor.targetType,
      target_id: descriptor.target.id,
      direction: descriptor.direction,
      eligibility_status: "eligible",
      internal_confidence: descriptor.confidence,
      factors: descriptor.factors,
      explanation: descriptor.explanation,
      refreshed_at: refreshedAt,
      expires_at: descriptor.expiresAt,
      ...(descriptor.actedOn ? { acted_on_at: refreshedAt } : {}),
    }));
    if (upserts.length) {
      const { error } = await service.from("match_candidates").upsert(upserts, {
        onConflict: "viewer_id,source_type,source_id,target_type,target_id",
      });
      if (error) {
        throw new IntelligentMatchingError(
          "Unable to refresh match candidates.",
          503,
          "match_refresh_unavailable",
        );
      }
    }
    const staleIds = existingRows
      .filter((row) => row.eligibility_status === "eligible")
      .filter((row) => {
        const key = candidateKey(
          row.source_type as MatchingEntityType,
          String(row.source_id),
          row.target_type as MatchingEntityType,
          String(row.target_id),
        );
        return !descriptors.has(key);
      })
      .map((row) => String(row.id));
    if (staleIds.length) {
      await service
        .from("match_candidates")
        .update({ eligibility_status: "expired" })
        .in("id", staleIds);
    }
  }
  const { data: candidateRows, error: candidateError } = await service
    .from("match_candidates")
    .select("*")
    .eq("viewer_id", access.user.id)
    .eq("eligibility_status", "eligible")
    .order("internal_confidence", { ascending: false })
    .order("refreshed_at", { ascending: false })
    .limit(500);
  if (candidateError) {
    throw new IntelligentMatchingError(
      "Unable to load refreshed matches.",
      503,
      "match_candidates_unavailable",
    );
  }
  const hydrated = ((candidateRows ?? []) as Row[])
    .map((candidate) => {
      const key = candidateKey(
        candidate.source_type as MatchingEntityType,
        String(candidate.source_id),
        candidate.target_type as MatchingEntityType,
        String(candidate.target_id),
      );
      const descriptor = descriptors.get(key);
      return descriptor ? toMatch(candidate, descriptor, profiles, businesses) : null;
    })
    .filter((match): match is IntelligentMatch => Boolean(match));
  const matches = hydrated.filter((match) => !match.dismissed);
  const dismissedMatches = hydrated.filter((match) => match.dismissed);
  return {
    matches,
    dismissedMatches,
    preferences,
    rules,
    counts: {
      active: matches.length,
      saved: hydrated.filter((match) => match.saved).length,
      dismissed: dismissedMatches.length,
      requestToService: matches.filter(
        (match) => match.direction === "request_to_service",
      ).length,
      serviceToRequest: matches.filter(
        (match) => match.direction === "service_to_request",
      ).length,
    },
    generatedAt: new Date().toISOString(),
    matchingPaused: preferences.matchingPaused,
    activeSections: preferences.activeSections,
  };
}

export async function updateMatchingPreferences(
  request: NextRequest,
  input: MatchingInput,
) {
  const { access, service } = await requireMatchingAccount(request);
  const activeSections = stringArray(input.activeSections, 2, 20).filter(
    (section) => section === "requests" || section === "services",
  );
  const frequency = text(input.notificationFrequency, 20);
  const payload = {
    user_id: access.user.id,
    active_sections: activeSections.length ? activeSections : ["requests", "services"],
    categories: stringArray(input.categories, 24, 120),
    radius_miles: integer(input.radiusMiles, 25, 1, 250),
    include_remote: input.includeRemote !== false,
    minimum_relevance: integer(input.minimumRelevance, 55, 0, 100),
    notification_frequency:
      frequency === "none" || frequency === "daily" || frequency === "weekly"
        ? frequency
        : "weekly",
    matching_paused: input.matchingPaused === true,
  };
  const { data, error } = await service
    .from("matching_preferences")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) {
    throw new IntelligentMatchingError(
      "Unable to save matching preferences.",
      503,
      "matching_preferences_save_failed",
    );
  }
  return { preferences: preferenceRow(data as Row) };
}

export async function createMatchingRule(
  request: NextRequest,
  input: MatchingInput,
) {
  const { access, service } = await requireMatchingAccount(request);
  const name = text(input.name, 80);
  if (!name) {
    throw new IntelligentMatchingError(
      "Add a name for the matching rule.",
      400,
      "matching_rule_name_required",
    );
  }
  const sourceType = text(input.sourceType, 20);
  const targetType = sourceType === "service" ? "request" : "service";
  const { data, error } = await service
    .from("matching_rules")
    .insert({
      user_id: access.user.id,
      name,
      source_type: sourceType === "service" ? "service" : "request",
      target_type: targetType,
      categories: stringArray(input.categories, 24, 120),
      radius_miles: integer(input.radiusMiles, 25, 1, 250),
      include_remote: input.includeRemote !== false,
      minimum_relevance: integer(input.minimumRelevance, 55, 0, 100),
      is_active: true,
    })
    .select("*")
    .single();
  if (error) {
    throw new IntelligentMatchingError(
      "Unable to save the matching rule.",
      503,
      "matching_rule_save_failed",
    );
  }
  return { rule: ruleRow(data as Row) };
}

export async function deleteMatchingRule(
  request: NextRequest,
  input: MatchingInput,
) {
  const { access, service } = await requireMatchingAccount(request);
  const ruleId = uuid(input.ruleId, "matching rule");
  const { error } = await service
    .from("matching_rules")
    .delete()
    .eq("id", ruleId)
    .eq("user_id", access.user.id);
  if (error) {
    throw new IntelligentMatchingError(
      "Unable to delete the matching rule.",
      503,
      "matching_rule_delete_failed",
    );
  }
  return { success: true };
}

export async function setMatchCandidateState(
  request: NextRequest,
  input: MatchingInput,
) {
  const { access, service } = await requireMatchingAccount(request);
  const candidateId = uuid(input.candidateId, "match candidate");
  const candidateAction = text(input.candidateAction, 30);
  const now = new Date().toISOString();
  let patch: Row;
  if (candidateAction === "view") patch = { viewed_at: now };
  else if (candidateAction === "save") patch = { saved_at: now, dismissed_at: null };
  else if (candidateAction === "unsave") patch = { saved_at: null };
  else if (candidateAction === "dismiss") patch = { dismissed_at: now, saved_at: null };
  else if (candidateAction === "restore") patch = { dismissed_at: null };
  else if (candidateAction === "acted") patch = { acted_on_at: now };
  else {
    throw new IntelligentMatchingError(
      "Unsupported match action.",
      400,
      "unsupported_match_action",
    );
  }
  const { data, error } = await service
    .from("match_candidates")
    .update(patch)
    .eq("id", candidateId)
    .eq("viewer_id", access.user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    throw new IntelligentMatchingError(
      "Unable to update this match.",
      error ? 503 : 404,
      error ? "match_update_failed" : "match_not_found",
    );
  }
  return { success: true };
}

export async function submitMatchFeedback(
  request: NextRequest,
  input: MatchingInput,
) {
  const { access, service } = await requireMatchingAccount(request);
  const candidateId = uuid(input.candidateId, "match candidate");
  const feedbackType = text(input.feedbackType, 30) as MatchFeedbackType;
  if (!new Set(["helpful", "not_relevant", "incorrect", "unsafe"]).has(feedbackType)) {
    throw new IntelligentMatchingError(
      "Choose valid match feedback.",
      400,
      "invalid_match_feedback",
    );
  }
  const { data: candidate } = await service
    .from("match_candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("viewer_id", access.user.id)
    .maybeSingle();
  if (!candidate) {
    throw new IntelligentMatchingError(
      "Match not found.",
      404,
      "match_not_found",
    );
  }
  const { error } = await service.from("match_feedback").upsert(
    {
      candidate_id: candidateId,
      user_id: access.user.id,
      feedback_type: feedbackType,
      note: text(input.note, 1000) || null,
    },
    { onConflict: "candidate_id,user_id" },
  );
  if (error) {
    throw new IntelligentMatchingError(
      "Unable to save match feedback.",
      503,
      "match_feedback_failed",
    );
  }
  return { success: true };
}
