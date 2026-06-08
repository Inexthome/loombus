"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Bell,
  Bookmark,
  Edit3,
  Home,
  LayoutDashboard,
  LogOut,
  FlaskConical,
  Menu,
  MessageCircle,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  StickyNote,
  UserCircle,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";

type NavProfile = {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
};

type FloatingConversation = {
  id: string;
  otherUserId: string | null;
  otherUsername: string | null;
  otherFullName: string | null;
  otherAvatarUrl: string | null;
  hasUnread: boolean;
  mutedAt: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
};

type FloatingMessageAttachment = {
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

type FloatingThreadMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedBySender: boolean;
  readByRecipientAt: string | null;
  attachments?: FloatingMessageAttachment[];
};

type FloatingPeopleSearchResult = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

const RIGHT_RAIL_WIDTH_STORAGE_KEY = "loombus:right-rail-width";

const FLOATING_ATTACHMENT_BUCKET = "message-attachments";
const FLOATING_MAX_ATTACHMENT_FILES = 3;
const FLOATING_MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const FLOATING_ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function formatFloatingAttachmentFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getFloatingSafeAttachmentFileName(fileName: string) {
  return fileName.trim().replace(/[\\/]/g, "-").slice(0, 120);
}


type DiscussionFeedMode = "all" | "following" | "signal";
const DEFAULT_RIGHT_RAIL_WIDTH = 320;
const MIN_RIGHT_RAIL_WIDTH = 280;
const MAX_RIGHT_RAIL_WIDTH = 480;

function clampRightRailWidth(width: number) {
  return Math.min(MAX_RIGHT_RAIL_WIDTH, Math.max(MIN_RIGHT_RAIL_WIDTH, width));
}

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, setUser] = useState<any>(null);
  const [navProfile, setNavProfile] = useState<NavProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [floatingMessagesOpen, setFloatingMessagesOpen] = useState(false);
  const [floatingMessageSearch, setFloatingMessageSearch] = useState("");
  const [floatingConversations, setFloatingConversations] = useState<FloatingConversation[]>([]);
  const [floatingMessagesLoading, setFloatingMessagesLoading] = useState(false);
  const [floatingMessagesMessage, setFloatingMessagesMessage] = useState("");
  const [selectedFloatingConversationId, setSelectedFloatingConversationId] = useState<string | null>(null);
  const [floatingThreadMessages, setFloatingThreadMessages] = useState<FloatingThreadMessage[]>([]);
  const [floatingThreadLoading, setFloatingThreadLoading] = useState(false);
  const [floatingComposerText, setFloatingComposerText] = useState("");
  const [floatingSending, setFloatingSending] = useState(false);
  const [floatingTypingUserName, setFloatingTypingUserName] = useState("");
  const [floatingAttachmentFiles, setFloatingAttachmentFiles] = useState<File[]>([]);
  const [floatingAttachmentMessage, setFloatingAttachmentMessage] = useState("");
  const [floatingNewMessageOpen, setFloatingNewMessageOpen] = useState(false);
  const [floatingPeopleSearchResults, setFloatingPeopleSearchResults] = useState<FloatingPeopleSearchResult[]>([]);
  const [floatingPeopleSearchLoading, setFloatingPeopleSearchLoading] = useState(false);
  const [floatingStartingConversationId, setFloatingStartingConversationId] = useState<string | null>(null);
  const [bottomNavHidden, setBottomNavHidden] = useState(false);
  const [topNavHidden, setTopNavHidden] = useState(false);
  const [rightRailWidth, setRightRailWidth] = useState(DEFAULT_RIGHT_RAIL_WIDTH);
  const [rightRailResizing, setRightRailResizing] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const loadingNotificationCountRef = useRef(false);
  const lastNotificationLoadRef = useRef<{ userId: string; loadedAt: number } | null>(null);
  const floatingTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFloatingTypingSentRef = useRef(0);
  const rightRailDragStartRef = useRef<{ pointerX: number; width: number } | null>(null);
  const pathname = usePathname();
  const isDiscussionsIndex = pathname === "/discussions";
  const [mobileDiscussionFeed, setMobileDiscussionFeed] =
    useState<DiscussionFeedMode>("all");
  const hasDesktopRightRail =
    [
      "/discussions",
      "/search",
      "/people",
      "/saved",
      "/notifications",
      "/create",
    ].includes(pathname) || pathname.startsWith("/discussions/");

  function isActivePath(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function navLinkClass(href: string) {
    return isActivePath(href)
      ? "text-[var(--loombus-text)] transition hover:text-[var(--loombus-text)]"
      : "text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]";
  }

  function mobileNavLinkClass(href: string) {
    return isActivePath(href)
      ? "loombus-mobile-menu-link-active rounded-2xl border px-4 py-3 text-sm font-medium transition"
      : "loombus-mobile-menu-link-inactive rounded-2xl border px-4 py-3 text-sm font-medium transition";
  }

  function appTabClass(href: string) {
    const active =
      pathname === href || (href !== "/" && pathname.startsWith(href));

    return `flex min-w-0 items-center justify-center rounded-[1.1rem] border px-2 py-3 transition ${
      active
        ? "loombus-mobile-bottom-tab-active"
        : "loombus-mobile-bottom-tab-inactive"
    }`;
  }

  function desktopRailLinkClass(href: string, emphasis = false) {
    const active = isActivePath(href);

    if (emphasis) {
      return active
        ? "group relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-2xl shadow-black/10 transition"
        : "group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]";
    }

    return active
      ? "group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--loombus-text-subtle)] bg-[var(--loombus-surface-muted)] text-[var(--loombus-text)] shadow-xl shadow-black/10 transition"
      : "group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-transparent text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-border)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]";
  }

  function DesktopRailTooltip({ label }: { label: string }) {
    return (
      <span className="pointer-events-none absolute left-[3.65rem] z-50 whitespace-nowrap rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-1.5 text-xs text-[var(--loombus-text)] opacity-0 shadow-2xl shadow-black/10 transition group-hover:opacity-100">
        {label}
      </span>
    );
  }

  function appMenuButtonClass() {
    return `flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 text-[11px] font-medium transition ${
      mobileMenuOpen
        ? "border-[var(--loombus-primary-bg)] bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-lg shadow-black/10"
        : "border-transparent text-[var(--loombus-text-muted)] hover:border-[var(--loombus-border)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
    }`;
  }

  function MobileNavIcon({ name }: { name: "home" | "discuss" | "create" | "people" | "alerts" }) {
    const iconClass = "h-[1.35rem] w-[1.35rem]";
    const strokeWidth = 2.05;

    if (name === "home") {
      return <Home aria-hidden="true" className={iconClass} strokeWidth={strokeWidth} />;
    }

    if (name === "discuss") {
      return <MessageCircle aria-hidden="true" className={iconClass} strokeWidth={strokeWidth} />;
    }

    if (name === "create") {
      return <Edit3 aria-hidden="true" className={iconClass} strokeWidth={strokeWidth} />;
    }

    if (name === "people") {
      return <Users aria-hidden="true" className={iconClass} strokeWidth={strokeWidth} />;
    }

    return <Bell aria-hidden="true" className={iconClass} strokeWidth={strokeWidth} />;
  }

  async function loadNotificationCount(
    userId: string,
    options: { force?: boolean } = {}
  ) {
    const now = Date.now();
    const recentLoad = lastNotificationLoadRef.current;

    if (
      !options.force &&
      recentLoad?.userId === userId &&
      now - recentLoad.loadedAt < 3000
    ) {
      return;
    }

    if (loadingNotificationCountRef.current) {
      return;
    }

    loadingNotificationCountRef.current = true;

    try {
      const blockedRelationshipUserIds = await getBlockedRelationshipUserIds(
        supabase,
        userId
      );

      const { data } = await supabase
        .from("notifications")
        .select("id, actor_id")
        .eq("user_id", userId)
        .is("read_at", null);

      setNotificationCount(
        filterBlockedActorNotifications(data ?? [], blockedRelationshipUserIds).length
      );

      lastNotificationLoadRef.current = {
        userId,
        loadedAt: Date.now(),
      };
    } finally {
      loadingNotificationCountRef.current = false;
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAdminStatus(userId: string) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url, is_admin")
          .eq("id", userId)
          .single();

        if (isMounted && currentUserIdRef.current === userId) {
          setNavProfile((profile ?? null) as NavProfile | null);
          setIsAdmin(Boolean(profile?.is_admin));
        }
      } catch (error) {
        console.error("Unable to load admin status.", error);

        if (isMounted && currentUserIdRef.current === userId) {
          setIsAdmin(false);
        }
      }
    }

    async function refreshAuthenticatedNavState(
      userId: string,
      options: { forceNotifications?: boolean } = {}
    ) {
      await Promise.allSettled([
        loadNotificationCount(userId, {
          force: Boolean(options.forceNotifications),
        }),
        loadAdminStatus(userId),
      ]);
    }

    async function loadUser() {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id ?? null;

        if (!isMounted) {
          return;
        }

        currentUserIdRef.current = userId;
        setUser(data.user ?? null);

        if (!userId) {
          setNotificationCount(0);
          setNavProfile(null);
          setIsAdmin(false);
          lastNotificationLoadRef.current = null;
          return;
        }

        await refreshAuthenticatedNavState(userId);
      } catch (error) {
        console.error("Unable to load layout auth state.", error);

        if (isMounted) {
          currentUserIdRef.current = null;
          setUser(null);
          setNotificationCount(0);
          setNavProfile(null);
          setIsAdmin(false);
          lastNotificationLoadRef.current = null;
        }
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      const previousUserId = currentUserIdRef.current;

      currentUserIdRef.current = nextUserId;
      setUser(session?.user ?? null);

      if (!nextUserId) {
        setNotificationCount(0);
        setIsAdmin(false);
        lastNotificationLoadRef.current = null;
        return;
      }

      if (nextUserId !== previousUserId) {
        setTimeout(() => {
          void refreshAuthenticatedNavState(nextUserId, {
            forceNotifications: true,
          });
        }, 0);
      }
    });

    function handleNotificationsChanged() {
      const userId = currentUserIdRef.current;

      if (userId) {
        setTimeout(() => {
          void loadNotificationCount(userId, { force: true });
        }, 0);
      } else {
        setNotificationCount(0);
      }
    }

    window.addEventListener(
      "loombus:notifications-changed",
      handleNotificationsChanged
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        "loombus:notifications-changed",
        handleNotificationsChanged
      );
      subscription.unsubscribe();
    };
  }, []);

  function selectMobileDiscussionFeed(feed: DiscussionFeedMode) {
    setMobileDiscussionFeed(feed);

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (feed === "all") {
      params.delete("feed");
    } else {
      params.set("feed", feed);
    }

    params.delete("topic");
    params.delete("purpose");

    const queryString = params.toString();
    const nextUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState(null, "", nextUrl);

    window.dispatchEvent(
      new CustomEvent("loombus:discussion-feed", {
        detail: { feed },
      })
    );
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function closeMoreMenu() {
    setMoreMenuOpen(false);
  }

  useEffect(() => {
    const storedWidth = Number(window.localStorage.getItem(RIGHT_RAIL_WIDTH_STORAGE_KEY));

    if (Number.isFinite(storedWidth) && storedWidth > 0) {
      setRightRailWidth(clampRightRailWidth(storedWidth));
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--loombus-right-rail-width",
      `${rightRailWidth}px`
    );

    window.localStorage.setItem(
      RIGHT_RAIL_WIDTH_STORAGE_KEY,
      String(rightRailWidth)
    );
  }, [rightRailWidth]);

  function startRightRailResize(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    rightRailDragStartRef.current = {
      pointerX: event.clientX,
      width: rightRailWidth,
    };

    setRightRailResizing(true);
  }

  function adjustRightRailWidth(delta: number) {
    setRightRailWidth((current) => clampRightRailWidth(current + delta));
  }

  useEffect(() => {
    if (!rightRailResizing) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const dragStart = rightRailDragStartRef.current;

      if (!dragStart) {
        return;
      }

      const delta = dragStart.pointerX - event.clientX;
      setRightRailWidth(clampRightRailWidth(dragStart.width + delta));
    }

    function handleMouseUp() {
      rightRailDragStartRef.current = null;
      setRightRailResizing(false);
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [rightRailResizing]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!user) {
      setBottomNavHidden(false);
      return;
    }

    function getScrollY() {
      return (
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      );
    }

    let lastScrollY = getScrollY();
    let touchStartY: number | null = null;
    let ticking = false;

    function setNavVisibilityFromDelta(currentScrollY: number, scrollDelta: number) {
      if (mobileMenuOpen || currentScrollY < 80) {
        setTopNavHidden(false);
        setBottomNavHidden(false);
        return;
      }

      if (scrollDelta > 8) {
        setTopNavHidden(true);
        setBottomNavHidden(true);
      } else if (scrollDelta < -8) {
        setTopNavHidden(false);
        setBottomNavHidden(false);
      }
    }

    function updateBottomNavVisibility() {
      const currentScrollY = getScrollY();
      const scrollDelta = currentScrollY - lastScrollY;

      setNavVisibilityFromDelta(currentScrollY, scrollDelta);

      lastScrollY = currentScrollY;
      ticking = false;
    }

    function handleScroll() {
      if (!ticking) {
        window.requestAnimationFrame(updateBottomNavVisibility);
        ticking = true;
      }
    }

    function handleTouchStart(event: TouchEvent) {
      touchStartY = event.touches[0]?.clientY ?? null;
    }

    function handleTouchMove(event: TouchEvent) {
      if (touchStartY === null) {
        return;
      }

      const currentTouchY = event.touches[0]?.clientY ?? touchStartY;
      const touchDelta = touchStartY - currentTouchY;
      const currentScrollY = getScrollY();

      setNavVisibilityFromDelta(currentScrollY, touchDelta);
    }

    function handleTouchEnd() {
      lastScrollY = getScrollY();
      touchStartY = null;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [mobileMenuOpen, user]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!moreMenuRef.current) {
        return;
      }

      if (!moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);

    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  function getFloatingConversationName(conversation: FloatingConversation) {
    return (
      conversation.otherFullName?.trim() ||
      conversation.otherUsername?.trim() ||
      "Loombus member"
    );
  }

  function getFloatingConversationInitial(conversation: FloatingConversation) {
    return getFloatingConversationName(conversation).charAt(0).toUpperCase();
  }

  async function loadMessageUnreadCount() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";

    if (!accessToken) {
      setMessageUnreadCount(0);
      return;
    }

    try {
      const response = await fetch("/api/messages/unread-count", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        setMessageUnreadCount(Number(payload.unreadCount ?? 0));
      }
    } catch {
      // Keep the last known unread count.
    }
  }

  async function loadFloatingConversations() {
    if (floatingMessagesLoading) {
      return;
    }

    setFloatingMessagesLoading(true);
    setFloatingMessagesMessage("");

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";

    if (!accessToken) {
      setFloatingMessagesLoading(false);
      setFloatingMessagesMessage("Log in to view messages.");
      return;
    }

    try {
      const response = await fetch("/api/messages/conversations", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFloatingMessagesMessage(payload.error ?? "Unable to load messages.");
        setFloatingMessagesLoading(false);
        return;
      }

      setFloatingConversations((payload.conversations ?? []) as FloatingConversation[]);
    } catch {
      setFloatingMessagesMessage("Unable to load messages.");
    }

    setFloatingMessagesLoading(false);
  }

  useEffect(() => {
    if (!user) {
      setMessageUnreadCount(0);
      return;
    }

    loadMessageUnreadCount();

    const unreadInterval = window.setInterval(() => {
      loadMessageUnreadCount();
    }, 15000);

    return () => {
      window.clearInterval(unreadInterval);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !floatingMessagesOpen) {
      return;
    }

    loadMessageUnreadCount();
    loadFloatingConversations();
  }, [user, floatingMessagesOpen]);

  useEffect(() => {
    function handleMessagesChanged() {
      if (!user) {
        return;
      }

      loadMessageUnreadCount();

      if (floatingMessagesOpen) {
        loadFloatingConversations();

        if (selectedFloatingConversationId) {
          loadFloatingThread(selectedFloatingConversationId);
        }
      }
    }

    window.addEventListener("loombus:messages-changed", handleMessagesChanged);

    return () => {
      window.removeEventListener("loombus:messages-changed", handleMessagesChanged);
    };
  }, [user, floatingMessagesOpen, selectedFloatingConversationId]);

  useEffect(() => {
    if (!user || !floatingMessagesOpen) {
      return;
    }

    const refreshInterval = window.setInterval(() => {
      loadMessageUnreadCount();
      loadFloatingConversations();

      if (selectedFloatingConversationId) {
        loadFloatingThread(selectedFloatingConversationId);
      }
    }, 15000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, [user, floatingMessagesOpen, selectedFloatingConversationId]);

  useEffect(() => {
    if (!user || !floatingMessagesOpen || !selectedFloatingConversationId) {
      return;
    }

    const channel = supabase.channel(`floating-message-realtime:${selectedFloatingConversationId}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `conversation_id=eq.${selectedFloatingConversationId}`,
        },
        () => {
          loadFloatingThread(selectedFloatingConversationId);
          loadFloatingConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, floatingMessagesOpen, selectedFloatingConversationId]);

  useEffect(() => {
    if (!user || !selectedFloatingConversationId) {
      setFloatingTypingUserName("");
      return;
    }

    const channel = supabase.channel(`private-message-typing:${selectedFloatingConversationId}`);

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.userId === user.id) {
          return;
        }

        setFloatingTypingUserName(String(payload.name ?? "Someone"));

        if (floatingTypingTimeoutRef.current) {
          clearTimeout(floatingTypingTimeoutRef.current);
        }

        floatingTypingTimeoutRef.current = setTimeout(() => {
          setFloatingTypingUserName("");
        }, 4000);
      })
      .subscribe();

    return () => {
      if (floatingTypingTimeoutRef.current) {
        clearTimeout(floatingTypingTimeoutRef.current);
      }

      supabase.removeChannel(channel);
    };
  }, [user, selectedFloatingConversationId]);

  useEffect(() => {
    if (!user || !floatingMessagesOpen || !floatingNewMessageOpen) {
      return;
    }

    const query = floatingMessageSearch.trim();

    if (query.length < 2) {
      setFloatingPeopleSearchResults([]);
      setFloatingPeopleSearchLoading(false);
      return;
    }

    let cancelled = false;

    async function searchFloatingPeople() {
      setFloatingPeopleSearchLoading(true);

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? "";

      if (!accessToken) {
        setFloatingPeopleSearchResults([]);
        setFloatingPeopleSearchLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/messages/people-search?q=${encodeURIComponent(query)}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const payload = await response.json().catch(() => ({}));

        if (!cancelled) {
          setFloatingPeopleSearchResults(
            response.ok ? ((payload.people ?? []) as FloatingPeopleSearchResult[]) : []
          );
        }
      } catch {
        if (!cancelled) {
          setFloatingPeopleSearchResults([]);
        }
      }

      if (!cancelled) {
        setFloatingPeopleSearchLoading(false);
      }
    }

    const timeoutId = window.setTimeout(searchFloatingPeople, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [user, floatingMessagesOpen, floatingNewMessageOpen, floatingMessageSearch]);

  function openFloatingNewMessage() {
    setSelectedFloatingConversationId(null);
    setFloatingThreadMessages([]);
    setFloatingComposerText("");
    setFloatingMessagesMessage("");
    setFloatingMessageSearch("");
    setFloatingNewMessageOpen(true);
  }

  function closeFloatingNewMessage() {
    setFloatingNewMessageOpen(false);
    setFloatingMessageSearch("");
    setFloatingPeopleSearchResults([]);
    setFloatingPeopleSearchLoading(false);
    setFloatingStartingConversationId(null);
    setFloatingMessagesMessage("");
  }

  function getFloatingPersonName(person: FloatingPeopleSearchResult) {
    return person.fullName?.trim() || person.username?.trim() || "Loombus member";
  }

  function getFloatingPersonInitial(person: FloatingPeopleSearchResult) {
    return getFloatingPersonName(person).charAt(0).toUpperCase();
  }

  async function startFloatingConversation(person: FloatingPeopleSearchResult) {
    if (floatingStartingConversationId) {
      return;
    }

    setFloatingStartingConversationId(person.id);
    setFloatingMessagesMessage("");

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";

    if (!accessToken) {
      setFloatingStartingConversationId(null);
      setFloatingMessagesMessage("Log in to start messages.");
      return;
    }

    try {
      const response = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          targetUserId: person.id,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFloatingMessagesMessage(payload.error ?? "Unable to start conversation.");
        setFloatingStartingConversationId(null);
        return;
      }

      const conversationId = String(payload.conversationId ?? "");

      if (!conversationId) {
        setFloatingMessagesMessage("Unable to start conversation.");
        setFloatingStartingConversationId(null);
        return;
      }

      setFloatingConversations((current) => {
        if (current.some((conversation) => conversation.id === conversationId)) {
          return current;
        }

        return [
          {
            id: conversationId,
            otherUserId: person.id,
            otherUsername: person.username,
            otherFullName: person.fullName,
            otherAvatarUrl: person.avatarUrl,
            hasUnread: false,
            mutedAt: null,
            lastMessagePreview: null,
            lastMessageAt: null,
          },
          ...current,
        ];
      });

      closeFloatingNewMessage();
      setSelectedFloatingConversationId(conversationId);
      await loadFloatingConversations();
      await loadFloatingThread(conversationId);
    } catch {
      setFloatingMessagesMessage("Unable to start conversation.");
    }

    setFloatingStartingConversationId(null);
  }

  const filteredFloatingConversations = floatingConversations.filter((conversation) => {
    const query = floatingMessageSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      getFloatingConversationName(conversation).toLowerCase().includes(query) ||
      (conversation.otherUsername ?? "").toLowerCase().includes(query) ||
      (conversation.lastMessagePreview ?? "").toLowerCase().includes(query)
    );
  });

  const floatingConversationUnreadCount = floatingConversations.filter(
    (conversation) => conversation.hasUnread
  ).length;
  const floatingUnreadCount = Math.max(
    messageUnreadCount,
    floatingConversationUnreadCount
  );

  const selectedFloatingConversation = selectedFloatingConversationId
    ? floatingConversations.find((conversation) => conversation.id === selectedFloatingConversationId) ?? null
    : null;

  function closeFloatingThread() {
    setSelectedFloatingConversationId(null);
    setFloatingThreadMessages([]);
    setFloatingComposerText("");
    setFloatingTypingUserName("");
    setFloatingAttachmentFiles([]);
    setFloatingAttachmentMessage("");
    setFloatingMessagesMessage("");
  }

  async function loadFloatingThread(conversationId: string) {
    setFloatingThreadLoading(true);
    setFloatingMessagesMessage("");

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";

    if (!accessToken) {
      setFloatingThreadLoading(false);
      setFloatingMessagesMessage("Log in to view messages.");
      return;
    }

    try {
      const response = await fetch(
        `/api/messages/thread?id=${encodeURIComponent(conversationId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFloatingThreadMessages([]);
        setFloatingMessagesMessage(payload.error ?? "Unable to load conversation.");
        setFloatingThreadLoading(false);
        return;
      }

      setFloatingThreadMessages((payload.messages ?? []) as FloatingThreadMessage[]);

      await fetch("/api/messages/mark-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          conversationId,
        }),
      });

      setFloatingConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, hasUnread: false }
            : conversation
        )
      );

      await loadMessageUnreadCount();
      window.dispatchEvent(new Event("loombus:messages-changed"));
    } catch {
      setFloatingThreadMessages([]);
      setFloatingMessagesMessage("Unable to load conversation.");
    }

    setFloatingThreadLoading(false);
  }

  async function openFloatingConversation(conversationId: string) {
    closeFloatingNewMessage();
    setSelectedFloatingConversationId(conversationId);
    setFloatingComposerText("");
    setFloatingTypingUserName("");
    setFloatingAttachmentFiles([]);
    setFloatingAttachmentMessage("");
    await loadFloatingThread(conversationId);
  }

  function handleFloatingAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    setFloatingAttachmentMessage("");

    if (selectedFiles.length === 0) {
      setFloatingAttachmentFiles([]);
      return;
    }

    if (selectedFiles.length > FLOATING_MAX_ATTACHMENT_FILES) {
      setFloatingAttachmentFiles([]);
      setFloatingAttachmentMessage("You can attach up to 3 files.");
      event.target.value = "";
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) =>
        !FLOATING_ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type) ||
        file.size <= 0 ||
        file.size > FLOATING_MAX_ATTACHMENT_SIZE_BYTES
    );

    if (invalidFile) {
      setFloatingAttachmentFiles([]);
      setFloatingAttachmentMessage("Attachments must be JPG, PNG, WebP, GIF, or PDF files up to 10 MB each.");
      event.target.value = "";
      return;
    }

    setFloatingAttachmentFiles(selectedFiles);
    setFloatingAttachmentMessage(`${selectedFiles.length} attachment${selectedFiles.length === 1 ? "" : "s"} ready.`);
  }

  function clearFloatingAttachments() {
    setFloatingAttachmentFiles([]);
    setFloatingAttachmentMessage("");
  }

  async function uploadFloatingMessageAttachments({
    conversationId,
    messageId,
    accessToken,
  }: {
    conversationId: string;
    messageId: string;
    accessToken: string;
  }) {
    if (!user?.id || floatingAttachmentFiles.length === 0) {
      return true;
    }

    for (const [index, file] of floatingAttachmentFiles.entries()) {
      const extension =
        getFloatingSafeAttachmentFileName(file.name).split(".").pop() || "file";
      const storagePath = `${user.id}/${conversationId}/${messageId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(FLOATING_ATTACHMENT_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        setFloatingMessagesMessage(`Attachment upload failed: ${uploadError.message}`);
        setFloatingAttachmentMessage(`${file.name} could not upload.`);
        return false;
      }

      const { data: publicUrlData } = supabase.storage
        .from(FLOATING_ATTACHMENT_BUCKET)
        .getPublicUrl(storagePath);

      const response = await fetch("/api/messages/attachments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          conversationId,
          messageId,
          storagePath,
          publicUrl: publicUrlData.publicUrl,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          sortOrder: index,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        await supabase.storage.from(FLOATING_ATTACHMENT_BUCKET).remove([storagePath]);
        setFloatingMessagesMessage(`Attachment save failed: ${result.error ?? "Unknown attachment error."}`);
        setFloatingAttachmentMessage(result.error ?? `${file.name} could not be attached.`);
        return false;
      }
    }

    return true;
  }

  function sendFloatingTypingIndicator() {
    if (!selectedFloatingConversationId || !user?.id) {
      return;
    }

    const now = Date.now();

    if (now - lastFloatingTypingSentRef.current < 1500) {
      return;
    }

    lastFloatingTypingSentRef.current = now;

    const name =
      navProfile?.full_name?.trim() ||
      navProfile?.username?.trim() ||
      user.email?.split("@")[0] ||
      "Someone";

    supabase
      .channel(`private-message-typing:${selectedFloatingConversationId}`)
      .send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: user.id,
          name,
        },
      });
  }

  async function sendFloatingMessage() {
    if (!selectedFloatingConversationId || floatingSending) {
      return;
    }

    const body = floatingComposerText.trim();
    const hasAttachments = floatingAttachmentFiles.length > 0;

    if (!body && !hasAttachments) {
      return;
    }

    setFloatingSending(true);
    setFloatingMessagesMessage("");

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";

    if (!accessToken) {
      setFloatingSending(false);
      setFloatingMessagesMessage("Log in to send messages.");
      return;
    }

    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          conversationId: selectedFloatingConversationId,
          body,
          hasAttachments,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFloatingMessagesMessage(payload.error ?? "Unable to send message.");
        setFloatingSending(false);
        return;
      }

      if (hasAttachments) {
        const messageId = String(payload.message?.id ?? "");

        if (!messageId) {
          setFloatingMessagesMessage("Message sent, but attachment upload could not start.");
          setFloatingSending(false);
          return;
        }

        const attachmentsUploaded = await uploadFloatingMessageAttachments({
          conversationId: selectedFloatingConversationId,
          messageId,
          accessToken,
        });

        if (!attachmentsUploaded) {
          setFloatingSending(false);
          return;
        }
      }

      setFloatingComposerText("");
      clearFloatingAttachments();

      await loadFloatingThread(selectedFloatingConversationId);
      await loadFloatingConversations();
      await loadMessageUnreadCount();
      window.dispatchEvent(new Event("loombus:messages-changed"));
    } catch {
      setFloatingMessagesMessage("Unable to send message.");
    }

    setFloatingSending(false);
  }


  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[var(--loombus-bg)] text-[var(--loombus-text)] antialiased">
      {/* Desktop Signal Rail: U2 app-shell foundation. Mobile keeps the existing floating top/bottom shell. */}
      {user && (
        <aside className="loombus-desktop-rail fixed inset-y-0 left-0 z-40 hidden w-24 border-r border-[var(--loombus-border)] bg-[var(--loombus-surface)]/95 px-3 py-4 backdrop-blur-xl md:flex md:flex-col md:items-center">
          <Link
            href="/"
            aria-label="Loombus home"
            title="Loombus"
            className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] transition hover:border-[var(--loombus-text-subtle)]"
          >
            <img
              src="/assets/brand/loombus-mark-transparent.png"
              alt=""
              className="h-9 w-9 object-contain"
            />
          </Link>

          <nav aria-label="Primary desktop navigation" className="flex flex-1 flex-col items-center gap-2">
            <Link href="/" aria-label="Home" title="Home" aria-current={isActivePath("/") ? "page" : undefined} data-active={isActivePath("/") ? "true" : undefined} className={desktopRailLinkClass("/")}>
              <Home aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Home" />
            </Link>

            <Link href="/discussions" aria-label="Discussions" title="Discussions" aria-current={isActivePath("/discussions") ? "page" : undefined} data-active={isActivePath("/discussions") ? "true" : undefined} className={desktopRailLinkClass("/discussions", true)}>
              <MessageCircle aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Discussions" />
            </Link>

            <Link href="/create" aria-label="Create" title="Create" aria-current={isActivePath("/create") ? "page" : undefined} data-active={isActivePath("/create") ? "true" : undefined} className={desktopRailLinkClass("/create", true)}>
              <Edit3 aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Create" />
            </Link>

            <Link href="/search" aria-label="Search" title="Search" aria-current={isActivePath("/search") ? "page" : undefined} data-active={isActivePath("/search") ? "true" : undefined} className={desktopRailLinkClass("/search")}>
              <Search aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Search" />
            </Link>

            <Link href="/people" aria-label="People" title="People" aria-current={isActivePath("/people") ? "page" : undefined} data-active={isActivePath("/people") ? "true" : undefined} className={desktopRailLinkClass("/people")}>
              <Users aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="People" />
            </Link>

            <Link href="/stickies" aria-label="Stickies" title="Stickies" aria-current={isActivePath("/stickies") ? "page" : undefined} data-active={isActivePath("/stickies") ? "true" : undefined} className={desktopRailLinkClass("/stickies")}>
              <StickyNote aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Stickies" />
            </Link>

            <Link href="/saved" aria-label="Saved" title="Saved" aria-current={isActivePath("/saved") ? "page" : undefined} data-active={isActivePath("/saved") ? "true" : undefined} className={desktopRailLinkClass("/saved")}>
              <Bookmark aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Saved" />
            </Link>

            <Link href="/notifications" aria-label="Alerts" title="Alerts" aria-current={isActivePath("/notifications") ? "page" : undefined} data-active={isActivePath("/notifications") ? "true" : undefined} className={desktopRailLinkClass("/notifications")}>
              <span className="relative">
                <Bell aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
                {notificationCount > 0 && (
                  <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-[var(--loombus-primary-bg)] px-1 text-center text-[9px] font-semibold leading-4 text-[var(--loombus-primary-text)]">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </span>
              <DesktopRailTooltip label="Alerts" />
            </Link>
          </nav>

          <div className="flex flex-col items-center gap-2">
            <Link href="/dashboard" aria-label="Home status" title="Home status" aria-current={isActivePath("/dashboard") ? "page" : undefined} data-active={isActivePath("/dashboard") ? "true" : undefined} className={desktopRailLinkClass("/dashboard")}>
              <LayoutDashboard aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Home status" />
            </Link>

            <Link href="/profile" aria-label="Profile" title="Profile" aria-current={isActivePath("/profile") ? "page" : undefined} data-active={isActivePath("/profile") ? "true" : undefined} className={desktopRailLinkClass("/profile")}>
              <UserCircle aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Profile" />
            </Link>

            <Link href="/labs" aria-label="Labs" title="Labs" aria-current={isActivePath("/labs") ? "page" : undefined} data-active={isActivePath("/labs") ? "true" : undefined} className={desktopRailLinkClass("/labs")}>
              <FlaskConical aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Labs" />
            </Link>

            {isAdmin && (
              <Link href="/admin" aria-label="Admin" title="Admin" aria-current={isActivePath("/admin") ? "page" : undefined} data-active={isActivePath("/admin") ? "true" : undefined} className={desktopRailLinkClass("/admin")}>
                <ShieldCheck aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
                <DesktopRailTooltip label="Admin" />
              </Link>
            )}

            <Link href="/settings" aria-label="Settings" title="Settings" aria-current={isActivePath("/settings") ? "page" : undefined} data-active={isActivePath("/settings") ? "true" : undefined} className={desktopRailLinkClass("/settings")}>
              <SettingsIcon aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Settings" />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
              className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-transparent text-[var(--loombus-text-subtle)] transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500"
            >
              <LogOut aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Logout" />
            </button>
          </div>
        </aside>
      )}
      {user && (
        <header className="hidden">
          <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-5">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/"
                className="flex items-center gap-3 text-xl font-semibold tracking-tight"
                aria-label="Loombus home"
              >
                <img
                  src="/assets/brand/loombus-mark-transparent.png"
                  alt=""
                  className="h-7 w-7 object-contain sm:h-8 sm:w-8"
                />
                <span className="text-lg sm:text-xl">Loombus</span>
              </Link>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle navigation menu"
                className="hidden rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white md:hidden"
              >
                Menu
              </button>

              <nav className="hidden items-center gap-5 text-sm text-zinc-400 md:flex">
                <Link href="/" onClick={closeMoreMenu} className={navLinkClass("/")}>
                  Home
                </Link>

                <Link
                  href="/create"
                  onClick={closeMoreMenu}
                  className="rounded-full bg-white px-4 py-2 font-medium text-black transition hover:bg-zinc-200"
                >
                  Create
                </Link>

                <Link href="/discussions" onClick={closeMoreMenu} className={navLinkClass("/discussions")}>
                  Discussions
                </Link>

                <Link href="/notifications" onClick={closeMoreMenu} className={navLinkClass("/notifications")}>
                  Alerts
                  {notificationCount > 0 && (
                    <span className="ml-2 rounded-full bg-[var(--loombus-primary-bg)] px-2 py-0.5 text-xs text-[var(--loombus-primary-text)]">
                      {notificationCount}
                    </span>
                  )}
                </Link>

                <div
                  ref={moreMenuRef}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() => setMoreMenuOpen((current) => !current)}
                    aria-expanded={moreMenuOpen}
                    className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                  >
                    More
                  </button>

                  {moreMenuOpen && (
                    <div className="absolute right-0 z-50 mt-3 w-60 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2 shadow-2xl shadow-black/10">
                      <p className="px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
                        Explore
                      </p>

                      <Link href="/search" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        Search
                      </Link>
                      <Link href="/people" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        People
                      </Link>
                      <Link href="/following" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        Following
                      </Link>
                      <Link href="/messages" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        Messages
                      </Link>
                      <Link href="/saved" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        Saved
                      </Link>
                      <Link href="/stickies" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        Stickies
                      </Link>

                      <p className="mt-2 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
                        Account
                      </p>

                      <Link href="/dashboard" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        Home status
                      </Link>
                      <Link href="/my-activity" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        My Activity
                      </Link>
                      <Link href="/profile" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        Profile
                      </Link>
                      <Link href="/labs" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        Labs
                      </Link>
                      <Link href="/settings" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        Settings
                      </Link>
                      <Link href="/premium" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                        Premium
                      </Link>

                      {isAdmin && (
                        <Link href="/admin" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
                          Admin
                        </Link>
                      )}

                      <button
                        onClick={async () => {
                          closeMoreMenu();
                          await handleLogout();
                        }}
                        className="mt-2 block w-full rounded-xl border border-[var(--loombus-border)] px-4 py-3 text-left text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </nav>
            </div>

          </div>
        </header>
      )}

      <div className={user ? "pb-24 md:pb-0 md:pl-24" : ""}>
        {user && (
        <div className={`loombus-mobile-topbar sticky top-0 z-40 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl transition-transform duration-300 md:hidden ${
          topNavHidden ? "-translate-y-full" : "translate-y-0"
        }`}>
          <div className="mx-auto flex max-w-md items-center justify-between">
            <Link
              href="/profile"
              aria-label="View profile"
              title="View profile"
              className="loombus-mobile-shell-avatar flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border text-sm font-semibold transition"
            >
              {navProfile?.avatar_url ? (
                <img
                  src={navProfile.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>
                  {(navProfile?.full_name ||
                    navProfile?.username ||
                    user.email ||
                    "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/search"
                aria-label="Search Loombus"
                title="Search Loombus"
                className="loombus-mobile-shell-button flex h-11 w-11 items-center justify-center rounded-full border transition"
              >
                <Search aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              </Link>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                title="Open menu"
                aria-expanded={mobileMenuOpen}
                className="loombus-mobile-shell-button flex h-11 w-11 items-center justify-center rounded-full border transition"
              >
                <Menu aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              </button>
            </div>
          </div>

          {isDiscussionsIndex && (
            <nav
              aria-label="Mobile discussion feed views"
              className="mx-auto mt-3 grid max-w-md grid-cols-3 border-t border-[var(--loombus-border)] pt-2"
            >
              {([
                ["all", "All"],
                ["following", "Following"],
                ["signal", "Active"],
              ] as const).map(([feed, label]) => (
                <button
                  key={feed}
                  type="button"
                  onClick={() => selectMobileDiscussionFeed(feed)}
                  className={`relative flex h-10 items-center justify-center text-sm font-semibold transition ${
                    mobileDiscussionFeed === feed
                      ? "text-[var(--loombus-text)]"
                      : "text-[var(--loombus-text-muted)]"
                  }`}
                >
                  {label}
                  <span
                    className={`absolute bottom-0 h-1 rounded-full transition ${
                      mobileDiscussionFeed === feed
                        ? "bg-[var(--loombus-text)]"
                        : "bg-transparent"
                    } ${feed === "following" ? "w-20" : "w-14"}`}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </nav>
          )}
        </div>
      )}

      {children}
      </div>

      {user && hasDesktopRightRail && (
        <button
          type="button"
          aria-label="Resize right panel"
          aria-valuemin={MIN_RIGHT_RAIL_WIDTH}
          aria-valuemax={MAX_RIGHT_RAIL_WIDTH}
          aria-valuenow={rightRailWidth}
          title="Drag to resize the right panel"
          onMouseDown={startRightRailResize}
          onDoubleClick={() => setRightRailWidth(DEFAULT_RIGHT_RAIL_WIDTH)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              adjustRightRailWidth(20);
            }

            if (event.key === "ArrowRight") {
              event.preventDefault();
              adjustRightRailWidth(-20);
            }

            if (event.key === "Home") {
              event.preventDefault();
              setRightRailWidth(MIN_RIGHT_RAIL_WIDTH);
            }

            if (event.key === "End") {
              event.preventDefault();
              setRightRailWidth(MAX_RIGHT_RAIL_WIDTH);
            }
          }}
          className={`loombus-right-rail-resizer fixed inset-y-0 z-40 hidden w-3 cursor-col-resize xl:block ${
            rightRailResizing ? "loombus-right-rail-resizer-active" : ""
          }`}
        >
          <span className="sr-only">Resize right panel</span>
        </button>
      )}

      {user && mobileMenuOpen && (
        <div
          className="loombus-mobile-menu-backdrop fixed inset-0 z-50 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md md:hidden"
          onClick={closeMobileMenu}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile app menu panel"
            className="loombus-mobile-menu-panel mx-auto flex max-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-5.5rem)] max-w-md flex-col overflow-y-auto rounded-[2rem] border p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="loombus-mobile-menu-header mb-4 flex items-center justify-between gap-3 border-b pb-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="loombus-mobile-menu-avatar flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border text-sm font-semibold">
                  {navProfile?.avatar_url ? (
                    <img
                      src={navProfile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>
                      {(navProfile?.full_name ||
                        navProfile?.username ||
                        user.email ||
                        "U")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="loombus-mobile-menu-title truncate text-sm font-medium">
                    {navProfile?.full_name ||
                      (navProfile?.username ? `@${navProfile.username}` : user.email)}
                  </p>
                  <p className="loombus-mobile-menu-subtitle mt-1 truncate text-xs">
                    Move with signal.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeMobileMenu}
                className="loombus-mobile-menu-close rounded-full border px-3 py-2 text-xs transition"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4">
              <section>
                <p className="loombus-mobile-menu-section-label mb-2 px-1 text-xs uppercase tracking-[0.2em]">
                  Explore Loombus
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Link href="/search" onClick={closeMobileMenu} className={mobileNavLinkClass("/search")}>
                    Search
                  </Link>

                  <Link href="/people" onClick={closeMobileMenu} className={mobileNavLinkClass("/people")}>
                    People
                  </Link>

                  <Link href="/following" onClick={closeMobileMenu} className={mobileNavLinkClass("/following")}>
                    Following
                  </Link>

                  <Link href="/messages" onClick={closeMobileMenu} className={mobileNavLinkClass("/messages")}>
                    Messages
                  </Link>

                  <Link href="/saved" onClick={closeMobileMenu} className={mobileNavLinkClass("/saved")}>
                    Saved
                  </Link>
                  <Link href="/stickies" onClick={closeMobileMenu} className={mobileNavLinkClass("/stickies")}>
                    Stickies
                  </Link>
                </div>
              </section>

              <section>
                <p className="loombus-mobile-menu-section-label mb-2 px-1 text-xs uppercase tracking-[0.2em]">
                  Your Signal
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Link href="/profile" onClick={closeMobileMenu} className={mobileNavLinkClass("/profile")}>
                    Profile
                  </Link>

                  <Link href="/my-activity" onClick={closeMobileMenu} className={mobileNavLinkClass("/my-activity")}>
                    My Activity
                  </Link>

                  <Link href="/my-discussions" onClick={closeMobileMenu} className={mobileNavLinkClass("/my-discussions")}>
                    My Discussions
                  </Link>

                  <Link href="/my-replies" onClick={closeMobileMenu} className={mobileNavLinkClass("/my-replies")}>
                    My Replies
                  </Link>
                </div>
              </section>

              <section>
                <p className="loombus-mobile-menu-section-label mb-2 px-1 text-xs uppercase tracking-[0.2em]">
                  Continue
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Link href="/reading-history" onClick={closeMobileMenu} className={mobileNavLinkClass("/reading-history")}>
                    Reading History
                  </Link>

                  <Link href="/dashboard" onClick={closeMobileMenu} className={mobileNavLinkClass("/dashboard")}>
                    Home status
                  </Link>
                </div>
              </section>

              <section>
                <p className="loombus-mobile-menu-section-label mb-2 px-1 text-xs uppercase tracking-[0.2em]">
                  Account
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Link href="/settings" onClick={closeMobileMenu} className={mobileNavLinkClass("/settings")}>
                    Settings
                  </Link>

                  <Link href="/labs" onClick={closeMobileMenu} className={mobileNavLinkClass("/labs")}>
                    Labs
                  </Link>

                  <Link href="/premium" onClick={closeMobileMenu} className={mobileNavLinkClass("/premium")}>
                    Premium
                  </Link>

                  <Link href="/ai-usage" onClick={closeMobileMenu} className={mobileNavLinkClass("/ai-usage")}>
                    AI Usage
                  </Link>

                  {isAdmin && (
                    <Link href="/admin" onClick={closeMobileMenu} className={mobileNavLinkClass("/admin")}>
                      Admin
                    </Link>
                  )}
                </div>
              </section>

              <button
                onClick={async () => {
                  closeMobileMenu();
                  await handleLogout();
                }}
                className="loombus-mobile-menu-logout rounded-2xl border px-4 py-3 text-left text-sm font-medium transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {user && !mobileMenuOpen && (
        <>
          <button
            type="button"
            onClick={() => setFloatingMessagesOpen((current) => !current)}
            aria-label={floatingMessagesOpen ? "Close messages" : "Open messages"}
            aria-expanded={floatingMessagesOpen}
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-4 z-50 flex h-13 w-13 items-center justify-center rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-2xl shadow-black/20 transition hover:opacity-90 md:bottom-6 md:right-6 md:h-14 md:w-14"
          >
            <span className="relative">
              <MessageCircle aria-hidden="true" className="h-6 w-6" strokeWidth={2.05} />
              {floatingUnreadCount > 0 && (
                <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-semibold leading-4 text-white">
                  {floatingUnreadCount > 9 ? "9+" : floatingUnreadCount}
                </span>
              )}
            </span>
          </button>

          {floatingMessagesOpen && (
            <aside
              aria-label="Messages preview"
              className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] top-[calc(env(safe-area-inset-top)+1rem)] z-50 flex flex-col overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-2xl shadow-black/25 md:inset-auto md:bottom-24 md:right-6 md:block md:w-[26rem] md:max-w-[calc(100vw-8rem)]"
            >
              <div className="border-b border-[var(--loombus-border)] p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Chat
                  </h2>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openFloatingNewMessage}
                      className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-medium text-[var(--loombus-text)] transition hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)]"
                    >
                      New
                    </button>

                    <Link
                      href="/messages"
                      onClick={() => setFloatingMessagesOpen(false)}
                      className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-medium text-[var(--loombus-text)] transition hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)]"
                    >
                      Open
                    </Link>

                    <button
                      type="button"
                      onClick={() => setFloatingMessagesOpen(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--loombus-border)] text-xl leading-none text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                      aria-label="Close messages"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-[var(--loombus-text-muted)]">
                  <Search aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.05} />
                  <input
                    value={floatingMessageSearch}
                    onChange={(event) => setFloatingMessageSearch(event.target.value)}
                    placeholder={floatingNewMessageOpen ? "Search people" : "Search messages"}
                    className="min-w-0 flex-1 bg-transparent text-sm text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-muted)]"
                  />
                </label>
              </div>

              <div className="flex-1 overflow-y-auto md:max-h-[32rem] md:min-h-[24rem]">
                {selectedFloatingConversation ? (
                  <div className="flex min-h-full flex-col md:min-h-[28rem]">
                    <div className="flex items-center gap-3 border-b border-[var(--loombus-border)] px-5 py-4">
                      <button
                        type="button"
                        onClick={closeFloatingThread}
                        className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                      >
                        Back
                      </button>

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] text-sm font-semibold text-[var(--loombus-text)]">
                        {selectedFloatingConversation.otherAvatarUrl ? (
                          <img
                            src={selectedFloatingConversation.otherAvatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getFloatingConversationInitial(selectedFloatingConversation)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--loombus-text)]">
                          {getFloatingConversationName(selectedFloatingConversation)}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-[var(--loombus-text-muted)]">
                          {selectedFloatingConversation.otherUsername
                            ? `@${selectedFloatingConversation.otherUsername}`
                            : "Conversation"}
                        </p>
                      </div>

                      <Link
                        href={`/messages?conversation=${selectedFloatingConversation.id}`}
                        onClick={() => setFloatingMessagesOpen(false)}
                        className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                      >
                        Full
                      </Link>
                    </div>

                    {floatingMessagesMessage && (
                      <p className="border-b border-[var(--loombus-border)] px-5 py-3 text-sm text-[var(--loombus-text-muted)]">
                        {floatingMessagesMessage}
                      </p>
                    )}

                    <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                      {floatingThreadLoading ? (
                        <p className="text-sm text-[var(--loombus-text-muted)]">
                          Loading conversation...
                        </p>
                      ) : floatingThreadMessages.length === 0 ? (
                        <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4">
                          <p className="text-sm text-[var(--loombus-text-muted)]">
                            No messages yet. Send the first message when you're ready.
                          </p>
                        </div>
                      ) : (
                        floatingThreadMessages.map((threadMessage) => {
                          const mine = threadMessage.senderId === user?.id;

                          return (
                            <div
                              key={threadMessage.id}
                              className={`flex ${mine ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[84%] rounded-[1.35rem] px-4 py-3 text-sm leading-relaxed shadow-lg shadow-black/10 ${
                                  mine
                                    ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]"
                                    : "border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] text-[var(--loombus-text)]"
                                }`}
                              >
                                {threadMessage.body && threadMessage.body !== "[Attachment]" && (
                                  <p className="whitespace-pre-wrap break-words">
                                    {threadMessage.body}
                                  </p>
                                )}

                                {threadMessage.attachments && threadMessage.attachments.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {threadMessage.attachments.map((attachment) => (
                                      <div
                                        key={attachment.id}
                                        className={`overflow-hidden rounded-xl border ${
                                          mine
                                            ? "border-black/10 bg-black/10"
                                            : "border-[var(--loombus-border)] bg-[var(--loombus-surface)]"
                                        }`}
                                      >
                                        {attachment.attachmentKind === "image" ? (
                                          <a
                                            href={attachment.publicUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            <img
                                              src={attachment.publicUrl}
                                              alt={attachment.fileName}
                                              className="max-h-48 w-full object-cover"
                                            />
                                          </a>
                                        ) : (
                                          <a
                                            href={attachment.publicUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block p-3"
                                          >
                                            <p className="text-sm font-medium">
                                              PDF
                                            </p>
                                            <p className="mt-1 truncate text-xs opacity-70">
                                              {attachment.fileName}
                                            </p>
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <p
                                  className={`mt-2 text-[10px] ${
                                    mine
                                      ? "opacity-70"
                                      : "text-[var(--loombus-text-muted)]"
                                  }`}
                                >
                                  {new Date(threadMessage.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {floatingTypingUserName && (
                      <p className="px-5 pb-3 text-xs text-[var(--loombus-text-muted)]">
                        {floatingTypingUserName} is typing...
                      </p>
                    )}

                    <div className="border-t border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
                      {floatingAttachmentFiles.length > 0 && (
                        <div className="mb-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-xs text-[var(--loombus-text-muted)]">
                              {floatingAttachmentFiles.length} attachment{floatingAttachmentFiles.length === 1 ? "" : "s"} selected
                            </p>

                            <button
                              type="button"
                              onClick={clearFloatingAttachments}
                              disabled={floatingSending}
                              className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Clear
                            </button>
                          </div>

                          <div className="space-y-2">
                            {floatingAttachmentFiles.map((file) => (
                              <div
                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-2 text-xs text-[var(--loombus-text-muted)]"
                              >
                                <span className="truncate">{file.name}</span>
                                <span className="shrink-0 text-[var(--loombus-text-subtle)]">
                                  {file.type === "application/pdf" ? "PDF" : "Image"} · {formatFloatingAttachmentFileSize(file.size)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {floatingAttachmentMessage && (
                        <p className="mb-2 text-xs text-[var(--loombus-text-muted)]">
                          {floatingAttachmentMessage}
                        </p>
                      )}

                      <div className="flex items-end gap-2 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-2">
                        <label className="mb-1 cursor-pointer rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]">
                          +
                          <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                            onChange={handleFloatingAttachmentSelection}
                            disabled={floatingSending}
                            className="hidden"
                          />
                        </label>

                        <textarea
                          value={floatingComposerText}
                          onChange={(event) => {
                            setFloatingComposerText(event.target.value);
                            sendFloatingTypingIndicator();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              sendFloatingMessage();
                            }
                          }}
                          placeholder="Write a message..."
                          rows={1}
                          className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-muted)]"
                        />

                        <button
                          type="button"
                          disabled={floatingSending || (!floatingComposerText.trim() && floatingAttachmentFiles.length === 0)}
                          onClick={sendFloatingMessage}
                          className="mb-1 rounded-full bg-[var(--loombus-primary-bg)] px-4 py-2 text-xs font-semibold text-[var(--loombus-primary-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {floatingSending ? "..." : "Send"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : floatingNewMessageOpen ? (
                  <div className="min-h-[24rem]">
                    <div className="border-b border-[var(--loombus-border)] px-5 py-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold tracking-tight">
                            New message
                          </h3>

                          <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
                            Use the search box above to find mutual followers.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={closeFloatingNewMessage}
                          className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                        >
                          Cancel
                        </button>
                      </div>

                    </div>

                    <div className="p-5">
                      {floatingMessageSearch.trim().length < 2 ? (
                        <p className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4 text-sm text-[var(--loombus-text-muted)]">
                          Type at least 2 characters to search people you can message.
                        </p>
                      ) : floatingPeopleSearchLoading ? (
                        <p className="text-sm text-[var(--loombus-text-muted)]">
                          Searching...
                        </p>
                      ) : floatingPeopleSearchResults.length === 0 ? (
                        <p className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4 text-sm text-[var(--loombus-text-muted)]">
                          No mutual followers match that search.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {floatingPeopleSearchResults.map((person) => (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => startFloatingConversation(person)}
                              disabled={floatingStartingConversationId === person.id}
                              className="flex w-full items-start gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-left transition hover:border-[var(--loombus-text-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-sm font-semibold text-[var(--loombus-text)]">
                                {person.avatarUrl ? (
                                  <img
                                    src={person.avatarUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  getFloatingPersonInitial(person)
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--loombus-text)]">
                                  {getFloatingPersonName(person)}
                                </p>

                                <p className="mt-1 truncate text-xs text-[var(--loombus-text-muted)]">
                                  {person.username ? `@${person.username}` : "Start conversation"}
                                </p>
                              </div>

                              <span className="shrink-0 rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs text-[var(--loombus-text-muted)]">
                                {floatingStartingConversationId === person.id ? "Starting..." : "Message"}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {floatingMessagesMessage && (
                        <p className="mt-4 text-sm text-[var(--loombus-text-muted)]">
                          {floatingMessagesMessage}
                        </p>
                      )}
                    </div>
                  </div>
                ) : floatingMessagesLoading ? (
                  <div className="flex min-h-[24rem] items-center justify-center px-6 py-10 text-center">
                    <p className="text-sm text-[var(--loombus-text-muted)]">
                      Loading messages...
                    </p>
                  </div>
                ) : floatingMessagesMessage ? (
                  <div className="flex min-h-[24rem] flex-col items-center justify-center px-6 py-10 text-center">
                    <MessageCircle aria-hidden="true" className="mb-6 h-20 w-20 text-[var(--loombus-text-muted)]" strokeWidth={1.6} />
                    <h3 className="text-2xl font-semibold tracking-tight">
                      Messages unavailable
                    </h3>
                    <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
                      {floatingMessagesMessage}
                    </p>
                  </div>
                ) : floatingConversations.length === 0 ? (
                  <div className="flex min-h-[24rem] flex-col items-center justify-center px-6 py-10 text-center">
                    <MessageCircle aria-hidden="true" className="mb-6 h-20 w-20 text-[var(--loombus-text)]" strokeWidth={1.6} />

                    <h3 className="text-2xl font-semibold tracking-tight">
                      Empty inbox
                    </h3>

                    <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
                      Message someone or open your full inbox.
                    </p>

                    <Link
                      href="/messages"
                      onClick={() => setFloatingMessagesOpen(false)}
                      className="mt-6 rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-medium text-[var(--loombus-primary-text)] transition hover:opacity-90"
                    >
                      Open Messages
                    </Link>
                  </div>
                ) : filteredFloatingConversations.length === 0 ? (
                  <div className="flex min-h-[24rem] flex-col items-center justify-center px-6 py-10 text-center">
                    <h3 className="text-xl font-semibold tracking-tight">
                      No matches
                    </h3>
                    <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
                      Try another name, username, or message keyword.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--loombus-border)]">
                    {filteredFloatingConversations.slice(0, 8).map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => openFloatingConversation(conversation.id)}
                        className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-[var(--loombus-surface-muted)]"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] text-sm font-semibold text-[var(--loombus-text)]">
                          {conversation.otherAvatarUrl ? (
                            <img
                              src={conversation.otherAvatarUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getFloatingConversationInitial(conversation)
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--loombus-text)]">
                              {getFloatingConversationName(conversation)}
                            </p>

                            {conversation.hasUnread && (
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-label="Unread" />
                            )}

                            {conversation.mutedAt && (
                              <span className="rounded-full border border-[var(--loombus-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--loombus-text-muted)]">
                                Muted
                              </span>
                            )}
                          </div>

                          <p className="mt-1 truncate text-xs text-[var(--loombus-text-muted)]">
                            {conversation.lastMessagePreview ?? "Conversation ready."}
                          </p>

                          {conversation.lastMessageAt && (
                            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">
                              {new Date(conversation.lastMessageAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}

                    <div className="p-4">
                      <Link
                        href="/messages"
                        onClick={() => setFloatingMessagesOpen(false)}
                        className="inline-flex w-full justify-center rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-medium text-[var(--loombus-text)] transition hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)]"
                      >
                        Open full inbox
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </>
      )}

      {user && !mobileMenuOpen && !floatingMessagesOpen && (
        <nav
          aria-label="Mobile app navigation"
          className={`loombus-mobile-bottom-nav fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-50 rounded-[1.75rem] border p-2 backdrop-blur-xl transition-transform duration-300 md:hidden ${
            bottomNavHidden ? "translate-y-[calc(100%+1rem)]" : "translate-y-0"
          }`}
        >
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            <Link href="/" aria-label="Home" title="Home" onClick={closeMobileMenu} className={appTabClass("/")}>
              <MobileNavIcon name="home" />
            </Link>

            <Link href="/discussions" aria-label="Discussions" title="Discussions" onClick={closeMobileMenu} className={appTabClass("/discussions")}>
              <MobileNavIcon name="discuss" />
            </Link>

            <Link href="/create" aria-label="Create" title="Create" onClick={closeMobileMenu} className={appTabClass("/create")}>
              <MobileNavIcon name="create" />
            </Link>

            <Link href="/people" aria-label="People" title="People" onClick={closeMobileMenu} className={appTabClass("/people")}>
              <MobileNavIcon name="people" />
            </Link>

            <Link href="/notifications" aria-label="Alerts" title="Alerts" onClick={closeMobileMenu} className={appTabClass("/notifications")}>
              <span className="relative">
                <MobileNavIcon name="alerts" />
                {notificationCount > 0 && (
                  <span className="loombus-mobile-nav-badge absolute -right-2 -top-2 min-w-4 rounded-full px-1 text-center text-[9px] font-semibold leading-4">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </span>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
