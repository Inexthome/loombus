export type MarketplaceConversationContext = {
  listingId: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  isFree: boolean;
  city: string;
  region: string;
  status: string;
};

export type Conversation = {
  id: string;
  otherUserId: string | null;
  otherUsername: string | null;
  otherFullName: string | null;
  otherAvatarUrl: string | null;
  hasUnread: boolean;
  mutedAt: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  marketplaceContexts?: MarketplaceConversationContext[];
};

export type MessageAttachment = {
  id: string;
  messageId: string;
  conversationId: string;
  userId: string;
  publicUrl: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  attachmentKind: "image" | "pdf";
  sortOrder: number;
  createdAt: string;
};

export type ThreadMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedBySender: boolean;
  attachments?: MessageAttachment[];
};

export type PeopleSearchResult = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

export type ConversationFilter = "all" | "unread" | "muted";
export type ConversationAction = "archive" | "delete" | "report" | "mute" | "unmute";
export type NoticeTone = "neutral" | "success" | "error";

export const MESSAGE_ATTACHMENT_BUCKET = "message-attachments";
export const MAX_MESSAGE_ATTACHMENT_FILES = 3;
export const MAX_MESSAGE_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MESSAGE_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export const MESSAGE_REPORT_REASONS = [
  ["spam", "Spam"],
  ["harassment", "Harassment"],
  ["abuse", "Abuse"],
  ["impersonation", "Impersonation"],
  ["scam", "Scam"],
  ["other", "Other"],
] as const;

export function getConversationName(conversation?: Conversation | null) {
  return (
    conversation?.otherFullName?.trim() ||
    conversation?.otherUsername?.trim() ||
    "Loombus member"
  );
}

export function getConversationHandle(conversation?: Conversation | null) {
  return conversation?.otherUsername ? `@${conversation.otherUsername}` : "Private conversation";
}

export function getConversationConnectionLabel(conversation?: Conversation | null) {
  return conversation?.marketplaceContexts?.length ? "Marketplace inquiry" : "Mutual followers";
}

export function getPrimaryMarketplaceContext(conversation?: Conversation | null) {
  return conversation?.marketplaceContexts?.[0] ?? null;
}

export function formatMarketplaceConversationPrice(
  context: MarketplaceConversationContext | null | undefined
) {
  if (!context) return "";
  const price = (() => {
    if (context.isFree) return "Free";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: context.currency || "USD",
        maximumFractionDigits: Number.isInteger(context.price) ? 0 : 2,
      }).format(context.price);
    } catch {
      return `${context.currency || "USD"} ${context.price.toLocaleString()}`;
    }
  })();
  return context.status === "reserved" ? `Reserved · ${price}` : price;
}

export function getMarketplaceConversationLocation(
  context: MarketplaceConversationContext | null | undefined
) {
  if (!context) return "";
  return [context.city, context.region].filter(Boolean).join(", ");
}

export function getPeopleResultName(person: PeopleSearchResult) {
  return person.fullName?.trim() || person.username?.trim() || "Loombus member";
}

export function getPeopleResultHandle(person: PeopleSearchResult) {
  return person.username ? `@${person.username}` : "Mutual follower";
}

export function formatMessageAttachmentFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function getSafeMessageAttachmentFileName(fileName: string) {
  return fileName.trim().replace(/[\\/]/g, "-").slice(0, 120);
}

export function formatConversationTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (dayDifference === 1) return "Yesterday";
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMessageDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export function isDifferentMessageDay(current: ThreadMessage, previous?: ThreadMessage) {
  if (!previous) return true;
  return new Date(current.createdAt).toDateString() !== new Date(previous.createdAt).toDateString();
}

export function getConversationPreview(conversation: Conversation) {
  const preview = conversation.lastMessagePreview?.trim();
  if (!preview || preview === "[Attachment]") return "Attachment shared";
  return preview;
}
