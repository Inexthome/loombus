export const DISCUSSION_TOPICS = [
  "AI & Society",
  "Books & Writing",
  "Business",
  "Culture",
  "Education",
  "Entrepreneurship",
  "Environment",
  "Faith & Values",
  "Future of Work",
  "General",
  "Healthcare",
  "Law & Justice",
  "Local Community",
  "Media",
  "Money & Finance",
  "Parenting & Family",
  "Philosophy",
  "Politics & Policy",
  "Psychology",
  "Science",
  "Systems",
  "Technology",
] as const;

export type DiscussionTopic = (typeof DISCUSSION_TOPICS)[number];

export const DEFAULT_DISCUSSION_TOPIC: DiscussionTopic = "AI & Society";
