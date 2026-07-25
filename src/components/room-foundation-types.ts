import type { RoomModuleKey } from "@/lib/room-plan-entitlements";

export type Panel = "search" | "inbox" | null;
export type Preferences = {
  muted: boolean;
  importantOnly: boolean;
  lastReadAt: string;
};
export type Actor = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
} | null;
export type PageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  from: number;
  to: number;
};
export type ActivityEvent = {
  id: string;
  actorId: string | null;
  actor: Actor;
  eventType: string;
  moduleKey: string;
  moduleLabel: string;
  targetType: string;
  targetId: string | null;
  title: string;
  summary: string;
  importance: string;
  createdAt: string | null;
};
export type SearchResult = {
  moduleKey: string;
  moduleLabel: string;
  targetType: string;
  targetId: string;
  title: string;
  snippet: string;
  createdAt: string | null;
  rank: number;
};
export type ActivityPayload = {
  room?: { id: string; name: string };
  preferences?: Preferences;
  unreadCount?: number;
  unreadCapped?: boolean;
  events?: ActivityEvent[];
  pageInfo?: PageInfo | null;
  eventsCapped?: boolean;
  error?: string;
};
export type SearchPayload = {
  query?: string;
  results?: SearchResult[];
  pageInfo?: PageInfo | null;
  resultsCapped?: boolean;
  error?: string;
};

export const PAGE_SIZE = 24;
export const SEARCH_MODULES: Array<{ value: string; label: string }> = [
  { value: "", label: "Everything" },
  { value: "discussions", label: "Discussions" },
  { value: "calendar", label: "Calendar" },
  { value: "announcements", label: "Announcements" },
  { value: "resources", label: "Resources" },
  { value: "tasks", label: "Tasks" },
  { value: "polls", label: "Polls" },
  { value: "directory", label: "Directory" },
  { value: "knowledge", label: "Knowledge Base" },
  { value: "files", label: "Files" },
  { value: "forms", label: "Forms" },
  { value: "services", label: "Services" },
  { value: "member-workflows", label: "Member Workflows" },
];
export const MODULE_LABELS: Partial<Record<RoomModuleKey, string>> = {
  overview: "Overview",
  discussions: "Discussions",
  calendar: "Calendar",
  announcements: "Announcements",
  members: "Members / Roles",
  requests: "Requests",
  resources: "Resources",
  settings: "Settings",
  tasks: "Tasks / Action Items",
  polls: "Polls / Decisions",
  directory: "Directory / Contacts",
  knowledge: "Knowledge Base / FAQ",
  files: "Files / Documents",
  forms: "Forms / Submissions",
  services: "Services / Store",
  invites: "Invites / Join Requests",
  activity: "Activity / Audit Log",
  "advanced-controls": "Advanced Room Controls",
  "admin-tools": "More Admin Tools",
  operations: "Larger Room Operations",
  "member-workflows": "Advanced Member Workflows",
  "enterprise-controls": "Enterprise Controls",
  "high-capacity": "High-Capacity Rooms",
  "community-operations": "Full Private Community Operations",
};

export function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function actorName(actor: Actor) {
  return actor?.full_name?.trim() || actor?.username?.trim() || "";
}
