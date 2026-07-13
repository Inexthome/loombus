export type DashboardProfile = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export type DashboardActivityCounts = {
  discussions: number;
  replies: number;
  saved: number;
  unreadNotifications: number;
  topicsContributed: number;
  savedByReaders: number;
  repliesReceived: number;
  resolvedDiscussions: number;
};

export type DashboardAiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
};

export type DashboardPurposeGoalStatus = "active" | "paused" | "completed";

export type DashboardPurposeGoal = {
  id: string;
  user_id: string;
  title: string;
  purpose_lane: string | null;
  private_note: string | null;
  status: DashboardPurposeGoalStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type DashboardDiscussion = {
  id: string;
  title: string;
  topic: string | null;
  discussion_status: string | null;
  created_at: string;
};

export type DashboardTopicSignal = {
  topic: string;
  discussions: number;
  repliesReceived: number;
  savedByReaders: number;
  resolved: number;
};

export type DashboardAction = {
  title: string;
  description: string;
  href: string;
  action: string;
  tone: "foundation" | "attention" | "growth" | "steady";
};

export type DashboardMetric = {
  label: string;
  value: number;
  description: string;
  href: string;
};

export function getMissingProfileFields(profile: DashboardProfile | null) {
  const missing: string[] = [];

  if (!profile?.username?.trim()) missing.push("username");
  if (!profile?.full_name?.trim()) missing.push("full name");
  if (!profile?.bio?.trim()) missing.push("bio");
  if (!profile?.avatar_url?.trim()) missing.push("profile image");

  return missing;
}

export function getDashboardName(profile: DashboardProfile | null, email: string | null) {
  const source =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    email?.split("@")[0]?.trim() ||
    "there";

  return source.split(/\s+/)[0];
}

export function getGreetingLabel(date = new Date()) {
  const hour = date.getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatDashboardDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function getGoalStatusLabel(status: DashboardPurposeGoalStatus) {
  if (status === "completed") return "Completed";
  if (status === "paused") return "Paused";
  return "Active";
}
