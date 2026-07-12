"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  Bookmark,
  Bot,
  Clock3,
  Edit3,
  Home,
  LayoutDashboard,
  LayoutGrid,
  type LucideIcon,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquareReply,
  Settings,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Tags,
  UserCircle,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";

type MobileMenuProfile = {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
};

type MobileMenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const navigationItems: MobileMenuItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/discussions", label: "Discussions", icon: MessageCircle },
  { href: "/create", label: "Create", icon: Edit3 },
  { href: "/rooms", label: "Rooms", icon: LayoutGrid },
  { href: "/topics", label: "Signal Topics", icon: Tags },
  { href: "/people", label: "People", icon: Users },
  { href: "/following", label: "Following", icon: Activity },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/stickies", label: "Signal Board", icon: StickyNote },
];

const signalItems: MobileMenuItem[] = [
  { href: "/my-activity", label: "My Activity", icon: Activity },
  { href: "/my-discussions", label: "My Discussions", icon: MessageCircle },
  { href: "/my-replies", label: "My Replies", icon: MessageSquareReply },
  { href: "/reading-history", label: "Reading History", icon: Clock3 },
];

const toolItems: MobileMenuItem[] = [
  { href: "/dashboard", label: "Home Status", icon: LayoutDashboard },
  { href: "/onboarding", label: "Onboarding", icon: Sparkles },
  { href: "/labs", label: "Labs", icon: Sparkles },
  { href: "/premium", label: "Premium", icon: Sparkles },
  { href: "/ai-usage", label: "AI Usage", icon: Bot },
];

function getInitial(profile: MobileMenuProfile | null, email: string | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    email?.split("@")[0]?.trim() ||
    "U"
  )
    .charAt(0)
    .toUpperCase();
}

function getDisplayName(profile: MobileMenuProfile | null, email: string | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    email?.split("@")[0]?.trim() ||
    "Loombus member"
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MobileMenuLink({
  item,
  pathname,
  onNavigate,
}: {
  item: MobileMenuItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const active = isActivePath(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`mobile-signal-menu-link ${active ? "is-active" : ""}`}
    >
      <span className="mobile-signal-menu-link-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="mobile-signal-menu-link-label">{item.label}</span>
      {item.badge && <span className="mobile-signal-menu-link-badge">{item.badge}</span>}
    </Link>
  );
}

function MobileMenuSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: MobileMenuItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <section className="mobile-signal-menu-section">
      <p>{title}</p>
      <div className="mobile-signal-menu-grid">
        {items.map((item) => (
          <MobileMenuLink
            key={`${title}-${item.href}`}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}

export function MobileSignalMenu() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<MobileMenuProfile | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadNavigationState(nextUserId: string) {
      const [{ data: profileData }, blockedIds] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, full_name, avatar_url, is_admin")
          .eq("id", nextUserId)
          .maybeSingle(),
        getBlockedRelationshipUserIds(supabase, nextUserId),
      ]);

      if (!mounted) return;

      setProfile((profileData ?? null) as MobileMenuProfile | null);

      const { data: notificationRows } = await supabase
        .from("notifications")
        .select("id, actor_id")
        .eq("user_id", nextUserId)
        .is("read_at", null);

      if (mounted) {
        setNotificationCount(
          filterBlockedActorNotifications(notificationRows ?? [], blockedIds).length
        );
      }
    }

    async function loadCurrentUser() {
      const { data } = await supabase.auth.getUser();
      const nextUser = data.user ?? null;

      if (!mounted) return;

      setUserId(nextUser?.id ?? null);
      setEmail(nextUser?.email ?? null);

      if (!nextUser?.id) {
        setProfile(null);
        setNotificationCount(0);
        return;
      }

      await loadNavigationState(nextUser.id);
    }

    void loadCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      const nextUserId = nextUser?.id ?? null;

      setUserId(nextUserId);
      setEmail(nextUser?.email ?? null);

      if (!nextUserId) {
        setProfile(null);
        setNotificationCount(0);
        setOpen(false);
        return;
      }

      void loadNavigationState(nextUserId);
    });

    function handleNotificationsChanged() {
      if (userId) void loadNavigationState(userId);
    }

    window.addEventListener("loombus:notifications-changed", handleNotificationsChanged);

    return () => {
      mounted = false;
      window.removeEventListener("loombus:notifications-changed", handleNotificationsChanged);
      subscription.unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!userId) return null;

  const profileHref = profile?.username ? `/u/${profile.username}` : "/profile";
  const accountItems: MobileMenuItem[] = profile?.username
    ? [
        { href: profileHref, label: "Public Profile", icon: UserCircle },
        { href: "/profile", label: "Edit Profile", icon: Edit3 },
        { href: "/settings", label: "Settings", icon: Settings },
      ]
    : [
        { href: "/profile", label: "Profile", icon: UserCircle },
        { href: "/settings", label: "Settings", icon: Settings },
      ];
  const signalInboxItem: MobileMenuItem = {
    href: "/notifications",
    label: "Signal Inbox",
    icon: Bell,
    badge: notificationCount > 0 ? (notificationCount > 99 ? "99+" : String(notificationCount)) : undefined,
  };

  return (
    <>
      <div className="mobile-signal-menu-trigger-shell" aria-hidden={open ? "true" : undefined}>
        <div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open updated Signal menu"
            aria-expanded={open}
            aria-controls="mobile-signal-menu-panel"
            className="mobile-signal-menu-trigger"
          >
            <Menu aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && (
        <div className="mobile-signal-menu-backdrop" onClick={() => setOpen(false)}>
          <section
            id="mobile-signal-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Loombus mobile Signal navigation"
            className="mobile-signal-menu-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mobile-signal-menu-header">
              <div className="mobile-signal-menu-identity">
                <span className="mobile-signal-menu-avatar">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" />
                  ) : (
                    getInitial(profile, email)
                  )}
                </span>
                <span className="mobile-signal-menu-name">
                  <strong>{getDisplayName(profile, email)}</strong>
                  <small>{profile?.username ? `@${profile.username}` : "Move with Signal."}</small>
                </span>
              </div>

              <button type="button" onClick={() => setOpen(false)} className="mobile-signal-menu-close">
                Close
              </button>
            </header>

            <div className="mobile-signal-menu-scroll">
              <MobileMenuSection
                title="Navigation"
                items={navigationItems}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />

              <MobileMenuSection
                title="Your Signal"
                items={[signalInboxItem, ...signalItems]}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />

              <MobileMenuSection
                title="Tools"
                items={toolItems}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />

              <MobileMenuSection
                title="Account"
                items={accountItems}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />

              {profile?.is_admin && (
                <MobileMenuSection
                  title="Admin"
                  items={[{ href: "/admin", label: "Admin", icon: ShieldCheck }]}
                  pathname={pathname}
                  onNavigate={() => setOpen(false)}
                />
              )}

              <button type="button" onClick={handleLogout} className="mobile-signal-menu-logout">
                <LogOut aria-hidden="true" />
                <span>Logout</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
