import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bookmark,
  Clock3,
  FlaskConical,
  Heart,
  Home,
  Library,
  LockKeyhole,
  Mail,
  MessageCircle,
  MessageSquareReply,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  StickyNote,
  UserCircle,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";

export type V2NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
  badge?: string;
};

export type V2MenuGroup = {
  title: string;
  items: V2NavItem[];
};

export const V2_PRIMARY_NAV_ITEMS: V2NavItem[] = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Mail },
  { label: "People", href: "/v2/people", icon: Users },
];

export const V2_TOP_NAV_ITEMS: V2NavItem[] = V2_PRIMARY_NAV_ITEMS.filter(
  (item) => !["Home", "Messages", "People"].includes(item.label)
);

export const V2_ACTION_NAV_ITEMS: V2NavItem[] = [
  { label: "Search", href: "/v2/search", icon: Search },
  { label: "Notifications", href: "/v2/notifications", icon: Bell },
];

export const V2_MENU_GROUPS: V2MenuGroup[] = [
  {
    title: "Main",
    items: [
      { label: "Home", href: "/v2", icon: Home },
      { label: "Messages", href: "/v2/messages", icon: Mail },
      { label: "People", href: "/v2/people", icon: Users },
    ],
  },
  {
    title: "Discover",
    items: [
      { label: "Labs", href: "/v2/labs", icon: FlaskConical },
      { label: "Topics", href: "/v2/topics", icon: Sparkles },
      { label: "Following", href: "/v2/following", icon: Heart },
    ],
  },
  {
    title: "Library",
    items: [
      { label: "Saved", href: "/v2/saved", icon: Bookmark },
      { label: "Stickies", href: "/v2/stickies", icon: StickyNote },
      { label: "Reading History", href: "/v2/reading-history", icon: Clock3 },
    ],
  },
  {
    title: "My Loombus",
    items: [
      { label: "My Activity", href: "/v2/my-activity", icon: Library },
      { label: "My Discussions", href: "/v2/my-discussions", icon: MessageCircle },
      { label: "My Replies", href: "/v2/my-replies", icon: MessageSquareReply },
      { label: "Profile", href: "/v2/profile", icon: UserCircle },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Notifications", href: "/v2/notifications", icon: Bell },
      { label: "Settings", href: "/v2/settings", icon: Settings },
      { label: "Premium", href: "/v2/premium", icon: WalletCards },
      { label: "Support", href: "/v2/support", icon: Wrench },
      { label: "Privacy/Security", href: "/v2/privacy-security", icon: LockKeyhole },
      { label: "Admin", href: "/v2/admin", icon: Shield },
    ],
  },
];

export const V2_EXACT_ROUTE_MAP: Record<string, string> = {
  "/": "/v2",
  "/home": "/v2",
  "/discussions": "/v2/discussions",
  "/create": "/v2/create",
  "/rooms": "/v2/rooms",
  "/messages": "/v2/messages",
  "/people": "/v2/people",
  "/labs": "/v2/labs",
  "/topics": "/v2/topics",
  "/following": "/v2/following",
  "/saved": "/v2/saved",
  "/stickies": "/v2/stickies",
  "/reading-history": "/v2/reading-history",
  "/my-activity": "/v2/my-activity",
  "/my-discussions": "/v2/my-discussions",
  "/my-replies": "/v2/my-replies",
  "/profile": "/v2/profile",
  "/settings": "/v2/settings",
  "/premium": "/v2/premium",
  "/support": "/v2/support",
  "/privacy-security": "/v2/privacy-security",
  "/notifications": "/v2/notifications",
  "/search": "/v2/search",
  "/onboarding": "/v2/onboarding",
  "/admin": "/v2/admin",
};

export const V2_DYNAMIC_ROUTE_PREFIXES: Array<{ from: string; to: string }> = [
  { from: "/discussions/", to: "/v2/discussions/" },
  { from: "/people/", to: "/v2/people/" },
  { from: "/rooms/", to: "/v2/rooms/" },
  { from: "/labs/", to: "/v2/labs/" },
  { from: "/topics/", to: "/v2/topics/" },
];
