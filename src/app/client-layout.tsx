"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
  HelpCircle,
  MessageCircle,
  Palette,
  Search,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { PLATFORM_ROUTE_REGISTRY, type PlatformRouteEntry } from "@/lib/platform-route-registry";

type NavProfile = {
  username: string | null;
  full_name: string | null;
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

type GlobalSearchResult = PlatformRouteEntry;

type GlobalSearchProfileResult = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type GlobalSearchDiscussionResult = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
  user_id: string;
  reality_lens?: string | null;
  purpose_lane?: string | null;
  contributorName?: string | null;
  contributorUsername?: string | null;
};

type GlobalSearchSavedResult = {
  id: string;
  created_at: string;
  private_note: string | null;
  discussions: {
    id: string;
    title: string;
    topic: string;
    body: string;
    created_at: string;
    reality_lens: string | null;
    purpose_lane: string | null;
  } | null;
};

const GLOBAL_SEARCH_RESULTS: GlobalSearchResult[] = PLATFORM_ROUTE_REGISTRY;

function matchesGlobalSearchResult(result: GlobalSearchResult, query: string) {
  if (!query) {
    return true;
  }

  return [
    result.title,
    result.description,
    result.category,
    ...result.keywords,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function areFloatingConversationsEqual(
  current: FloatingConversation[],
  next: FloatingConversation[]
) {
  if (current.length !== next.length) {
    return false;
  }

  return current.every((conversation, index) => {
    const nextConversation = next[index];

    return (
      conversation.id === nextConversation.id &&
      conversation.hasUnread === nextConversation.hasUnread &&
      conversation.mutedAt === nextConversation.mutedAt &&
      conversation.lastMessagePreview === nextConversation.lastMessagePreview &&
      conversation.lastMessageAt === nextConversation.lastMessageAt &&
      conversation.otherFullName === nextConversation.otherFullName &&
      conversation.otherUsername === nextConversation.otherUsername &&
      conversation.otherAvatarUrl === nextConversation.otherAvatarUrl
    );
  });
}

function areFloatingThreadMessagesEqual(
  current: FloatingThreadMessage[],
  next: FloatingThreadMessage[]
) {
  if (current.length !== next.length) {
    return false;
  }

  return current.every((message, index) => {
    const nextMessage = next[index];
    const attachments = message.attachments ?? [];
    const nextAttachments = nextMessage.attachments ?? [];

    if (
      message.id !== nextMessage.id ||
      message.body !== nextMessage.body ||
      message.createdAt !== nextMessage.createdAt ||
      message.senderId !== nextMessage.senderId ||
      attachments.length !== nextAttachments.length
    ) {
      return false;
    }

    return attachments.every(
      (attachment, attachmentIndex) =>
        attachment.id === nextAttachments[attachmentIndex]?.id
    );
  });
}

const RIGHT_RAIL_WIDTH_STORAGE_KEY = "loombus:right-rail-width";
const APPEARANCE_STORAGE_KEY = "loombus:appearance";

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


type AppearanceMode = "system" | "dark" | "light";
const DEFAULT_RIGHT_RAIL_WIDTH = 320;
const MIN_RIGHT_RAIL_WIDTH = 280;
const MAX_RIGHT_RAIL_WIDTH = 480;
const DESKTOP_LEFT_RAIL_WIDTH = 96;
const MIN_READABLE_CENTER_WIDTH = 760;
const DESKTOP_CONTENT_GUTTER = 64;

function canFitDesktopRightRail(width: number) {
  return (
    width >=
    DESKTOP_LEFT_RAIL_WIDTH +
      MIN_READABLE_CENTER_WIDTH +
      MIN_RIGHT_RAIL_WIDTH +
      DESKTOP_CONTENT_GUTTER
  );
}

function getViewportAwareMaxRightRailWidth() {
  if (typeof window === "undefined") {
    return MAX_RIGHT_RAIL_WIDTH;
  }

  const availableWidth =
    window.innerWidth - DESKTOP_LEFT_RAIL_WIDTH - MIN_READABLE_CENTER_WIDTH - DESKTOP_CONTENT_GUTTER;

  return Math.max(MIN_RIGHT_RAIL_WIDTH, Math.min(MAX_RIGHT_RAIL_WIDTH, availableWidth));
}

function clampRightRailWidth(width: number) {
  const viewportAwareMax = getViewportAwareMaxRightRailWidth();

  return Math.min(viewportAwareMax, Math.max(MIN_RIGHT_RAIL_WIDTH, width));
}

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, setUser] = useState<any>(null);
  const [navProfile, setNavProfile] = useState<NavProfile | null>(null);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchProfiles, setGlobalSearchProfiles] = useState<GlobalSearchProfileResult[]>([]);
  const [globalSearchDiscussions, setGlobalSearchDiscussions] = useState<GlobalSearchDiscussionResult[]>([]);
  const [globalSearchSaved, setGlobalSearchSaved] = useState<GlobalSearchSavedResult[]>([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchAiAnswer, setGlobalSearchAiAnswer] = useState("");
  const [globalSearchAiMessage, setGlobalSearchAiMessage] = useState("");
  const [globalSearchAiWorking, setGlobalSearchAiWorking] = useState(false);
  const [globalSearchAiUpgradeRequired, setGlobalSearchAiUpgradeRequired] = useState(false);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>("system");
  const [appearancePickerOpen, setAppearancePickerOpen] = useState(false);
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
  const [floatingAiAssistWorking, setFloatingAiAssistWorking] = useState<string | null>(null);
  const [floatingNewMessageOpen, setFloatingNewMessageOpen] = useState(false);
  const [floatingPeopleSearchResults, setFloatingPeopleSearchResults] = useState<FloatingPeopleSearchResult[]>([]);
  const [floatingPeopleSearchLoading, setFloatingPeopleSearchLoading] = useState(false);
  const [floatingStartingConversationId, setFloatingStartingConversationId] = useState<string | null>(null);
  const [floatingSafetyOpen, setFloatingSafetyOpen] = useState(false);
  const [floatingConversationAction, setFloatingConversationAction] = useState<string | null>(null);
  const [floatingReportReason, setFloatingReportReason] = useState("harassment");
  const [floatingReportNotes, setFloatingReportNotes] = useState("");
  const [rightRailWidth, setRightRailWidth] = useState(DEFAULT_RIGHT_RAIL_WIDTH);
  const [rightRailResizing, setRightRailResizing] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const currentUserIdRef = useRef<string | null>(null);
  const floatingTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFloatingTypingSentRef = useRef(0);
  const rightRailDragStartRef = useRef<{ pointerX: number; width: number } | null>(null);
  const pathname = usePathname();
  const isRightRailRoute =
    [
      "/discussions",
      "/search",
      "/people",
      "/saved",
      "/notifications",
      "/create",
    ].includes(pathname) || pathname.startsWith("/discussions/");

  const canShowDesktopRightRail =
    viewportWidth === 0 ? true : canFitDesktopRightRail(viewportWidth);

  const hasDesktopRightRail = isRightRailRoute && canShowDesktopRightRail;

  useEffect(() => {
    if (!globalSearchOpen) {
      return;
    }

    function handleGlobalSearchKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setGlobalSearchOpen(false);
        setGlobalSearchQuery("");
      }
    }

    window.addEventListener("keydown", handleGlobalSearchKeyDown);

    return () => {
      window.removeEventListener("keydown", handleGlobalSearchKeyDown);
    };
  }, [globalSearchOpen]);

  useEffect(() => {
    function handleOpenGlobalSearch() {
      setAppearancePickerOpen(false);
      setGlobalSearchOpen(true);
    }

    window.addEventListener("loombus:open-global-search", handleOpenGlobalSearch);

    return () => {
      window.removeEventListener("loombus:open-global-search", handleOpenGlobalSearch);
    };
  }, []);

  useEffect(() => {
    if (!globalSearchOpen) {
      return;
    }

    const cleanQuery = globalSearchQuery.trim().toLowerCase();

    if (cleanQuery.length < 2) {
      setGlobalSearchProfiles([]);
      setGlobalSearchDiscussions([]);
      setGlobalSearchSaved([]);
      setGlobalSearchAiAnswer("");
      setGlobalSearchAiMessage("");
      setGlobalSearchAiUpgradeRequired(false);
      setGlobalSearchLoading(false);
      return;
    }

    let isMounted = true;

    async function loadGlobalSearchResults() {
      setGlobalSearchLoading(true);

      try {
        const escapedQuery = cleanQuery.replace(/[%_]/g, "");
        const searchPattern = `%${escapedQuery}%`;

        const [
          usernameProfiles,
          nameProfiles,
          bioProfiles,
          titleDiscussions,
          topicDiscussions,
          bodyDiscussions,
          realityLensDiscussions,
          purposeLaneDiscussions,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, bio")
            .ilike("username", searchPattern)
            .limit(6),
          supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, bio")
            .ilike("full_name", searchPattern)
            .limit(6),
          supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, bio")
            .ilike("bio", searchPattern)
            .limit(6),
          supabase
            .from("discussions")
            .select("id, title, topic, body, created_at, user_id, reality_lens, purpose_lane")
            .is("deleted_at", null)
            .ilike("title", searchPattern)
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("discussions")
            .select("id, title, topic, body, created_at, user_id, reality_lens, purpose_lane")
            .is("deleted_at", null)
            .ilike("topic", searchPattern)
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("discussions")
            .select("id, title, topic, body, created_at, user_id, reality_lens, purpose_lane")
            .is("deleted_at", null)
            .ilike("body", searchPattern)
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("discussions")
            .select("id, title, topic, body, created_at, user_id, reality_lens, purpose_lane")
            .is("deleted_at", null)
            .ilike("reality_lens", searchPattern)
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("discussions")
            .select("id, title, topic, body, created_at, user_id, reality_lens, purpose_lane")
            .is("deleted_at", null)
            .ilike("purpose_lane", searchPattern)
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

        if (!isMounted) {
          return;
        }

        const profileMap = new Map<string, GlobalSearchProfileResult>();
        for (const profile of [
          ...((usernameProfiles.data ?? []) as GlobalSearchProfileResult[]),
          ...((nameProfiles.data ?? []) as GlobalSearchProfileResult[]),
          ...((bioProfiles.data ?? []) as GlobalSearchProfileResult[]),
        ]) {
          profileMap.set(profile.id, profile);
        }

        const baseDiscussionRows = [
          ...((titleDiscussions.data ?? []) as GlobalSearchDiscussionResult[]),
          ...((topicDiscussions.data ?? []) as GlobalSearchDiscussionResult[]),
          ...((bodyDiscussions.data ?? []) as GlobalSearchDiscussionResult[]),
          ...((realityLensDiscussions.data ?? []) as GlobalSearchDiscussionResult[]),
          ...((purposeLaneDiscussions.data ?? []) as GlobalSearchDiscussionResult[]),
        ];

        const contributorProfileRows = [
          ...((usernameProfiles.data ?? []) as GlobalSearchProfileResult[]),
          ...((nameProfiles.data ?? []) as GlobalSearchProfileResult[]),
        ];

        const contributorProfileIds = [
          ...new Set(
            contributorProfileRows
              .map((profile) => profile.id)
              .filter((profileId): profileId is string => Boolean(profileId))
          ),
        ];

        let contributorDiscussionRows: GlobalSearchDiscussionResult[] = [];

        if (contributorProfileIds.length > 0) {
          const { data: contributorDiscussions } = await supabase
            .from("discussions")
            .select("id, title, topic, body, created_at, user_id, reality_lens, purpose_lane")
            .is("deleted_at", null)
            .in("user_id", contributorProfileIds)
            .order("created_at", { ascending: false })
            .limit(8);

          contributorDiscussionRows = (contributorDiscussions ?? []) as GlobalSearchDiscussionResult[];
        }

        const discussionMap = new Map<string, GlobalSearchDiscussionResult>();
        for (const discussion of [
          ...baseDiscussionRows,
          ...contributorDiscussionRows,
        ]) {
          discussionMap.set(discussion.id, discussion);
        }

        const discussionRows = [...discussionMap.values()].slice(0, 8);
        const discussionAuthorIds = [
          ...new Set(
            discussionRows
              .map((discussion) => discussion.user_id)
              .filter((profileId): profileId is string => Boolean(profileId))
          ),
        ];

        let discussionAuthors: Record<string, GlobalSearchProfileResult> = {};

        if (discussionAuthorIds.length > 0) {
          const { data: authorProfiles } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, bio")
            .in("id", discussionAuthorIds);

          discussionAuthors = Object.fromEntries(
            ((authorProfiles ?? []) as GlobalSearchProfileResult[]).map((profile) => [
              profile.id,
              profile,
            ])
          );
        }

        const hydratedDiscussions = discussionRows.map((discussion) => {
          const author = discussionAuthors[discussion.user_id];

          return {
            ...discussion,
            contributorName: author?.full_name ?? null,
            contributorUsername: author?.username ?? null,
          };
        });

        let savedResults: GlobalSearchSavedResult[] = [];

        if (user?.id) {
          const { data: savedData } = await supabase
            .from("bookmarks")
            .select(`
              id,
              created_at,
              private_note,
              discussions (
                id,
                title,
                topic,
                body,
                created_at,
                reality_lens,
                purpose_lane
              )
            `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(60);

          const normalizedSaved = ((savedData ?? []) as Array<{
            id: string;
            created_at: string;
            private_note: string | null;
            discussions:
              | GlobalSearchSavedResult["discussions"]
              | GlobalSearchSavedResult["discussions"][];
          }>)
            .map((item) => ({
              ...item,
              discussions: Array.isArray(item.discussions)
                ? item.discussions[0] ?? null
                : item.discussions,
            })) as GlobalSearchSavedResult[];

          savedResults = normalizedSaved
            .filter((item) => {
              const discussion = item.discussions;
              const privateNote = item.private_note ?? "";

              return (
                (discussion?.title ?? "").toLowerCase().includes(cleanQuery) ||
                (discussion?.topic ?? "").toLowerCase().includes(cleanQuery) ||
                (discussion?.purpose_lane ?? "").toLowerCase().includes(cleanQuery) ||
                (discussion?.body ?? "").toLowerCase().includes(cleanQuery) ||
                privateNote.toLowerCase().includes(cleanQuery)
              );
            })
            .slice(0, 6);
        }

        setGlobalSearchProfiles([...profileMap.values()].slice(0, 6));
        setGlobalSearchDiscussions(hydratedDiscussions);
        setGlobalSearchSaved(savedResults);
      } catch (error) {
        console.error("Unable to load global search results.", error);

        if (isMounted) {
          setGlobalSearchProfiles([]);
          setGlobalSearchDiscussions([]);
          setGlobalSearchSaved([]);
        }
      } finally {
        if (isMounted) {
          setGlobalSearchLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(loadGlobalSearchResults, 220);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [globalSearchOpen, globalSearchQuery]);

  function getCurrentGuideHref() {
    if (pathname === "/home" || pathname === "/") {
      return "/settings/guide#home";
    }

    if (pathname === "/create") {
      return "/settings/guide#create";
    }

    if (pathname === "/discussions") {
      return "/settings/guide#discussions";
    }

    if (pathname.startsWith("/discussions/")) {
      return "/settings/guide#replies";
    }

    if (pathname === "/saved") {
      return "/settings/guide#saved";
    }

    if (pathname === "/stickies") {
      return "/settings/guide#stickies";
    }

    if (pathname === "/messages") {
      return "/settings/guide#messages";
    }

    if (pathname === "/people" || pathname === "/following" || pathname.startsWith("/u/")) {
      return "/settings/guide#people";
    }

    if (pathname === "/notifications") {
      return "/settings/guide#alerts";
    }

    if (pathname === "/settings" || pathname === "/settings/guide") {
      return "/settings/guide#appearance";
    }

    if (pathname === "/premium" || pathname === "/ai-usage") {
      return "/settings/guide#premium";
    }

    if (pathname === "/profile" || pathname === "/dashboard" || pathname === "/my-activity" || pathname === "/my-discussions" || pathname === "/my-replies" || pathname === "/reading-history") {
      return "/settings/guide#getting-started";
    }

    if (pathname === "/safety" || pathname === "/guidelines" || pathname === "/blocked-users") {
      return "/settings/guide#safety";
    }

    return "/settings/guide#getting-started";
  }


  useEffect(() => {
    let isMounted = true;

    async function loadFloatingProfile(userId: string) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, full_name")
          .eq("id", userId)
          .maybeSingle();

        if (isMounted && currentUserIdRef.current === userId) {
          setNavProfile((profile ?? null) as NavProfile | null);
        }
      } catch (error) {
        console.error("Unable to load floating message profile.", error);

        if (isMounted && currentUserIdRef.current === userId) {
          setNavProfile(null);
        }
      }
    }

    async function applyAuthenticatedUser(nextUser: any) {
      if (!isMounted) {
        return;
      }

      const nextUserId = nextUser?.id ?? null;
      currentUserIdRef.current = nextUserId;
      setUser(nextUser ?? null);

      if (!nextUserId) {
        setNavProfile(null);
        return;
      }

      await loadFloatingProfile(nextUserId);
    }

    async function loadUser() {
      try {
        const { data } = await supabase.auth.getUser();

        if (!isMounted) {
          return;
        }

        await applyAuthenticatedUser(data.user ?? null);
      } catch (error) {
        console.error("Unable to load layout auth state.", error);

        if (isMounted) {
          currentUserIdRef.current = null;
          setUser(null);
          setNavProfile(null);
        }
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applyAuthenticatedUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function getStoredAppearanceMode(): AppearanceMode {
    if (typeof window === "undefined") {
      return "system";
    }

    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);

    if (stored === "dark" || stored === "light" || stored === "system") {
      return stored;
    }

    return "system";
  }

  function applyAppearanceMode(mode: AppearanceMode) {
    setAppearanceMode(mode);
    setAppearancePickerOpen(false);

    if (typeof document !== "undefined") {
      document.documentElement.dataset.loombusTheme = mode;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
      window.dispatchEvent(
        new CustomEvent("loombus:appearance-changed", {
          detail: { mode },
        })
      );
    }
  }


  useEffect(() => {
    const storedAppearance = getStoredAppearanceMode();
    setAppearanceMode(storedAppearance);

    if (typeof document !== "undefined") {
      document.documentElement.dataset.loombusTheme = storedAppearance;
    }

    function handleAppearanceStorage(event: StorageEvent) {
      if (event.key !== APPEARANCE_STORAGE_KEY) {
        return;
      }

      const nextMode =
        event.newValue === "dark" || event.newValue === "light" || event.newValue === "system"
          ? event.newValue
          : "system";

      setAppearanceMode(nextMode);

      if (typeof document !== "undefined") {
        document.documentElement.dataset.loombusTheme = nextMode;
      }
    }

    window.addEventListener("storage", handleAppearanceStorage);

    return () => {
      window.removeEventListener("storage", handleAppearanceStorage);
    };
  }, []);

  useEffect(() => {
    function restoreSafeRightRailWidth() {
      setViewportWidth(window.innerWidth);

      const storedWidth = Number(window.localStorage.getItem(RIGHT_RAIL_WIDTH_STORAGE_KEY));

      if (Number.isFinite(storedWidth) && storedWidth > 0) {
        setRightRailWidth(clampRightRailWidth(storedWidth));
        return;
      }

      setRightRailWidth(clampRightRailWidth(DEFAULT_RIGHT_RAIL_WIDTH));
    }

    restoreSafeRightRailWidth();

    window.addEventListener("resize", restoreSafeRightRailWidth);

    return () => {
      window.removeEventListener("resize", restoreSafeRightRailWidth);
    };
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
    setAppearancePickerOpen(false);
  }, [pathname]);

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

  async function loadFloatingConversations(options: { silent?: boolean } = {}) {
    const silent = options.silent === true;

    if (floatingMessagesLoading && !silent) {
      return;
    }

    if (!silent) {
      setFloatingMessagesLoading(true);
      setFloatingMessagesMessage("");
    }

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";

    if (!accessToken) {
      setMessageUnreadCount(0);

      if (!silent) {
        setFloatingMessagesLoading(false);
        setFloatingMessagesMessage("Log in to view messages.");
      }

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
        if (!silent) {
          setFloatingMessagesMessage(payload.error ?? "Unable to load messages.");
          setFloatingMessagesLoading(false);
        }

        return;
      }

      const nextConversations = (payload.conversations ?? []) as FloatingConversation[];

      setFloatingConversations((current) =>
        areFloatingConversationsEqual(current, nextConversations)
          ? current
          : nextConversations
      );
    } catch {
      if (!silent) {
        setFloatingMessagesMessage("Unable to load messages.");
      }
    }

    if (!silent) {
      setFloatingMessagesLoading(false);
    }
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
        loadFloatingConversations({ silent: true });

        if (selectedFloatingConversationId) {
          loadFloatingThread(selectedFloatingConversationId, { silent: true });
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
      loadFloatingConversations({ silent: true });

      if (selectedFloatingConversationId) {
        loadFloatingThread(selectedFloatingConversationId, { silent: true });
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
          loadFloatingThread(selectedFloatingConversationId, { silent: true });
          loadFloatingConversations({ silent: true });
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
    setFloatingAiAssistWorking(null);
    setFloatingSafetyOpen(false);
    setFloatingReportNotes("");
    setFloatingReportReason("harassment");
    setFloatingMessagesMessage("");
  }

  async function loadFloatingThread(
    conversationId: string,
    options: { silent?: boolean } = {}
  ) {
    const silent = options.silent === true;

    if (!silent) {
      setFloatingThreadLoading(true);
      setFloatingMessagesMessage("");
    }

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";

    if (!accessToken) {
      if (!silent) {
        setFloatingThreadLoading(false);
        setFloatingMessagesMessage("Log in to view messages.");
      }

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
        if (!silent) {
          setFloatingThreadMessages([]);
          setFloatingMessagesMessage(payload.error ?? "Unable to load conversation.");
          setFloatingThreadLoading(false);
        }

        return;
      }

      const nextMessages = (payload.messages ?? []) as FloatingThreadMessage[];

      setFloatingThreadMessages((current) =>
        areFloatingThreadMessagesEqual(current, nextMessages)
          ? current
          : nextMessages
      );

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

      if (!silent) {
        window.dispatchEvent(new Event("loombus:messages-changed"));
      }
    } catch {
      if (!silent) {
        setFloatingThreadMessages([]);
        setFloatingMessagesMessage("Unable to load conversation.");
      }
    }

    if (!silent) {
      setFloatingThreadLoading(false);
    }
  }


  async function openFloatingConversation(conversationId: string) {
    closeFloatingNewMessage();
    setSelectedFloatingConversationId(conversationId);
    setFloatingComposerText("");
    setFloatingTypingUserName("");
    setFloatingAttachmentFiles([]);
    setFloatingAttachmentMessage("");
    setFloatingAiAssistWorking(null);
    setFloatingSafetyOpen(false);
    setFloatingReportNotes("");
    setFloatingReportReason("harassment");
    await loadFloatingThread(conversationId);
  }

  async function runFloatingConversationAction(
    action: "archive" | "delete" | "report" | "mute" | "unmute"
  ) {
    if (!selectedFloatingConversationId || floatingConversationAction) {
      return;
    }

    setFloatingConversationAction(action);
    setFloatingMessagesMessage("");

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";

    if (!accessToken) {
      setFloatingConversationAction(null);
      setFloatingMessagesMessage("Log in to manage this conversation.");
      return;
    }

    const endpoint =
      action === "mute" || action === "unmute"
        ? "/api/messages/mute"
        : action === "report"
          ? "/api/messages/report"
          : `/api/messages/${action}`;

    const body =
      action === "mute" || action === "unmute"
        ? {
            conversationId: selectedFloatingConversationId,
            muted: action === "mute",
          }
        : action === "report"
          ? {
              conversationId: selectedFloatingConversationId,
              reason: floatingReportReason,
              notes: floatingReportNotes,
            }
          : {
              conversationId: selectedFloatingConversationId,
            };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFloatingMessagesMessage(payload.error ?? "Unable to update conversation.");
        setFloatingConversationAction(null);
        return;
      }

      if (action === "mute" || action === "unmute") {
        setFloatingConversations((current) =>
          current.map((conversation) =>
            conversation.id === selectedFloatingConversationId
              ? {
                  ...conversation,
                  mutedAt: action === "mute" ? payload.mutedAt ?? new Date().toISOString() : null,
                }
              : conversation
          )
        );

        setFloatingMessagesMessage(action === "mute" ? "Conversation muted." : "Conversation unmuted.");
      }

      if (action === "report") {
        setFloatingSafetyOpen(false);
        setFloatingReportNotes("");
        setFloatingReportReason("harassment");
        setFloatingMessagesMessage("Conversation reported for review.");
      }

      if (action === "archive" || action === "delete") {
        const conversationId = selectedFloatingConversationId;

        setFloatingConversations((current) =>
          current.filter((conversation) => conversation.id !== conversationId)
        );
        closeFloatingThread();
        setFloatingMessagesMessage(
          action === "archive" ? "Conversation archived." : "Conversation deleted."
        );
      }

      await loadFloatingConversations();
      await loadMessageUnreadCount();
      window.dispatchEvent(new Event("loombus:messages-changed"));
    } catch {
      setFloatingMessagesMessage("Unable to update conversation.");
    }

    setFloatingConversationAction(null);
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

  async function runFloatingAiAssist(mode: "clearer" | "warmer" | "shorter" | "rewrite") {
    if (floatingAiAssistWorking) {
      return;
    }

    const draft = floatingComposerText.trim();

    if (draft.length < 3) {
      setFloatingMessagesMessage("Write a message draft first.");
      return;
    }

    setFloatingAiAssistWorking(mode);
    setFloatingMessagesMessage("");

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";

    if (!accessToken) {
      setFloatingAiAssistWorking(null);
      setFloatingMessagesMessage("Log in to use AI message assist.");
      return;
    }

    try {
      const response = await fetch("/api/messages/ai-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          text: draft,
          mode,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFloatingMessagesMessage(payload.error ?? "Unable to improve this message.");
        setFloatingAiAssistWorking(null);
        return;
      }

      setFloatingComposerText(String(payload.assistedText ?? draft));
      setFloatingMessagesMessage("AI assist updated your draft.");
    } catch {
      setFloatingMessagesMessage("Unable to improve this message.");
    }

    setFloatingAiAssistWorking(null);
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

      await loadFloatingThread(selectedFloatingConversationId, { silent: true });
      await loadFloatingConversations({ silent: true });
      await loadMessageUnreadCount();
      window.dispatchEvent(new Event("loombus:messages-changed"));
    } catch {
      setFloatingMessagesMessage("Unable to send message.");
    }

    setFloatingSending(false);
  }


  function getGlobalSearchAiContext() {
    const pageResults = globalPageResults.map((result) => ({
      kind: "Page",
      title: result.title,
      description: result.description,
      href: result.href,
    }));

    const profileResults = globalSearchProfiles.map((profile) => ({
      kind: "Person",
      title: profile.full_name || profile.username || "Loombus member",
      description: [profile.username ? `@${profile.username}` : "", profile.bio ?? ""].filter(Boolean).join(" · "),
      href: profile.username ? `/u/${profile.username}` : "/people",
    }));

    const discussionResults = globalSearchDiscussions.map((discussion) => ({
      kind: "Discussion",
      title: discussion.title,
      description: [
        discussion.topic,
        discussion.purpose_lane ?? "",
        discussion.reality_lens ?? "",
        discussion.body ?? "",
      ].filter(Boolean).join(" · "),
      href: `/discussions/${discussion.id}`,
    }));

    const savedResults = globalSearchSaved.map((item) => {
      const discussion = item.discussions;

      return {
        kind: "Saved",
        title: discussion?.title ?? "Saved discussion",
        description: [
          discussion?.topic ?? "",
          discussion?.purpose_lane ?? "",
          item.private_note ? `Private note: ${item.private_note}` : "",
        ].filter(Boolean).join(" · "),
        href: discussion ? `/discussions/${discussion.id}` : "/saved",
      };
    });

    const contextSummary = {
      kind: "Context summary",
      title: "Available matching Loombus results",
      description: [
        `People: ${profileResults.length}`,
        `Discussions: ${discussionResults.length}`,
        `Saved: ${savedResults.length}`,
        `Pages: ${pageResults.length}`,
      ].join(" · "),
      href: "",
    };

    return [
      contextSummary,
      ...profileResults,
      ...discussionResults,
      ...savedResults,
      ...pageResults,
    ].slice(0, 12);
  }

  async function askGlobalSearchAi() {
    const query = globalSearchQuery.trim();

    if (query.length < 2 || globalSearchAiWorking) {
      return;
    }

    setGlobalSearchAiWorking(true);
    setGlobalSearchAiAnswer("");
    setGlobalSearchAiMessage("");
    setGlobalSearchAiUpgradeRequired(false);

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      setGlobalSearchAiMessage("Log in to use Ask Loombus AI.");
      setGlobalSearchAiWorking(false);
      return;
    }

    try {
      const response = await fetch("/api/search/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query,
          context: getGlobalSearchAiContext(),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (result.upgradeRequired) {
          setGlobalSearchAiUpgradeRequired(true);
          setGlobalSearchAiMessage(result.error ?? "Ask Loombus AI requires Premium access.");
        } else {
          setGlobalSearchAiMessage(result.error ?? "Unable to ask Loombus AI.");
        }

        return;
      }

      setGlobalSearchAiAnswer(result.answer ?? "");
      setGlobalSearchAiMessage("");
    } catch (error) {
      setGlobalSearchAiMessage(
        error instanceof Error ? error.message : "Unable to ask Loombus AI."
      );
    } finally {
      setGlobalSearchAiWorking(false);
    }
  }

  function getGlobalSearchAiQuickActions() {
    const firstDiscussion = globalSearchDiscussions[0];
    const firstSaved = globalSearchSaved[0];
    const firstSavedDiscussion = firstSaved?.discussions;
    const firstProfile = globalSearchProfiles[0];
    const cleanQuery = globalSearchQuery.trim();

    const actions: {
      label: string;
      href: string;
      primary?: boolean;
    }[] = [];

    if (firstDiscussion) {
      actions.push({
        label: "Open discussion",
        href: `/discussions/${firstDiscussion.id}`,
        primary: true,
      });
    }

    if (firstSaved) {
      actions.push({
        label: "Open saved item",
        href: firstSavedDiscussion ? `/discussions/${firstSavedDiscussion.id}` : "/saved",
      });
    }

    if (firstProfile) {
      actions.push({
        label: "Open profile",
        href: firstProfile.username ? `/u/${firstProfile.username}` : "/people",
      });
    }

    if (cleanQuery.length >= 2) {
      actions.push({
        label: "Create discussion",
        href: `/create?prompt=${encodeURIComponent(cleanQuery)}`,
      });
    }

    actions.push({
      label: "Advanced search",
      href: "/search",
    });

    return actions.slice(0, 5);
  }

  function closeGlobalSearch() {
    setGlobalSearchOpen(false);
    setGlobalSearchQuery("");
    setGlobalSearchProfiles([]);
    setGlobalSearchDiscussions([]);
    setGlobalSearchSaved([]);
    setGlobalSearchAiAnswer("");
    setGlobalSearchAiMessage("");
    setGlobalSearchAiWorking(false);
    setGlobalSearchAiUpgradeRequired(false);
    setGlobalSearchLoading(false);
  }

  const globalSearchCleanQuery = globalSearchQuery.trim().toLowerCase();
  const globalPageResults = GLOBAL_SEARCH_RESULTS.filter((result) =>
    matchesGlobalSearchResult(result, globalSearchCleanQuery)
  ).slice(0, globalSearchCleanQuery ? 8 : 6);
  const hasGlobalSearchResults =
    globalSearchProfiles.length > 0 ||
    globalSearchDiscussions.length > 0 ||
    globalSearchSaved.length > 0 ||
    globalPageResults.length > 0;
  const shouldOfferCreateFromSearch =
    Boolean(globalSearchCleanQuery) && !globalSearchLoading && !hasGlobalSearchResults;

  return (
    <div className="min-h-screen bg-[var(--loombus-bg)] text-[var(--loombus-text)] antialiased">
      <div className={user ? "pb-24 md:pb-0" : ""}>
        {children}
      </div>

      {user && globalSearchOpen && (
        <div
          className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[70] px-3 sm:px-6 md:left-6 md:right-auto md:top-[6.25rem] lg:left-8 md:w-[26rem] lg:w-[28rem]"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Loombus search overlay"
            className="pointer-events-auto flex w-full flex-col overflow-hidden rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-2xl shadow-black/20"
          >
            <div className="border-b border-[var(--loombus-border)] p-4">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">
                    Loombus Search
                  </p>

                  <h2 className="text-lg font-semibold tracking-tight">
                    Search Loombus.
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeGlobalSearch}
                  className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-medium text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                >
                  Close
                </button>
              </div>

              <label htmlFor="loombus-global-command-search" className="block">
                <span className="sr-only">Search Loombus</span>
                <input
                  id="loombus-global-command-search"
                  type="search"
                  value={globalSearchQuery}
                  onChange={(event) => setGlobalSearchQuery(event.target.value)}
                  placeholder="Search pages, discussions, people, saved items, topics, or ask Loombus AI..."
                  autoFocus
                  className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-bg)] px-5 py-3.5 text-base text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-[var(--loombus-text-subtle)] sm:text-lg"
                />
              </label>
            </div>

            <div className="max-h-[min(32rem,calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-7rem))] overflow-y-auto p-4">
              <section className="mb-4 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)]">
                    <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      Ask Loombus AI
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                      Ask a Premium AI helper to turn your search into a short answer, useful context, and a next action.
                    </p>

                    {globalSearchAiAnswer && (
                      <div className="mt-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-bg)] p-3">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                          {globalSearchAiAnswer}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {getGlobalSearchAiQuickActions().map((action) => (
                            <Link
                              key={`${action.label}-${action.href}`}
                              href={action.href}
                              onClick={closeGlobalSearch}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                action.primary
                                  ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] hover:opacity-90"
                                  : "border border-[var(--loombus-border)] text-[var(--loombus-text-muted)] hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                              }`}
                            >
                              {action.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {globalSearchAiMessage && (
                      <div className="mt-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-bg)] p-3 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                        <p>{globalSearchAiMessage}</p>

                        {globalSearchAiUpgradeRequired && (
                          <Link
                            href="/premium"
                            onClick={closeGlobalSearch}
                            className="mt-3 inline-flex rounded-full bg-[var(--loombus-primary-bg)] px-4 py-2 text-xs font-medium text-[var(--loombus-primary-text)] transition hover:opacity-90"
                          >
                            Upgrade to Premium
                          </Link>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={askGlobalSearchAi}
                    disabled={globalSearchQuery.trim().length < 2 || globalSearchAiWorking}
                    className="shrink-0 rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-medium text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {globalSearchAiWorking ? "Asking..." : "Ask"}
                  </button>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--loombus-text-subtle)]">
                      Results
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">
                      {globalSearchCleanQuery ? "Matching results" : "Start searching"}
                    </h3>
                  </div>

                  <Link
                    href="/search"
                    onClick={closeGlobalSearch}
                    className="text-sm text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]"
                  >
                    Advanced search →
                  </Link>
                </div>

                <div className="grid gap-4">
                  {globalSearchLoading && (
                    <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-bg)] p-4 text-sm text-[var(--loombus-text-muted)]">
                      Searching Loombus...
                    </div>
                  )}

                  {globalSearchProfiles.length > 0 && (
                    <div className="grid gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                        People
                      </p>

                      {globalSearchProfiles.map((profile) => (
                        <Link
                          key={profile.id}
                          href={profile.username ? `/u/${profile.username}` : "/people"}
                          onClick={closeGlobalSearch}
                          className="group rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-bg)] p-4 transition hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {profile.full_name || profile.username || "Loombus member"}
                              </p>
                              <p className="mt-1 truncate text-sm text-[var(--loombus-text-muted)]">
                                {profile.username ? `@${profile.username}` : "Profile"}
                              </p>
                              {profile.bio && (
                                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                                  {profile.bio}
                                </p>
                              )}
                            </div>

                            <span className="shrink-0 rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-subtle)]">
                              User
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {globalSearchDiscussions.length > 0 && (
                    <div className="grid gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                        Discussions and topics
                      </p>

                      {globalSearchDiscussions.map((discussion) => (
                        <Link
                          key={discussion.id}
                          href={`/discussions/${discussion.id}`}
                          onClick={closeGlobalSearch}
                          className="group rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-bg)] p-4 transition hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="line-clamp-2 font-semibold">
                                {discussion.title}
                              </p>
                              <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                                {discussion.topic}
                                {discussion.purpose_lane ? ` · ${discussion.purpose_lane}` : ""}
                                {discussion.reality_lens ? ` · ${discussion.reality_lens}` : ""}
                              </p>
                              {(discussion.contributorName || discussion.contributorUsername) && (
                                <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">
                                  By {discussion.contributorName || `@${discussion.contributorUsername}`}
                                </p>
                              )}
                              {discussion.body && (
                                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                                  {discussion.body}
                                </p>
                              )}
                            </div>

                            <span className="shrink-0 rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-subtle)]">
                              Discussion
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {globalSearchSaved.length > 0 && (
                    <div className="grid gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                        Saved
                      </p>

                      {globalSearchSaved.map((item) => {
                        const discussion = item.discussions;

                        return (
                          <Link
                            key={item.id}
                            href={discussion ? `/discussions/${discussion.id}` : "/saved"}
                            onClick={closeGlobalSearch}
                            className="group rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-bg)] p-4 transition hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="line-clamp-2 font-semibold">
                                  {discussion?.title ?? "Saved discussion"}
                                </p>
                                <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                                  {discussion?.topic ?? "Saved"}
                                  {discussion?.purpose_lane ? ` · ${discussion.purpose_lane}` : ""}
                                </p>
                                {item.private_note && (
                                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                                    Private note: {item.private_note}
                                  </p>
                                )}
                              </div>

                              <span className="shrink-0 rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-subtle)]">
                                Saved
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {globalPageResults.length > 0 && (
                    <div className="grid gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                        Pages
                      </p>

                      {globalPageResults.map((result) => (
                        <Link
                          key={result.href}
                          href={result.href}
                          onClick={closeGlobalSearch}
                          className="group rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-bg)] p-4 transition hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">
                                {result.title}
                              </p>
                              <p className="mt-1 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                                {result.description}
                              </p>
                            </div>

                            <span className="shrink-0 rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-subtle)]">
                              {result.category}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {shouldOfferCreateFromSearch && (
                    <div className="grid gap-3">
                      <Link
                        href="/create"
                        onClick={closeGlobalSearch}
                        className="group rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-bg)] p-4 transition hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              Create discussion from “{globalSearchQuery.trim()}”
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                              Nothing matched yet. Turn this search into a focused Loombus discussion.
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-subtle)]">
                            Create
                          </span>
                        </div>
                      </Link>

                      <Link
                        href="/search"
                        onClick={closeGlobalSearch}
                        className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-bg)] p-4 text-sm text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                      >
                        Search deeper in Advanced search →
                      </Link>
                    </div>
                  )}

                  {!globalSearchCleanQuery && (
                    <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-bg)] p-4 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                      Type a username, discussion title, topic, saved item, or platform page.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}

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

      {user && (
        <>
          <div className="loombus-floating-utility-stack fixed right-4 z-50 flex flex-col gap-2">
            <Link
              href={getCurrentGuideHref()}
              aria-label="Open help for this page"
              title="Help"
              className="loombus-floating-utility-button loombus-floating-help-button"
            >
              <HelpCircle aria-hidden="true" className="h-5 w-5" strokeWidth={2.1} />
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setAppearancePickerOpen((current) => !current)}
                aria-label="Choose appearance"
                aria-expanded={appearancePickerOpen}
                title="Appearance"
                className={`loombus-floating-utility-button ${
                  appearancePickerOpen ? "loombus-floating-utility-button-active" : ""
                }`}
              >
                <Palette aria-hidden="true" className="h-5 w-5" strokeWidth={2.1} />
              </button>

              {appearancePickerOpen && (
                <div className="loombus-floating-appearance-panel absolute bottom-0 right-[3.65rem] w-44 rounded-3xl border p-2 shadow-2xl backdrop-blur-xl">
                  <p className="px-3 pb-2 pt-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
                    Appearance
                  </p>

                  {([
                    ["light", "Light"],
                    ["system", "System"],
                    ["dark", "Dark"],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => applyAppearanceMode(mode)}
                      className={`loombus-floating-appearance-option ${
                        appearanceMode === mode ? "loombus-floating-appearance-option-active" : ""
                      }`}
                      aria-pressed={appearanceMode === mode}
                    >
                      <span>{label}</span>
                      {appearanceMode === mode && (
                        <span aria-hidden="true">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/stickies"
              aria-label="Open Stickies"
              title="Stickies"
              className="loombus-floating-utility-button"
            >
              <StickyNote aria-hidden="true" className="h-5 w-5" strokeWidth={2.1} />
            </Link>
          </div>

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
                    Messages
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

                      <button
                        type="button"
                        onClick={() => setFloatingSafetyOpen((current) => !current)}
                        className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                      >
                        Safety
                      </button>

                      <Link
                        href={`/messages?conversation=${selectedFloatingConversation.id}`}
                        onClick={() => setFloatingMessagesOpen(false)}
                        className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                      >
                        Full
                      </Link>
                    </div>

                    {floatingSafetyOpen && (
                      <div className="border-b border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-5 py-4">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              runFloatingConversationAction(
                                selectedFloatingConversation.mutedAt ? "unmute" : "mute"
                              )
                            }
                            disabled={Boolean(floatingConversationAction)}
                            className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {floatingConversationAction === "mute"
                              ? "Muting..."
                              : floatingConversationAction === "unmute"
                                ? "Unmuting..."
                                : selectedFloatingConversation.mutedAt
                                  ? "Unmute"
                                  : "Mute"}
                          </button>

                          <button
                            type="button"
                            onClick={() => runFloatingConversationAction("archive")}
                            disabled={Boolean(floatingConversationAction)}
                            className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {floatingConversationAction === "archive" ? "Archiving..." : "Archive"}
                          </button>

                          <button
                            type="button"
                            onClick={() => runFloatingConversationAction("delete")}
                            disabled={Boolean(floatingConversationAction)}
                            className="rounded-full border border-red-500/40 px-3 py-1.5 text-xs text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {floatingConversationAction === "delete" ? "Deleting..." : "Delete"}
                          </button>
                        </div>

                        <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-xs font-medium text-[var(--loombus-text)]">
                              Report conversation
                            </p>

                            <button
                              type="button"
                              onClick={() => runFloatingConversationAction("report")}
                              disabled={Boolean(floatingConversationAction)}
                              className="rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {floatingConversationAction === "report" ? "Submitting..." : "Submit"}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {[
                              ["harassment", "Harassment"],
                              ["spam", "Spam"],
                              ["abuse", "Abuse"],
                              ["scam", "Scam"],
                              ["impersonation", "Impersonation"],
                              ["other", "Other"],
                            ].map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setFloatingReportReason(value)}
                                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                                  floatingReportReason === value
                                    ? "border-red-500/60 bg-red-500/10 text-red-500"
                                    : "border-[var(--loombus-border)] text-[var(--loombus-text-muted)] hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>

                          <textarea
                            value={floatingReportNotes}
                            onChange={(event) => setFloatingReportNotes(event.target.value)}
                            placeholder="Optional notes for admins..."
                            rows={2}
                            maxLength={1000}
                            className="mt-3 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-2 text-sm text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-muted)]"
                          />
                        </div>
                      </div>
                    )}

                    {floatingMessagesMessage && (
                      <p className="border-b border-[var(--loombus-border)] px-5 py-3 text-sm text-[var(--loombus-text-muted)]">
                        {floatingMessagesMessage}
                      </p>
                    )}

                    <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
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
                                className={`max-w-[78%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                                  mine
                                    ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]"
                                    : "bg-[var(--loombus-surface-muted)] text-[var(--loombus-text)]"
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
                                  className={`mt-1 text-[10px] leading-none ${
                                    mine
                                      ? "opacity-70"
                                      : "text-[var(--loombus-text-muted)]"
                                  }`}
                                >
                                  {new Date(threadMessage.createdAt).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
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
                      <div className="mb-3 flex flex-wrap gap-2">
                        {([
                          ["clearer", "Clearer"],
                          ["warmer", "Warmer"],
                          ["shorter", "Shorter"],
                          ["rewrite", "Rewrite"],
                        ] as const).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => runFloatingAiAssist(mode)}
                            disabled={Boolean(floatingAiAssistWorking) || floatingComposerText.trim().length < 3}
                            className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {floatingAiAssistWorking === mode ? "Working..." : label}
                          </button>
                        ))}

                        <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-subtle)]">
                          Premium Plus AI
                        </span>
                      </div>

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

    </div>
  );
}
