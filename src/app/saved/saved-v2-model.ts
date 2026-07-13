export type SavedDiscussion = {
  id: string;
  title: string;
  topic: string | null;
  reality_lens: string | null;
  purpose_lane: string | null;
  body: string;
  created_at: string;
};

export type SavedItem = {
  id: string;
  created_at: string;
  collection_id: string | null;
  private_note: string | null;
  private_note_updated_at: string | null;
  discussions: SavedDiscussion | null;
};

export type SavedCollection = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

export type SavedSortMode = "newest" | "oldest" | "title";

export function canUseSavedFolders(
  entitlement: SavedEntitlement,
  isAdmin: boolean
) {
  return (
    isAdmin ||
    Boolean(
      entitlement?.ai_assisted_enabled &&
        ["premium", "admin"].includes(entitlement.tier ?? "")
    )
  );
}

export function canUseSavedNotes(
  entitlement: SavedEntitlement,
  isAdmin: boolean
) {
  return (
    isAdmin ||
    Boolean(
      entitlement?.ai_assisted_enabled &&
        entitlement?.tier === "premium" &&
        (entitlement.monthly_summary_limit ?? 0) > 50
    )
  );
}

export function normalizeSavedExcerpt(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatSavedDate(value: string | null | undefined) {
  if (!value) return "Unknown date";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function buildFolderNames(collections: SavedCollection[]) {
  return Object.fromEntries(collections.map((folder) => [folder.id, folder.name]));
}

export function buildFolderCounts(items: SavedItem[]) {
  const counts: Record<string, number> = {
    all: items.length,
    unfiled: 0,
  };

  for (const item of items) {
    const key = item.collection_id ?? "unfiled";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

export function buildTopTopics(items: SavedItem[], limit = 5) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const topic = item.discussions?.topic?.trim();
    if (!topic) continue;
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

export function filterSavedItems({
  items,
  selectedFolder,
  query,
  notesOnly,
  noteDrafts,
  folderNames,
  sort,
}: {
  items: SavedItem[];
  selectedFolder: string;
  query: string;
  notesOnly: boolean;
  noteDrafts: Record<string, string>;
  folderNames: Record<string, string>;
  sort: SavedSortMode;
}) {
  const cleanQuery = query.trim().toLowerCase();

  return items
    .filter((item) => {
      if (selectedFolder === "all") return true;
      if (selectedFolder === "unfiled") return !item.collection_id;
      return item.collection_id === selectedFolder;
    })
    .filter((item) => {
      if (!notesOnly) return true;
      return Boolean((noteDrafts[item.id] ?? item.private_note ?? "").trim());
    })
    .filter((item) => {
      if (!cleanQuery) return true;

      const discussion = item.discussions;
      const searchable = [
        discussion?.title,
        discussion?.body,
        discussion?.topic,
        discussion?.reality_lens,
        discussion?.purpose_lane,
        noteDrafts[item.id],
        folderNames[item.collection_id ?? ""],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(cleanQuery);
    })
    .sort((a, b) => {
      if (sort === "title") {
        return (a.discussions?.title ?? "").localeCompare(
          b.discussions?.title ?? ""
        );
      }

      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();

      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });
}
