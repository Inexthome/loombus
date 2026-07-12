"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Bookmark,
  Bot,
  ChevronDown,
  Clock3,
  Home,
  LayoutDashboard,
  type LucideIcon,
  LogOut,
  MessageCircle,
  MessageSquareReply,
  Search,
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

type DesktopTopNavProfile = {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
};

const centerLinks = [
  { href: "/discussions", label: "Discussions" },
  { href: "/create", label: "Create" },
  { href: "/rooms", label: "Rooms" },
];

function getInitial(profile: DesktopTopNavProfile | null, email: string | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    email?.split("@")[0]?.trim() ||
    "U"
  )
    .charAt(0)
    .toUpperCase();
}

function getDisplayName(profile: DesktopTopNavProfile | null, email: string | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    email?.split("@")[0]?.trim() ||
    "Loombus member"
  );
}

type DropdownItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const discoveryItems: DropdownItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/dashboard", label: "Home Status", icon: LayoutDashboard },
  { href: "/onboarding", label: "Onboarding", icon: Sparkles },
  { href: "/topics", label: "Signal Topics", icon: Tags },
  { href: "/people", label: "People", icon: Users },
  { href: "/following", label: "Following", icon: Activity },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/stickies", label: "Signal Board", icon: StickyNote },
];

const activityItems: DropdownItem[] = [
  { href: "/my-activity", label: "My Activity", icon: Activity },
  { href: "/my-discussions", label: "My Discussions", icon: MessageCircle },
  { href: "/my-replies", label: "My Replies", icon: MessageSquareReply },
  { href: "/reading-history", label: "Reading History", icon: Clock3 },
];

const buildItems: DropdownItem[] = [
  { href: "/labs", label: "Labs", icon: Sparkles },
  { href: "/premium", label: "Premium", icon: Sparkles },
  { href: "/ai-usage", label: "AI Usage", icon: Bot },
];

function DropdownLink({ item }: { item: DropdownItem }) {
  const Icon = item.icon;

  return (
    <Link href={item.href} className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
      <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
      {item.label}
    </Link>
  );
}

function DropdownSection({ title, items }: { title: string; items: DropdownItem[] }) {
  return (
    <section className="py-2">
      <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--loombus-text-subtle)]">
        {title}
      </p>
      <div className="grid gap-0.5">
        {items.map((item) => (
          <DropdownLink key={`${item.href}-${item.label}`} item={item} />
        ))}
      </div>
    </section>
  );
}

export function DesktopTopNavbar() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<DesktopTopNavProfile | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  function isActivePath(href: string) {
    if (href === "/rooms") {
      return pathname === "/rooms" || pathname.startsWith("/rooms/");
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadNavState(nextUserId: string) {
      const [{ data: profileData }, blockedIds] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, full_name, avatar_url, is_admin")
          .eq("id", nextUserId)
          .maybeSingle(),
        getBlockedRelationshipUserIds(supabase, nextUserId),
      ]);

      if (!isMounted) {
        return;
      }

      setProfile((profileData ?? null) as DesktopTopNavProfile | null);

      const { data: notificationRows } = await supabase
        .from("notifications")
        .select("id, actor_id")
        .eq("user_id", nextUserId)
        .is("read_at", null);

      if (isMounted) {
        setNotificationCount(
          filterBlockedActorNotifications(notificationRows ?? [], blockedIds).length
        );
      }
    }

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const nextUser = data.user ?? null;

      if (!isMounted) {
        return;
      }

      setUserId(nextUser?.id ?? null);
      setEmail(nextUser?.email ?? null);

      if (!nextUser?.id) {
        setProfile(null);
        setNotificationCount(0);
        return;
      }

      await loadNavState(nextUser.id);
    }

    loadUser();

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
        return;
      }

      void loadNavState(nextUserId);
    });

    function handleNotificationsChanged() {
      const nextUserId = userId;

      if (nextUserId) {
        void loadNavState(nextUserId);
      }
    }

    window.addEventListener("loombus:notifications-changed", handleNotificationsChanged);

    return () => {
      isMounted = false;
      window.removeEventListener("loombus:notifications-changed", handleNotificationsChanged);
      subscription.unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!userId) {
    return null;
  }

  const displayName = getDisplayName(profile, email);
  const profileHref = profile?.username ? `/u/${profile.username}` : "/profile";
  const accountItems: DropdownItem[] = [
    { href: profileHref, label: "Profile", icon: UserCircle },
    { href: "/privacy-security", label: "Privacy & Security", icon: ShieldCheck },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className="loombus-desktop-top-navbar fixed inset-x-0 top-0 z-[65] hidden h-[72px] border-b border-[var(--loombus-border)] bg-[var(--loombus-surface)]/92 text-[var(--loombus-text)] shadow-xl shadow-black/5 backdrop-blur-xl md:block">
      <div className="mx-auto grid h-full max-w-[92rem] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 lg:px-8">
        <Link
          href="/home"
          aria-label="Loombus home"
          className="flex min-w-0 items-center gap-3 justify-self-start rounded-full pr-3 transition hover:opacity-85"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)]">
            <img
              src="/assets/brand/loombus-mark-transparent.png"
              alt=""
              className="h-7 w-7 object-contain"
            />
          </span>
          <span className="text-lg font-semibold tracking-tight">Loombus</span>
        </Link>

        <nav aria-label="Desktop primary navigation" className="flex items-center justify-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-1">
          {centerLinks.map((link) => {
            const active = isActivePath(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-sm shadow-black/10"
                    : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-strong)] hover:text-[var(--loombus-text)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <Link
            href="/search"
            aria-label="Search Loombus"
            title="Search"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
          >
            <Search aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
          </Link>

          <Link
            href="/notifications"
            aria-label="Notifications"
            title="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
          >
            <Bell aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
            {notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[var(--loombus-primary-bg)] px-1 text-[10px] font-bold text-[var(--loombus-primary-text)] ring-2 ring-[var(--loombus-surface)]">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label="Open profile menu"
              aria-expanded={menuOpen}
              className="flex h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] py-1 pl-1 pr-3 text-[var(--loombus-text)] transition hover:border-[var(--loombus-text-subtle)]"
            >
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] text-sm font-semibold">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{getInitial(profile, email)}</span>
                )}
              </span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 text-[var(--loombus-text-muted)]" strokeWidth={2.1} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-3 flex max-h-[calc(100vh-6rem)] w-80 flex-col overflow-hidden rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-2xl shadow-black/15">
                <div className="shrink-0 border-b border-[var(--loombus-border)] px-4 py-3">
                  <p className="truncate text-sm font-semibold">{displayName}</p>
                  <p className="mt-1 truncate text-xs text-[var(--loombus-text-muted)]">
                    {profile?.username ? `@${profile.username}` : email ?? "Loombus account"}
                  </p>
                </div>

                <div className="min-h-0 overflow-y-auto p-2">
                  <DropdownSection title="Navigation" items={discoveryItems} />
                  <DropdownSection title="Your Signal" items={activityItems} />
                  <DropdownSection title="Tools" items={buildItems} />
                  <DropdownSection title="Account" items={accountItems} />

                  {profile?.is_admin && (
                    <section className="border-t border-[var(--loombus-border)] py-2">
                      <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--loombus-text-subtle)]">
                        Admin
                      </p>
                      <DropdownLink item={{ href: "/admin", label: "Admin", icon: ShieldCheck }} />
                    </section>
                  )}

                  <div className="border-t border-[var(--loombus-border)] pt-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm text-[var(--loombus-text-muted)] transition hover:bg-red-500/10 hover:text-red-500"
                    >
                      <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
