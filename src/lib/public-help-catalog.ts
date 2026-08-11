export type PublicHelpArea = {
  id: string;
  title: string;
  description: string;
  eyebrow: string;
  href: string;
  keywords: readonly string[];
};

export type PublicHelpArticle = {
  id: string;
  title: string;
  description: string;
  category: string;
  href: string;
  keywords: readonly string[];
};

export const PUBLIC_HELP_AREAS: readonly PublicHelpArea[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description:
      "Learn the Loombus workspaces, complete profile setup, and publish your first focused contribution.",
    eyebrow: "Start here",
    href: "/settings/guide#getting-started",
    keywords: ["start", "guide", "home", "profile", "new member", "onboarding"],
  },
  {
    id: "account-security",
    title: "Account & security",
    description:
      "Manage sign-in, passwords, device access, privacy, blocking, notifications, and account actions.",
    eyebrow: "Account help",
    href: "/settings",
    keywords: ["account", "login", "password", "email", "apple", "google", "security", "block", "settings", "face id"],
  },
  {
    id: "signal-discussions",
    title: "Signal & discussions",
    description:
      "Create structured discussions, use Reality Lenses, reply well, and understand State of the Discussion.",
    eyebrow: "Knowledge help",
    href: "/settings/guide#signal",
    keywords: ["signal", "discussion", "reply", "create", "topic", "reality lens", "state of discussion", "video context"],
  },
  {
    id: "search-ai",
    title: "Search & Loombus AI",
    description:
      "Search authorized Loombus content and use grounded AI answers with source links and clear privacy boundaries.",
    eyebrow: "Find and understand",
    href: "/search",
    keywords: ["search", "search everything", "ask loombus ai", "ai answer", "source", "results", "private room", "saved notes"],
  },
  {
    id: "notifications-messages",
    title: "Notifications & messages",
    description:
      "Use the Signal Inbox, manage alerts and push settings, and work with private conversations.",
    eyebrow: "Communication",
    href: "/notifications",
    keywords: ["notification", "alert", "inbox", "message", "reply", "mention", "push", "private conversation"],
  },
  {
    id: "rooms-community",
    title: "Rooms & community",
    description:
      "Manage private Rooms, membership, invitations, roles, calendars, files, forms, and shared tools.",
    eyebrow: "Room help",
    href: "/rooms",
    keywords: ["room", "private", "member", "invite", "role", "community", "hoa", "calendar", "files", "forms", "polls"],
  },
  {
    id: "local-discovery",
    title: "Local & real-world discovery",
    description:
      "Find businesses, Services, Requests, Jobs, Events, Marketplace listings, and remote opportunities by place and availability.",
    eyebrow: "Discover locally",
    href: "/local",
    keywords: ["local", "distance", "radius", "location", "business", "service", "request", "job", "event", "marketplace", "remote"],
  },
  {
    id: "services-matching",
    title: "Services, appointments & matches",
    description:
      "Publish or find Services and Requests, manage appointment activity, and review compatibility suggestions.",
    eyebrow: "Coordinate work",
    href: "/services",
    keywords: ["services", "requests", "appointments", "matches", "matching", "provider", "inquiry", "booking"],
  },
  {
    id: "marketplace-jobs-events",
    title: "Marketplace, Jobs & Events",
    description:
      "Get help publishing, finding, reviewing, reporting, or managing real-world listings and opportunities.",
    eyebrow: "Directory help",
    href: "/marketplace",
    keywords: ["marketplace", "seller", "buyer", "jobs", "employer", "event", "organizer", "listing", "approval"],
  },
  {
    id: "premium-billing",
    title: "Premium & billing",
    description:
      "Review plans, AI limits, Video Context limits, web or app-store billing, subscriptions, and refunds.",
    eyebrow: "Plan support",
    href: "/premium",
    keywords: ["premium", "billing", "payment", "subscription", "refund", "ai usage", "apple", "app store", "video context"],
  },
  {
    id: "safety-privacy",
    title: "Safety, privacy & rights",
    description:
      "Report harmful behavior, protect personal information, review policies, and raise legal or copyright concerns.",
    eyebrow: "Trust center",
    href: "/safety",
    keywords: ["safety", "privacy", "report", "block", "harassment", "guidelines", "copyright", "dmca", "minor", "teen"],
  },
  {
    id: "accessibility-mobile",
    title: "Accessibility & mobile",
    description:
      "Get help with keyboard or screen-reader access, themes, zoom, media, iOS, Android, and device behavior.",
    eyebrow: "Access help",
    href: "/accessibility",
    keywords: ["accessibility", "mobile", "iphone", "android", "device", "screen reader", "keyboard", "zoom", "contrast"],
  },
];

export const PUBLIC_HELP_ARTICLES: readonly PublicHelpArticle[] = [
  {
    id: "start-using-loombus",
    title: "How to start using Loombus",
    description: "Set up your profile, learn Home and Discussions, follow topics, and create your first contribution.",
    category: "Getting started",
    href: "/settings/guide#getting-started",
    keywords: ["start", "new", "guide", "profile", "home", "onboarding"],
  },
  {
    id: "signal-meaning",
    title: "What Signal means",
    description: "Understand contribution and activity indicators without treating Signal as a popularity or identity score.",
    category: "Signal",
    href: "/settings/guide#signal",
    keywords: ["signal", "score", "views", "replies", "saves", "activity"],
  },
  {
    id: "focused-discussion",
    title: "Create a focused discussion",
    description: "Use a clear title, written context, Topic, Reality Lens, purpose, sources, and supported attachments.",
    category: "Discussions",
    href: "/create",
    keywords: ["create", "discussion", "topic", "title", "post", "reality lens", "video context", "attachment"],
  },
  {
    id: "signal-topics",
    title: "Browse and follow Signal Topics",
    description: "Open topic pages, follow supported alerts, and find focused discussion activity.",
    category: "Topics",
    href: "/topics",
    keywords: ["topic", "follow", "alert", "directory", "signal topics"],
  },
  {
    id: "search-everything",
    title: "Search Everything inside Loombus",
    description: "Search discussions, people, authorized Room content, saved items, files, listings, and platform destinations.",
    category: "Search",
    href: "/search",
    keywords: ["search everything", "search", "room content", "saved", "file", "listing", "results"],
  },
  {
    id: "ask-loombus-ai",
    title: "Use Ask Loombus AI",
    description: "Generate a grounded answer from permitted Loombus sources and open source links to verify the result.",
    category: "AI",
    href: "/search",
    keywords: ["ask loombus ai", "grounded answer", "source links", "privacy", "ai usage", "premium"],
  },
  {
    id: "signal-inbox",
    title: "Use the Signal Inbox",
    description: "Review replies, follows, messages, Room activity, reminders, and system notifications.",
    category: "Notifications",
    href: "/notifications",
    keywords: ["signal inbox", "notification", "unread", "reply", "message", "push"],
  },
  {
    id: "private-rooms",
    title: "Use private Rooms",
    description: "Work with discussions, announcements, calendars, events, files, resources, forms, polls, roles, and members.",
    category: "Rooms",
    href: "/rooms",
    keywords: ["rooms", "private", "calendar", "files", "forms", "roles", "polls", "members"],
  },
  {
    id: "businesses-services",
    title: "Find businesses and Services",
    description: "Browse attributable business profiles and Service offerings, review details, and send supported inquiries.",
    category: "Businesses",
    href: "/businesses",
    keywords: ["business", "services", "provider", "inquiry", "directory", "local"],
  },
  {
    id: "requests",
    title: "Publish or find a Request",
    description: "Describe a service, recommendation, quote, consultation, or community need and connect it to possible providers.",
    category: "Requests",
    href: "/requests",
    keywords: ["request", "need", "quote", "consultation", "help", "provider"],
  },
  {
    id: "intelligent-matches",
    title: "Review Intelligent Matches",
    description: "Open private Request-to-Service and Service-to-Request compatibility suggestions and verify fit independently.",
    category: "Matching",
    href: "/matches",
    keywords: ["matches", "matching", "compatibility", "service", "request", "suggestion"],
  },
  {
    id: "appointments",
    title: "Manage appointment activity",
    description: "Review appointment services and requests, status, timing, and provider communication.",
    category: "Appointments",
    href: "/appointments",
    keywords: ["appointment", "booking", "provider", "request", "schedule", "status"],
  },
  {
    id: "loombus-local",
    title: "Use Loombus Local",
    description: "Filter real-world results by place, radius, type, remote status, event date, and availability.",
    category: "Local",
    href: "/local",
    keywords: ["local", "place", "radius", "distance", "remote", "date", "availability"],
  },
  {
    id: "marketplace-safely",
    title: "Browse Marketplace safely",
    description: "Review attributable sellers and item details, understand Loombus transaction limits, and report suspicious listings.",
    category: "Marketplace",
    href: "/marketplace",
    keywords: ["marketplace", "seller", "buyer", "listing", "item", "fraud", "report"],
  },
  {
    id: "jobs",
    title: "Find or post Jobs",
    description: "Review attributable employer information, job details, remote status, and common recruiting-scam warning signs.",
    category: "Jobs",
    href: "/jobs",
    keywords: ["job", "employer", "hiring", "career", "remote", "application", "scam"],
  },
  {
    id: "events",
    title: "Find or manage Events",
    description: "Review organizer, date, place or remote access, event details, reminders, and safety information.",
    category: "Events",
    href: "/events",
    keywords: ["event", "organizer", "date", "venue", "remote", "reminder", "calendar"],
  },
  {
    id: "premium-ai-video",
    title: "Premium plans, AI limits, and Video Context",
    description: "Review plan access, monthly AI usage, Video Context limits, and current entitlement status.",
    category: "Premium",
    href: "/ai-usage",
    keywords: ["premium", "ai", "usage", "limit", "billing", "plan", "video context"],
  },
  {
    id: "billing-refunds",
    title: "Billing, cancellation, and refunds",
    description: "Identify the purchase channel and follow the correct web or app-store billing process.",
    category: "Billing",
    href: "/refunds",
    keywords: ["billing", "cancel", "refund", "apple", "app store", "subscription", "charge"],
  },
  {
    id: "safety-reporting",
    title: "Safety, blocking, and reporting",
    description: "Use the closest in-product report control, block unwanted contact, and understand emergency limits.",
    category: "Safety",
    href: "/safety",
    keywords: ["safety", "block", "report", "moderation", "harassment", "emergency"],
  },
  {
    id: "privacy-cookies",
    title: "Privacy and Cookie Use",
    description: "Review data categories, Room and message boundaries, search and AI processing, location, billing, and browser storage.",
    category: "Privacy",
    href: "/privacy",
    keywords: ["privacy", "cookies", "data", "location", "search", "ai", "messages", "rooms"],
  },
  {
    id: "accessibility-support",
    title: "Accessibility support",
    description: "Report keyboard, screen-reader, contrast, zoom, motion, media, file, mobile, or third-party barriers.",
    category: "Accessibility",
    href: "/accessibility",
    keywords: ["accessibility", "screen reader", "keyboard", "device", "feedback", "zoom", "contrast"],
  },
  {
    id: "copyright-dmca",
    title: "Copyright and DMCA",
    description: "Submit a copyright notice, counter-notice, or another rights concern with exact content locations.",
    category: "Legal",
    href: "/dmca",
    keywords: ["copyright", "dmca", "takedown", "counter notice", "trademark", "rights"],
  },
];
