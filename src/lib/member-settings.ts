export type MessagePermission = "mutual" | "followers" | "verified" | "nobody";
export type FollowPermission = "everyone" | "verified" | "approval" | "nobody";
export type MentionPermission = "everyone" | "followers" | "nobody";
export type RoomInvitePermission = "everyone" | "followers" | "nobody";
export type FeedDefault = "all" | "following" | "active";
export type FeedDensity = "comfortable" | "compact";
export type LocationMode = "approximate" | "device" | "off";
export type RoomNotificationDefault = "all" | "important" | "mentions" | "off";

export type MemberSettings = {
  birthDate: string;
  country: string;
  timezone: string;
  locale: string;
  contentLanguages: string[];
  autoTranslate: boolean;
  neverTranslateLanguages: string[];

  externalSearchIndexing: boolean;
  profileRecommendations: boolean;
  showFollowerCount: boolean;
  showOnlineStatus: boolean;
  showLastActive: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
  followPermission: FollowPermission;
  mentionPermission: MentionPermission;
  roomInvitePermission: RoomInvitePermission;
  messagePermission: MessagePermission;
  allowMessageAttachments: boolean;
  messageLinkPreviews: boolean;
  autoDownloadMessageMedia: boolean;
  incomingAudioCalls: boolean;
  incomingVideoCalls: boolean;
  ringOnDevice: boolean;

  autoplayMedia: boolean;
  autoplayAnimatedMedia: boolean;
  captionsByDefault: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  underlineLinks: boolean;
  textScale: "small" | "standard" | "large" | "xlarge";
  keyboardShortcuts: boolean;

  defaultFeed: FeedDefault;
  feedDensity: FeedDensity;
  showRecommendations: boolean;
  showFollowedMemberActivity: boolean;
  rememberDiscussionFilters: boolean;
  aiSummariesEnabled: boolean;
  autoExpandDiscussionState: boolean;
  personalizedRecommendations: boolean;

  locationMode: LocationMode;
  localArea: string;

  emailReplies: boolean;
  emailMentions: boolean;
  emailMessageRequests: boolean;
  emailRoomInvites: boolean;
  emailEvents: boolean;
  emailAppointments: boolean;
  emailVerificationSecurity: boolean;
  emailCommunityAnnouncements: boolean;
  emailProductAnnouncements: boolean;
  emailCreatorActivity: boolean;
  emailLibraryUpdates: boolean;
  emailOptionalPaused: boolean;

  pushMentions: boolean;
  pushMessageRequests: boolean;
  pushRoomInvites: boolean;
  pushEvents: boolean;
  pushAppointments: boolean;
  pushSecurity: boolean;
  pushLibrary: boolean;

  roomNotificationDefault: RoomNotificationDefault;
  eventReminderMinutes: 10 | 30 | 60 | 1440;
  appointmentReminderMinutes: 10 | 30 | 60 | 1440;

  creatorEarningsEmail: boolean;
  creatorSupporterAlerts: boolean;
  creatorSalesAlerts: boolean;

  dataPersonalizationEnabled: boolean;
  aiActivityHistoryEnabled: boolean;
};

export const DEFAULT_MEMBER_SETTINGS: MemberSettings = {
  birthDate: "",
  country: "US",
  timezone: "",
  locale: "en-US",
  contentLanguages: ["en"],
  autoTranslate: false,
  neverTranslateLanguages: [],

  externalSearchIndexing: true,
  profileRecommendations: true,
  showFollowerCount: true,
  showOnlineStatus: false,
  showLastActive: false,
  readReceipts: true,
  typingIndicators: true,
  followPermission: "everyone",
  mentionPermission: "everyone",
  roomInvitePermission: "followers",
  messagePermission: "mutual",
  allowMessageAttachments: true,
  messageLinkPreviews: true,
  autoDownloadMessageMedia: false,
  incomingAudioCalls: true,
  incomingVideoCalls: true,
  ringOnDevice: true,

  autoplayMedia: true,
  autoplayAnimatedMedia: true,
  captionsByDefault: false,
  reduceMotion: false,
  highContrast: false,
  underlineLinks: false,
  textScale: "standard",
  keyboardShortcuts: true,

  defaultFeed: "all",
  feedDensity: "comfortable",
  showRecommendations: true,
  showFollowedMemberActivity: true,
  rememberDiscussionFilters: true,
  aiSummariesEnabled: true,
  autoExpandDiscussionState: false,
  personalizedRecommendations: true,

  locationMode: "approximate",
  localArea: "",

  emailReplies: false,
  emailMentions: false,
  emailMessageRequests: false,
  emailRoomInvites: true,
  emailEvents: true,
  emailAppointments: true,
  emailVerificationSecurity: true,
  emailCommunityAnnouncements: true,
  emailProductAnnouncements: true,
  emailCreatorActivity: true,
  emailLibraryUpdates: false,
  emailOptionalPaused: false,

  pushMentions: true,
  pushMessageRequests: true,
  pushRoomInvites: true,
  pushEvents: true,
  pushAppointments: true,
  pushSecurity: true,
  pushLibrary: false,

  roomNotificationDefault: "important",
  eventReminderMinutes: 60,
  appointmentReminderMinutes: 60,

  creatorEarningsEmail: true,
  creatorSupporterAlerts: true,
  creatorSalesAlerts: true,

  dataPersonalizationEnabled: true,
  aiActivityHistoryEnabled: true,
};

const ENUMS = {
  followPermission: new Set(["everyone", "verified", "approval", "nobody"]),
  mentionPermission: new Set(["everyone", "followers", "nobody"]),
  roomInvitePermission: new Set(["everyone", "followers", "nobody"]),
  messagePermission: new Set(["mutual", "followers", "verified", "nobody"]),
  textScale: new Set(["small", "standard", "large", "xlarge"]),
  defaultFeed: new Set(["all", "following", "active"]),
  feedDensity: new Set(["comfortable", "compact"]),
  locationMode: new Set(["approximate", "device", "off"]),
  roomNotificationDefault: new Set(["all", "important", "mentions", "off"]),
} as const;

const BOOL_KEYS = new Set(
  Object.entries(DEFAULT_MEMBER_SETTINGS)
    .filter(([, value]) => typeof value === "boolean")
    .map(([key]) => key)
);

const STRING_KEYS = new Set([
  "birthDate",
  "country",
  "timezone",
  "locale",
  "localArea",
]);

const ARRAY_KEYS = new Set(["contentLanguages", "neverTranslateLanguages"]);
const REMINDER_KEYS = new Set(["eventReminderMinutes", "appointmentReminderMinutes"]);

function cleanString(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 12);
}

export function normalizeMemberSettings(value: unknown): MemberSettings {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const next: Record<string, unknown> = { ...DEFAULT_MEMBER_SETTINGS };

  for (const [key, fallback] of Object.entries(DEFAULT_MEMBER_SETTINGS)) {
    const incoming = source[key];
    if (BOOL_KEYS.has(key)) {
      next[key] = typeof incoming === "boolean" ? incoming : fallback;
      continue;
    }
    if (STRING_KEYS.has(key)) {
      next[key] = typeof incoming === "string" ? cleanString(incoming, key === "localArea" ? 160 : 120) : fallback;
      continue;
    }
    if (ARRAY_KEYS.has(key)) {
      next[key] = Array.isArray(incoming) ? cleanStringArray(incoming) : fallback;
      continue;
    }
    if (REMINDER_KEYS.has(key)) {
      next[key] = incoming === 10 || incoming === 30 || incoming === 60 || incoming === 1440 ? incoming : fallback;
      continue;
    }
    const enumValues = (ENUMS as Record<string, Set<string>>)[key];
    if (enumValues) {
      next[key] = typeof incoming === "string" && enumValues.has(incoming) ? incoming : fallback;
    }
  }

  return next as MemberSettings;
}

export function mergeMemberSettings(
  current: MemberSettings,
  patch: unknown
): MemberSettings {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return current;
  return normalizeMemberSettings({ ...current, ...(patch as Record<string, unknown>) });
}
