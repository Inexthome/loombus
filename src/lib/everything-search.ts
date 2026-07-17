export type EverythingSearchType =
  | "discussion"
  | "reply"
  | "person"
  | "room"
  | "room_discussion"
  | "announcement"
  | "event"
  | "service"
  | "knowledge"
  | "task"
  | "poll"
  | "form"
  | "resource"
  | "image"
  | "video"
  | "document"
  | "file"
  | "saved"
  | "page"
  | "company"
  | "product"
  | "job"
  | "marketplace";

export type EverythingSearchIntent =
  | "learn"
  | "navigate"
  | "person"
  | "community"
  | "local_service"
  | "event"
  | "media"
  | "document"
  | "commerce"
  | "general";

export type EverythingSearchResult = {
  id: string;
  type: EverythingSearchType;
  title: string;
  snippet: string;
  href: string;
  sourceLabel: string;
  createdAt: string | null;
  score: number;
  ownerId: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  roomId: string | null;
  roomName: string | null;
  visibility: "public" | "authenticated" | "premium" | "member" | "private";
  metadata: Record<string, unknown>;
};

export type EverythingSearchResponse = {
  query: string;
  intent: EverythingSearchIntent;
  intentLabel: string;
  locationQuery: string | null;
  brief: string;
  results: EverythingSearchResult[];
  counts: Record<string, number>;
  authenticated: boolean;
  premium: boolean;
  indexed: boolean;
};

const TYPE_LABELS: Record<EverythingSearchType, string> = {
  discussion: "Discussion",
  reply: "Reply",
  person: "Person",
  room: "Room",
  room_discussion: "Room discussion",
  announcement: "Announcement",
  event: "Event",
  service: "Service",
  knowledge: "Knowledge",
  task: "Task",
  poll: "Poll",
  form: "Form",
  resource: "Resource",
  image: "Image",
  video: "Video",
  document: "Document",
  file: "File",
  saved: "Saved",
  page: "Loombus page",
  company: "Company",
  product: "Product",
  job: "Job",
  marketplace: "Marketplace",
};

export function getEverythingSearchTypeLabel(type: EverythingSearchType) {
  return TYPE_LABELS[type] ?? "Result";
}

export function getEverythingSearchGroup(type: EverythingSearchType) {
  if (["discussion", "reply", "room_discussion", "announcement"].includes(type)) {
    return "discussions";
  }
  if (type === "person") return "people";
  if (type === "room") return "rooms";
  if (type === "job") return "jobs";
  if (["service", "event", "company"].includes(type)) return "services";
  if (["image", "video", "document", "file", "resource"].includes(type)) {
    return "media";
  }
  if (["knowledge", "task", "poll", "form"].includes(type)) return "knowledge";
  if (["product", "marketplace"].includes(type)) return "commerce";
  if (type === "saved") return "saved";
  if (type === "page") return "pages";
  return "other";
}

export function buildSearchHref(query: string, type?: string) {
  const params = new URLSearchParams();
  const cleanQuery = query.trim();
  if (cleanQuery) params.set("q", cleanQuery);
  if (type && type !== "all") params.set("type", type);
  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
}
