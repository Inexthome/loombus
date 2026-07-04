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
  Rocket,
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
  adminOnly?: boolean;
};

export type V2MenuGroup = {
  title: string;
  items: V2NavItem[];
};

export const V2_PRIMARY_NAV_ITEMS: V2NavItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Discussions", href: "/discussions", icon: MessageCircle },
  { label: "Create", href: "/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/rooms", icon: Users },
  { label: "Messages", href: "/messages", icon: Mail },
  { label: "People", href: "/people", icon: Users },
];

export const V2_TOP_NAV_ITEMS: V2NavItem[] = V2_PRIMARY_NAV_ITEMS.filter(
  (item) => !["Home", "Messages", "People"].includes(item.label)
);

export const V2_ACTION_NAV_ITEMS: V2NavItem[] = [
  { label: "Search", href: "/search", icon: Search },
  { label: "Notifications", href: "/notifications", icon: Bell },
];

export const V2_MENU_GROUPS: V2MenuGroup[] = [
  {
    title: "Main",
    items: [
      { label: "Home", href: "/home", icon: Home },
      { label: "Messages", href: "/messages", icon: Mail },
      { label: "People", href: "/people", icon: Users },
    ],
  },
  {
    title: "Rooms",
    items: [
      { label: "My Rooms", href: "/rooms", icon: Users },
      { label: "Create Room", href: "/create-room", icon: Plus },
    ],
  },
  {
    title: "Discover",
    items: [
      { label: "Labs", href: "/labs", icon: FlaskConical },
      { label: "Topics", href: "/topics", icon: Sparkles },
      { label: "Following", href: "/following", icon: Heart },
    ],
  },
  {
    title: "Library",
    items: [
      { label: "Saved", href: "/saved", icon: Bookmark },
      { label: "Stickies", href: "/stickies", icon: StickyNote },
      { label: "Reading History", href: "/reading-history", icon: Clock3 },
    ],
  },
  {
    title: "My Loombus",
    items: [
      { label: "My Activity", href: "/my-activity", icon: Library },
      { label: "My Discussions", href: "/my-discussions", icon: MessageCircle },
      { label: "My Replies", href: "/my-replies", icon: MessageSquareReply },
      { label: "Profile", href: "/profile", icon: UserCircle },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Onboarding", href: "/onboarding", icon: Rocket },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Premium", href: "/premium", icon: WalletCards },
      { label: "Support", href: "/support", icon: Wrench },
      { label: "Privacy/Security", href: "/privacy-security", icon: LockKeyhole },
      { label: "Admin", href: "/admin", icon: Shield, adminOnly: true },
    ],
  },
];

export const V2_EXACT_ROUTE_MAP: Record<string, string> = {
  "/v2": "/home",
  "/v2/discussions": "/discussions",
  "/v2/create": "/create",
  "/v2/rooms": "/rooms",
  "/v2/create-room": "/create-room",
  "/v2/messages": "/messages",
  "/v2/people": "/people",
  "/v2/labs": "/labs",
  "/v2/topics": "/topics",
  "/v2/following": "/following",
  "/v2/saved": "/saved",
  "/v2/stickies": "/stickies",
  "/v2/reading-history": "/reading-history",
  "/v2/my-activity": "/my-activity",
  "/v2/my-discussions": "/my-discussions",
  "/v2/my-replies": "/my-replies",
  "/v2/profile": "/profile",
  "/v2/settings": "/settings",
  "/v2/premium": "/premium",
  "/v2/support": "/support",
  "/v2/privacy-security": "/privacy-security",
  "/v2/notifications": "/notifications",
  "/v2/search": "/search",
  "/v2/onboarding": "/onboarding",
  "/v2/admin": "/admin",
};

export const V2_DYNAMIC_ROUTE_PREFIXES: Array<{ from: string; to: string }> = [
  { from: "/v2/discussions/", to: "/discussions/" },
  { from: "/v2/people/", to: "/people/" },
  { from: "/v2/rooms/", to: "/rooms/" },
  { from: "/v2/labs/", to: "/labs/" },
  { from: "/v2/topics/", to: "/topics/" },
];
