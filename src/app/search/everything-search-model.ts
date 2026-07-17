import {
  getEverythingSearchGroup,
  type EverythingSearchResponse,
  type EverythingSearchResult,
} from "@/lib/everything-search";

export type SearchGroup =
  | "all"
  | "discussions"
  | "people"
  | "rooms"
  | "services"
  | "knowledge"
  | "media"
  | "commerce"
  | "saved"
  | "pages";

export type AiSource = {
  title: string;
  href: string;
};

export const HISTORY_KEY = "loombus:everything-search-history";

export const GROUP_LABELS: Record<SearchGroup, string> = {
  all: "All",
  discussions: "Discussions",
  people: "People",
  rooms: "Rooms",
  services: "Services & events",
  knowledge: "Knowledge",
  media: "Media & files",
  commerce: "Commerce",
  saved: "Saved",
  pages: "Pages",
};

export const EMPTY_SEARCH: EverythingSearchResponse = {
  query: "",
  intent: "general",
  intentLabel: "Everything across Loombus",
  locationQuery: null,
  brief: "",
  results: [],
  counts: { all: 0 },
  authenticated: false,
  premium: false,
  indexed: false,
};

export function getSearchRouteState() {
  if (typeof window === "undefined") {
    return { query: "", group: "all" as SearchGroup };
  }

  const params = new URLSearchParams(window.location.search);
  const query = params.get("q")?.trim() ?? "";
  const requested = params.get("type") as SearchGroup | null;
  const group =
    requested && requested in GROUP_LABELS
      ? requested
      : ("all" as SearchGroup);

  return { query, group };
}

export function getVisibleResults(
  results: EverythingSearchResult[],
  group: SearchGroup
) {
  if (group === "all") return results;
  return results.filter(
    (result) => getEverythingSearchGroup(result.type) === group
  );
}

export function getVisibleGroups(search: EverythingSearchResponse) {
  const order: SearchGroup[] = [
    "all",
    "discussions",
    "people",
    "rooms",
    "services",
    "knowledge",
    "media",
    "commerce",
    "saved",
    "pages",
  ];

  return order.filter(
    (group) => group === "all" || Number(search.counts[group] ?? 0) > 0
  );
}

export function formatSearchDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
