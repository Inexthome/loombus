"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";
import {
  ALLOWED_MESSAGE_ATTACHMENT_MIME_TYPES,
  type Conversation,
  type ConversationAction,
  type ConversationFilter,
  type MessageAttachment,
  MESSAGE_ATTACHMENT_BUCKET,
  MAX_MESSAGE_ATTACHMENT_FILES,
  MAX_MESSAGE_ATTACHMENT_SIZE_BYTES,
  type NoticeTone,
  type PeopleSearchResult,
  type ThreadMessage,
  getSafeMessageAttachmentFileName,
} from "./messages-v2-model";

export function useMessagesV2() {
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Someone");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);

  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [peopleSearchQuery, setPeopleSearchQuery] = useState("");
  const [peopleSearchResults, setPeopleSearchResults] = useState<PeopleSearchResult[]>([]);
  const [peopleSearchLoading, setPeopleSearchLoading] = useState(false);
  const [startingConversation, setStartingConversation] = useState<string | null>(null);

  const [composerText, setComposerText] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [typingUserName, setTypingUserName] = useState("");
  const [sending, setSending] = useState(false);

  const [conversationAction, setConversationAction] = useState<string | null>(null);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportNotes, setReportNotes] = useState("");

  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("neutral");

  const showNotice = useCallback((text: string, tone: NoticeTone = "neutral") => {
    setNotice(text);
    setNoticeTone(tone);
  }, []);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const requireAccessToken = useCallback(async () => {
    const token = await getAccessToken();
    if (!token && typeof window !== "undefined") window.location.href = "/login";
    return token;
  }, [getAccessToken]);

  const loadConversations = useCallback(
    async ({ preserveSelection = true }: { preserveSelection?: boolean } = {}) => {
      const token = await requireAccessToken();
      if (!token) return [] as Conversation[];

      const response = await fetch("/api/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load conversations.");
      }

      const loaded = (payload.conversations ?? []) as Conversation[];
      setConversations(loaded);

      setSelectedConversationId((current) => {
        if (preserveSelection && current && loaded.some((item) => item.id === current)) {
          return current;
        }
        return loaded[0]?.id ?? null;
      });

      return loaded;
    },
    [requireAccessToken]
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          window.location.href = "/login";
          return;
        }

        if (cancelled) return;
        setCurrentUserId(userData.user.id);

        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("full_name, username")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (cancelled) return;
        setCurrentUserName(
          currentProfile?.full_name?.trim() ||
            currentProfile?.username?.trim() ||
            userData.user.email?.split("@")[0] ||
            "Someone"
        );

        const loaded = await loadConversations({ preserveSelection: false });
        if (cancelled) return;

        const requestedConversationId = new URLSearchParams(window.location.search).get(
          "conversation"
        );
        const requested = requestedConversationId
          ? loaded.find((conversation) => conversation.id === requestedConversationId)
          : null;

        if (requested) {
          setSelectedConversationId(requested.id);
          setMobileThreadOpen(true);
        }
      } catch (error) {
        if (!cancelled) {
          showNotice(
            error instanceof Error ? error.message : "Unable to load conversations.",
            "error"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [loadConversations, showNotice]);

  const reloadThread = useCallback(
    async (conversationId: string) => {
      const token = await requireAccessToken();
      if (!token) return;

      const response = await fetch(
        `/api/messages/thread?id=${encodeURIComponent(conversationId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load messages.");
      }

      setThreadMessages((payload.messages ?? []) as ThreadMessage[]);

      await fetch("/api/messages/mark-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId }),
      });

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, hasUnread: false }
            : conversation
        )
      );
      window.dispatchEvent(new Event("loombus:messages-changed"));
    },
    [requireAccessToken]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedThread() {
      if (!selectedConversationId) {
        setThreadMessages([]);
        return;
      }

      setThreadLoading(true);
      setTypingUserName("");
      try {
        await reloadThread(selectedConversationId);
      } catch (error) {
        if (!cancelled) {
          setThreadMessages([]);
          showNotice(
            error instanceof Error ? error.message : "Unable to load messages.",
            "error"
          );
        }
      } finally {
        if (!cancelled) setThreadLoading(false);
      }
    }

    void loadSelectedThread();
    return () => {
      cancelled = true;
    };
  }, [reloadThread, selectedConversationId, showNotice]);

  useEffect(() => {
    if (!selectedConversationId || !currentUserId) {
      setTypingUserName("");
      return;
    }

    const channel = supabase.channel(`private-message-typing:${selectedConversationId}`);
    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.userId === currentUserId) return;
        setTypingUserName(String(payload.name ?? "Someone"));
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUserName(""), 4000);
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedConversationId]);

  useEffect(() => {
    if (!newMessageOpen) return;
    const query = peopleSearchQuery.trim();

    if (query.length < 2) {
      setPeopleSearchResults([]);
      setPeopleSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setPeopleSearchLoading(true);
      try {
        const token = await requireAccessToken();
        if (!token) return;
        const response = await fetch(
          `/api/messages/people-search?q=${encodeURIComponent(query)}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
        );
        const payload = await response.json().catch(() => ({}));
        if (!cancelled) {
          setPeopleSearchResults(
            response.ok ? ((payload.people ?? []) as PeopleSearchResult[]) : []
          );
        }
      } catch {
        if (!cancelled) setPeopleSearchResults([]);
      } finally {
        if (!cancelled) setPeopleSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [newMessageOpen, peopleSearchQuery, requireAccessToken]);

  useEffect(() => {
    if (!threadLoading) {
      window.setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 0);
    }
  }, [threadLoading, threadMessages, typingUserName]);

  const selectedConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === selectedConversationId) ??
      null,
    [conversations, selectedConversationId]
  );

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (conversationFilter === "unread" && !conversation.hasUnread) return false;
      if (conversationFilter === "muted" && !conversation.mutedAt) return false;
      if (!query) return true;
      return [
        conversation.otherFullName,
        conversation.otherUsername,
        conversation.lastMessagePreview,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [conversationFilter, conversationSearch, conversations]);

  const unreadCount = useMemo(
    () => conversations.filter((conversation) => conversation.hasUnread).length,
    [conversations]
  );

  const mutedCount = useMemo(
    () => conversations.filter((conversation) => Boolean(conversation.mutedAt)).length,
    [conversations]
  );

  const sharedAttachments = useMemo(
    () => threadMessages.flatMap((threadMessage) => threadMessage.attachments ?? []),
    [threadMessages]
  );

  const selectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setMobileThreadOpen(true);
    setConversationMenuOpen(false);
    setDetailsOpen(false);
    setReportPanelOpen(false);
    setNotice("");
    const url = new URL(window.location.href);
    url.searchParams.set("conversation", conversationId);
    window.history.replaceState({}, "", url);
  }, []);

  const closeMobileThread = useCallback(() => {
    setMobileThreadOpen(false);
    setDetailsOpen(false);
  }, []);

  const openNewMessage = useCallback(() => {
    setPeopleSearchQuery("");
    setPeopleSearchResults([]);
    setNewMessageOpen(true);
  }, []);

  const closeNewMessage = useCallback(() => {
    if (startingConversation) return;
    setNewMessageOpen(false);
    setPeopleSearchQuery("");
    setPeopleSearchResults([]);
  }, [startingConversation]);

  const handleStartConversation = useCallback(
    async (person: PeopleSearchResult) => {
      setStartingConversation(person.id);
      setNotice("");
      try {
        const token = await requireAccessToken();
        if (!token) return;
        const response = await fetch("/api/messages/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetUserId: person.id }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "Unable to start conversation.");

        await loadConversations();
        selectConversation(payload.conversationId);
        setComposerText("");
        setNewMessageOpen(false);
        setPeopleSearchQuery("");
        setPeopleSearchResults([]);
        window.setTimeout(() => composerRef.current?.focus(), 0);
      } catch (error) {
        showNotice(
          error instanceof Error ? error.message : "Unable to start conversation.",
          "error"
        );
      } finally {
        setStartingConversation(null);
      }
    },
    [loadConversations, requireAccessToken, selectConversation, showNotice]
  );

  const runConversationAction = useCallback(
    async (
      action: ConversationAction,
      reportOptions?: { reason?: string; notes?: string }
    ) => {
      if (!selectedConversationId) return;

      if (action === "report" && !reportOptions) {
        setConversationMenuOpen(false);
        setReportPanelOpen(true);
        return;
      }

      if (action === "archive") {
        const confirmed = window.confirm("Archive this conversation from your inbox?");
        if (!confirmed) return;
      }

      if (action === "delete") {
        const confirmed = window.confirm(
          "Delete this conversation from your inbox? This only removes it for you."
        );
        if (!confirmed) return;
      }

      setConversationAction(action);
      setConversationMenuOpen(false);
      setNotice("");

      try {
        const token = await requireAccessToken();
        if (!token) return;

        if (action === "mute" || action === "unmute") {
          const response = await fetch("/api/messages/mute", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              conversationId: selectedConversationId,
              muted: action === "mute",
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error ?? "Unable to update mute setting.");

          setConversations((current) =>
            current.map((conversation) =>
              conversation.id === selectedConversationId
                ? { ...conversation, mutedAt: payload.mutedAt }
                : conversation
            )
          );
          showNotice(action === "mute" ? "Conversation muted." : "Conversation unmuted.", "success");
          return;
        }

        const response = await fetch(`/api/messages/${action}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            conversationId: selectedConversationId,
            ...(action === "report"
              ? {
                  reason: reportOptions?.reason ?? reportReason,
                  notes: reportOptions?.notes ?? reportNotes,
                }
              : {}),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? `Unable to ${action} conversation.`);
        }

        if (action === "report") {
          setReportPanelOpen(false);
          setReportNotes("");
          setReportReason("harassment");
          showNotice("Conversation reported for review.", "success");
          return;
        }

        const remaining = conversations.filter(
          (conversation) => conversation.id !== selectedConversationId
        );
        setConversations(remaining);
        setSelectedConversationId(remaining[0]?.id ?? null);
        setThreadMessages([]);
        setMobileThreadOpen(false);
        setDetailsOpen(false);
        showNotice(
          action === "archive" ? "Conversation archived." : "Conversation removed from your inbox.",
          "success"
        );
      } catch (error) {
        showNotice(
          error instanceof Error ? error.message : `Unable to ${action} conversation.`,
          "error"
        );
      } finally {
        setConversationAction(null);
      }
    },
    [
      conversations,
      reportNotes,
      reportReason,
      requireAccessToken,
      selectedConversationId,
      showNotice,
    ]
  );

  const sendTypingIndicator = useCallback(() => {
    if (!selectedConversationId || !currentUserId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    void supabase.channel(`private-message-typing:${selectedConversationId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, name: currentUserName || "Someone" },
    });
  }, [currentUserId, currentUserName, selectedConversationId]);

  const handleAttachmentSelection = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    setAttachmentMessage("");

    if (selectedFiles.length === 0) {
      setAttachmentFiles([]);
      return;
    }

    if (selectedFiles.length > MAX_MESSAGE_ATTACHMENT_FILES) {
      setAttachmentFiles([]);
      setAttachmentMessage("You can attach up to 3 files.");
      event.target.value = "";
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) =>
        !ALLOWED_MESSAGE_ATTACHMENT_MIME_TYPES.has(file.type) ||
        file.size <= 0 ||
        file.size > MAX_MESSAGE_ATTACHMENT_SIZE_BYTES
    );

    if (invalidFile) {
      setAttachmentFiles([]);
      setAttachmentMessage(
        "Attachments must be JPG, PNG, WebP, GIF, or PDF files up to 10 MB each."
      );
      event.target.value = "";
      return;
    }

    setAttachmentFiles(selectedFiles);
    setAttachmentMessage(
      `${selectedFiles.length} attachment${selectedFiles.length === 1 ? "" : "s"} ready.`
    );
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachmentFiles([]);
    setAttachmentMessage("");
  }, []);

  const uploadMessageAttachments = useCallback(
    async ({
      conversationId,
      messageId,
      accessToken,
    }: {
      conversationId: string;
      messageId: string;
      accessToken: string;
    }) => {
      if (!currentUserId || attachmentFiles.length === 0) return true;

      for (const [index, file] of attachmentFiles.entries()) {
        const extension =
          getSafeMessageAttachmentFileName(file.name).split(".").pop() || "file";
        const storagePath = `${currentUserId}/${conversationId}/${messageId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(MESSAGE_ATTACHMENT_BUCKET)
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          showNotice(`Attachment upload failed: ${uploadError.message}`, "error");
          setAttachmentMessage(`${file.name} could not upload.`);
          return false;
        }

        const { data: publicUrlData } = supabase.storage
          .from(MESSAGE_ATTACHMENT_BUCKET)
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
          await supabase.storage.from(MESSAGE_ATTACHMENT_BUCKET).remove([storagePath]);
          showNotice(
            `Attachment save failed: ${result.error ?? "Unknown attachment error."}`,
            "error"
          );
          setAttachmentMessage(result.error ?? `${file.name} could not be attached.`);
          return false;
        }
      }

      return true;
    },
    [attachmentFiles, currentUserId, showNotice]
  );

  const handleSendMessage = useCallback(async () => {
    if (!selectedConversationId || sending) return;
    const body = composerText.trim();
    const hasAttachments = attachmentFiles.length > 0;
    if (!body && !hasAttachments) return;

    setSending(true);
    setNotice("");

    try {
      const token = await requireAccessToken();
      if (!token) return;
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          body,
          hasAttachments,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to send message.");

      if (hasAttachments) {
        const uploaded = await uploadMessageAttachments({
          conversationId: selectedConversationId,
          messageId: payload.message.id,
          accessToken: token,
        });
        if (!uploaded) return;
      }

      setComposerText("");
      clearAttachments();
      await reloadThread(selectedConversationId);
      const now = new Date().toISOString();
      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === selectedConversationId
              ? {
                  ...conversation,
                  lastMessagePreview: body || "[Attachment]",
                  lastMessageAt: now,
                }
              : conversation
          )
          .sort((a, b) =>
            (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")
          )
      );
      window.setTimeout(() => composerRef.current?.focus(), 0);
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Unable to send message.",
        "error"
      );
    } finally {
      setSending(false);
    }
  }, [
    attachmentFiles.length,
    clearAttachments,
    composerText,
    reloadThread,
    requireAccessToken,
    selectedConversationId,
    sending,
    showNotice,
    uploadMessageAttachments,
  ]);

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        void handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  return {
    threadEndRef,
    composerRef,
    loading,
    threadLoading,
    currentUserId,
    conversations,
    selectedConversation,
    selectedConversationId,
    threadMessages,
    mobileThreadOpen,
    filteredConversations,
    conversationSearch,
    setConversationSearch,
    conversationFilter,
    setConversationFilter,
    unreadCount,
    mutedCount,
    newMessageOpen,
    peopleSearchQuery,
    setPeopleSearchQuery,
    peopleSearchResults,
    peopleSearchLoading,
    startingConversation,
    composerText,
    setComposerText,
    attachmentFiles,
    attachmentMessage,
    typingUserName,
    sending,
    conversationAction,
    conversationMenuOpen,
    setConversationMenuOpen,
    detailsOpen,
    setDetailsOpen,
    reportPanelOpen,
    setReportPanelOpen,
    reportReason,
    setReportReason,
    reportNotes,
    setReportNotes,
    sharedAttachments,
    notice,
    noticeTone,
    showNotice,
    selectConversation,
    closeMobileThread,
    openNewMessage,
    closeNewMessage,
    handleStartConversation,
    runConversationAction,
    sendTypingIndicator,
    handleAttachmentSelection,
    clearAttachments,
    handleSendMessage,
    handleComposerKeyDown,
  };
}
