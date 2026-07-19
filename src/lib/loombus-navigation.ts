export type LoombusNavigationIcon =
  | "activity"
  | "appointments"
  | "businesses"
  | "calendar"
  | "dashboard"
  | "events"
  | "following"
  | "guide"
  | "history"
  | "home"
  | "jobs"
  | "labs"
  | "local"
  | "marketplace"
  | "matches"
  | "messages"
  | "my-discussions"
  | "my-replies"
  | "people"
  | "premium"
  | "profile"
  | "privacy"
  | "requests"
  | "rooms"
  | "saved"
  | "search"
  | "services"
  | "settings"
  | "signal-board"
  | "support"
  | "topics"
  | "usage";

export type LoombusNavigationItem = {
  href: string;
  label: string;
  description: string;
  icon: LoombusNavigationIcon;
};

export type LoombusNavigationSection = {
  title: string;
  items: readonly LoombusNavigationItem[];
};

export const EXPLORE_NAVIGATION_SECTIONS: readonly LoombusNavigationSection[] = [
  {
    title: "Discover",
    items: [
      {
        href: "/home",
        label: "Home",
        description: "Open your personal Loombus signal hub.",
        icon: "home",
      },
      {
        href: "/search",
        label: "Search Everything",
        description: "Find authorized content, people, Rooms, files, and platform destinations.",
        icon: "search",
      },
      {
        href: "/topics",
        label: "Topics",
        description: "Browse focused subject areas and Topic Signal pages.",
        icon: "topics",
      },
      {
        href: "/people",
        label: "People",
        description: "Find members, profiles, followers, and connections.",
        icon: "people",
      },
      {
        href: "/following",
        label: "Following",
        description: "See discussions and activity from people you follow.",
        icon: "following",
      },
      {
        href: "/rooms",
        label: "Rooms",
        description: "Open private spaces for coordination, files, calendars, and conversation.",
        icon: "rooms",
      },
      {
        href: "/labs",
        label: "Loombus Labs",
        description: "Explore experiments and help shape future platform capabilities.",
        icon: "labs",
      },
    ],
  },
  {
    title: "Local & Opportunities",
    items: [
      {
        href: "/local",
        label: "Local",
        description: "Discover nearby and remote opportunities across Loombus.",
        icon: "local",
      },
      {
        href: "/businesses",
        label: "Businesses",
        description: "Browse attributable organizations and business profiles.",
        icon: "businesses",
      },
      {
        href: "/services",
        label: "Services",
        description: "Find providers, offerings, and appointment-ready services.",
        icon: "services",
      },
      {
        href: "/requests",
        label: "Requests",
        description: "Find needs, quotes, consultations, and community help.",
        icon: "requests",
      },
      {
        href: "/jobs",
        label: "Jobs",
        description: "Browse approved roles connected to attributable employers.",
        icon: "jobs",
      },
      {
        href: "/events",
        label: "Events",
        description: "Find public, local, and remote events by date and organizer.",
        icon: "events",
      },
      {
        href: "/marketplace",
        label: "Marketplace",
        description: "Browse approved listings from attributable Loombus sellers.",
        icon: "marketplace",
      },
    ],
  },
  {
    title: "Organize & Connect",
    items: [
      {
        href: "/messages",
        label: "Messages",
        description: "Open private conversations with supported connections.",
        icon: "messages",
      },
      {
        href: "/calendar",
        label: "Calendar",
        description: "Review appointments, Events, Room dates, and scheduled activity.",
        icon: "calendar",
      },
      {
        href: "/appointments",
        label: "Appointments",
        description: "Manage service bookings, requests, timing, and status.",
        icon: "appointments",
      },
      {
        href: "/matches",
        label: "Intelligent Matching",
        description: "Review private compatibility suggestions for Requests and Services.",
        icon: "matches",
      },
      {
        href: "/saved",
        label: "Saved",
        description: "Return to discussions and resources worth keeping.",
        icon: "saved",
      },
      {
        href: "/stickies",
        label: "Signal Board",
        description: "Open your private board of pinned discussion cards.",
        icon: "signal-board",
      },
    ],
  },
];

export const ACCOUNT_NAVIGATION_SECTIONS: readonly LoombusNavigationSection[] = [
  {
    title: "Your Account",
    items: [
      {
        href: "/dashboard",
        label: "My Dashboard",
        description: "Review your private account snapshot and contribution activity.",
        icon: "dashboard",
      },
      {
        href: "/my-activity",
        label: "My Activity",
        description: "Review your recent activity across Loombus.",
        icon: "activity",
      },
      {
        href: "/my-discussions",
        label: "My Discussions",
        description: "Open discussions you created.",
        icon: "my-discussions",
      },
      {
        href: "/my-replies",
        label: "My Replies",
        description: "Review replies you contributed.",
        icon: "my-replies",
      },
      {
        href: "/reading-history",
        label: "Reading History",
        description: "Return to discussions you recently viewed.",
        icon: "history",
      },
    ],
  },
  {
    title: "Plan & Preferences",
    items: [
      {
        href: "/settings",
        label: "Settings",
        description: "Manage account, notifications, and appearance.",
        icon: "settings",
      },
      {
        href: "/privacy-security",
        label: "Privacy & Security",
        description: "Manage privacy, safety, and account protection.",
        icon: "privacy",
      },
      {
        href: "/premium",
        label: "Premium",
        description: "Review Loombus subscription options.",
        icon: "premium",
      },
      {
        href: "/ai-usage",
        label: "AI Usage",
        description: "Review AI access, limits, and usage.",
        icon: "usage",
      },
    ],
  },
  {
    title: "Help",
    items: [
      {
        href: "/guide",
        label: "Loombus Guide",
        description: "Learn how the platform and its major areas work.",
        icon: "guide",
      },
      {
        href: "/support",
        label: "Support",
        description: "Get help or contact Loombus Support.",
        icon: "support",
      },
    ],
  },
];
