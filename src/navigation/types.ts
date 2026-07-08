export type NavigationAudience = "public" | "authenticated" | "admin";

export type NavigationSurface =
  | "desktop"
  | "mobile"
  | "bottom"
  | "utility"
  | "admin";

export type NavigationItemId =
  | "home"
  | "discussions"
  | "create"
  | "search"
  | "people"
  | "following"
  | "saved"
  | "messages"
  | "notifications"
  | "rooms"
  | "stickies"
  | "labs"
  | "profile"
  | "my-activity"
  | "my-discussions"
  | "my-replies"
  | "reading-history"
  | "premium"
  | "settings"
  | "support"
  | "privacy-security"
  | "admin";

export type NavigationItem = {
  id: NavigationItemId;
  label: string;
  href: string;
  description: string;
  audience: NavigationAudience;
  surfaces: NavigationSurface[];
  keywords: string[];
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
};
