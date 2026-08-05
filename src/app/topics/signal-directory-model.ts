import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { PURPOSE_LANES } from "@/lib/purpose-lanes";
import { REALITY_LENSES } from "@/lib/reality-lenses";

export type DirectoryDimension = "topic" | "reality" | "purpose";

export type Discussion = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  topic: string | null;
  reality_lens: string | null;
  purpose_lane: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
};

export type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

export type DirectoryItem = {
  value: string;
  description: string;
  discussionCount: number;
  replyCount: number;
  viewCount: number;
  saveCount: number;
  activityScore: number;
  newThisWeek: number;
  latestDiscussion: Discussion | null;
  latestAt: string | null;
  active: boolean;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const REALITY_DESCRIPTIONS: Record<string, string> = {
  Loneliness:
    "The lived reality of isolation, disconnection, and the need for meaningful human contact.",
  "Hidden Financial Stress":
    "Financial pressure that may remain invisible behind ordinary appearances or professional success.",
  "Fear of Irrelevance":
    "Questions about usefulness, identity, status, and staying meaningful as the world changes.",
  "Psychological Exhaustion":
    "Burnout, emotional depletion, cognitive overload, and the costs of sustained pressure.",
  "Quiet Regret":
    "Unspoken disappointment, missed possibilities, and lessons that surface through reflection.",
  "Rebuilding Meaning":
    "How people reconstruct purpose, direction, and identity after disruption or change.",
  "Entrepreneur Isolation":
    "The private uncertainty, responsibility, and loneliness that can accompany building something new.",
  "Reality Behind Success":
    "The tradeoffs, sacrifices, instability, and human costs hidden behind visible achievement.",
  "AI and Human Purpose":
    "How artificial intelligence changes identity, dignity, agency, and meaningful work.",
  "Life Transition":
    "Major changes in career, family, health, place, identity, or stage of life.",
};

const PURPOSE_DESCRIPTIONS: Record<string, string> = {
  Learning:
    "Understand a subject, gather useful context, or discover what others know.",
  Mastery:
    "Develop deeper capability through practice, critique, comparison, and refinement.",
  Contribution:
    "Share knowledge, experience, evidence, or support that can help other members.",
  Community:
    "Strengthen relationships, belonging, coordination, and shared understanding.",
  "Career transition":
    "Navigate changing roles, skills, industries, expectations, and professional identity.",
  "Human development":
    "Improve judgment, resilience, communication, self-awareness, and personal growth.",
  "Local problem-solving":
    "Address practical neighborhood, city, service, and community challenges.",
  "Life after automation":
    "Explore work, identity, income, institutions, and daily life as automation expands.",
};

export function isDirectoryDimension(
  value: string | null
): value is DirectoryDimension {
  return value === "topic" || value === "reality" || value === "purpose";
}

export function getDimensionLabel(dimension: DirectoryDimension) {
  if (dimension === "reality") return "Reality Lenses";
  if (dimension === "purpose") return "Purpose Lanes";
  return "Topics";
}

export function getDimensionSingular(dimension: DirectoryDimension) {
  if (dimension === "reality") return "Reality Lens";
  if (dimension === "purpose") return "Purpose Lane";
  return "Topic";
}

export function getDimensionValues(
  dimension: DirectoryDimension
): readonly string[] {
  if (dimension === "reality") return REALITY_LENSES;
  if (dimension === "purpose") return PURPOSE_LANES;
  return DISCUSSION_TOPICS;
}

export function getDimensionValue(
  discussion: Discussion,
  dimension: DirectoryDimension
) {
  if (dimension === "reality") return discussion.reality_lens?.trim() || null;
  if (dimension === "purpose") return discussion.purpose_lane?.trim() || null;
  return discussion.topic?.trim() || "Other";
}

function getDescription(dimension: DirectoryDimension, value: string) {
  if (dimension === "reality") {
    return (
      REALITY_DESCRIPTIONS[value] ??
      `Discussions framed through the lived reality of ${value}.`
    );
  }

  if (dimension === "purpose") {
    return (
      PURPOSE_DESCRIPTIONS[value] ??
      `Discussions intended to advance ${value}.`
    );
  }

  return `Focused discussions, questions, and current activity filed under ${value}.`;
}

export function getProfileName(profile: Profile | undefined) {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    "Loombus member"
  );
}

export function formatDate(value: string | null) {
  if (!value) return "No activity yet";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatRelativeTime(value: string | null) {
  if (!value) return "No activity yet";

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(value);
}

export function buildDirectoryItems({
  dimension,
  discussions,
  replyCounts,
  viewCounts,
  saveCounts,
}: {
  dimension: DirectoryDimension;
  discussions: Discussion[];
  replyCounts: Record<string, number>;
  viewCounts: Record<string, number>;
  saveCounts: Record<string, number>;
}) {
  const now = Date.now();
  const values = new Set<string>(getDimensionValues(dimension));

  for (const discussion of discussions) {
    const value = getDimensionValue(discussion, dimension);
    if (value) values.add(value);
  }

  return [...values]
    .map<DirectoryItem>((value) => {
      const matching = discussions.filter(
        (discussion) => getDimensionValue(discussion, dimension) === value
      );
      const latestDiscussion = matching[0] ?? null;
      const replyCount = matching.reduce(
        (total, discussion) => total + (replyCounts[discussion.id] ?? 0),
        0
      );
      const viewCount = matching.reduce(
        (total, discussion) => total + (viewCounts[discussion.id] ?? 0),
        0
      );
      const saveCount = matching.reduce(
        (total, discussion) => total + (saveCounts[discussion.id] ?? 0),
        0
      );
      const newThisWeek = matching.filter(
        (discussion) =>
          now - new Date(discussion.created_at).getTime() <= WEEK_MS
      ).length;
      const latestAt = latestDiscussion?.created_at ?? null;

      return {
        value,
        description: getDescription(dimension, value),
        discussionCount: matching.length,
        replyCount,
        viewCount,
        saveCount,
        activityScore: replyCount * 3 + saveCount * 5 + viewCount,
        newThisWeek,
        latestDiscussion,
        latestAt,
        active:
          latestAt !== null &&
          now - new Date(latestAt).getTime() <= ACTIVE_WINDOW_MS,
      };
    })
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        b.discussionCount - a.discussionCount ||
        b.activityScore - a.activityScore ||
        a.value.localeCompare(b.value)
    );
}
