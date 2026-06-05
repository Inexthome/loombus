"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/profile-avatar";

const ATTACHMENT_BUCKET = "message-attachments";
const MAX_ATTACHMENT_FILES = 3;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function formatAttachmentFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getSafeAttachmentFileName(fileName: string) {
  return fileName.trim().replace(/[\\/]/g, "-").slice(0, 120);
}

type Conversation = {
  id: string;
  otherUserId: string | null;
  otherUsername: string | null;
  otherFullName: string | null;
  otherAvatarUrl: string | null;
  hasUnread: boolean;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
};

type MessageAttachment = {
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

type ThreadMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedBySender: boolean;
  attachments?: MessageAttachment[];
};

type PeopleSearchResult = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

export default function MessagesPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [composerText, setComposerText] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [peopleSearchQuery, setPeopleSearchQuery] = useState("");
  const [conversationSearchQuery, setConversationSearchQuery] = useState("");
  const [peopleSearchResults, setPeopleSearchResults] = useState<PeopleSearchResult[]>([]);
  const [peopleSearchLoading, setPeopleSearchLoading] = useState(false);
  const [startingConversation, setStartingConversation] = useState<string | null>(null);
  const [conversationAction, setConversationAction] = useState<string | null>(null);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportNotes, setReportNotes] = useState("");

  useEffect(() => {
    async function loadConversations() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(userData.user.id);

      try {
        const session = await supabase.auth.getSession();

        const response = await fetch("/api/messages/conversations", {
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
          },
        });

        const payload = await response.json();

        if (!response.ok) {
          setMessage(payload.error ?? "Unable to load conversations.");
          setLoading(false);
          return;
        }

        const loadedConversations = (payload.conversations ?? []) as Conversation[];

        setConversations(loadedConversations);

        if (loadedConversations.length > 0) {
          const requestedConversationId =
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("conversation")
              : null;

          const requestedConversation = requestedConversationId
            ? loadedConversations.find(
                (conversation) => conversation.id === requestedConversationId
              )
            : null;

          setSelectedConversationId(
            requestedConversation?.id ?? loadedConversations[0].id
          );

          if (requestedConversation?.id) {
            setMobileThreadOpen(true);
          }
        }
      } catch {
        setMessage("Unable to load conversations.");
      }

      setLoading(false);
    }

    loadConversations();
  }, []);

  useEffect(() => {
    async function loadThread() {
      if (!selectedConversationId) {
        setThreadMessages([]);
        return;
      }

      setThreadLoading(true);

      try {
        const session = await supabase.auth.getSession();

        const response = await fetch(
          `/api/messages/thread?id=${encodeURIComponent(selectedConversationId)}`,
          {
            headers: {
              Authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
            },
          }
        );

        const payload = await response.json();

        if (!response.ok) {
          setMessage(payload.error ?? "Unable to load messages.");
          setThreadMessages([]);
          setThreadLoading(false);
          return;
        }

        setThreadMessages((payload.messages ?? []) as ThreadMessage[]);

        await fetch("/api/messages/mark-read", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
          },
          body: JSON.stringify({
            conversationId: selectedConversationId,
          }),
        });

        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === selectedConversationId
              ? { ...conversation, hasUnread: false }
              : conversation
          )
        );

        window.dispatchEvent(new Event("loombus:messages-changed"));
      } catch {
        setMessage("Unable to load messages.");
        setThreadMessages([]);
      }

      setThreadLoading(false);
    }

    loadThread();
  }, [selectedConversationId]);

  useEffect(() => {
    const query = peopleSearchQuery.trim();

    if (query.length < 2) {
      setPeopleSearchResults([]);
      setPeopleSearchLoading(false);
      return;
    }

    let cancelled = false;

    async function searchPeople() {
      setPeopleSearchLoading(true);

      try {
        const session = await supabase.auth.getSession();

        const response = await fetch(
          `/api/messages/people-search?q=${encodeURIComponent(query)}`,
          {
            headers: {
              Authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
            },
          }
        );

        const payload = await response.json();

        if (!cancelled) {
          if (response.ok) {
            setPeopleSearchResults((payload.people ?? []) as PeopleSearchResult[]);
          } else {
            setPeopleSearchResults([]);
          }
        }
      } catch {
        if (!cancelled) {
          setPeopleSearchResults([]);
        }
      }

      if (!cancelled) {
        setPeopleSearchLoading(false);
      }
    }

    const timeoutId = window.setTimeout(searchPeople, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [peopleSearchQuery]);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === selectedConversationId
      ) ?? null,
    [conversations, selectedConversationId]
  );

  const filteredConversations = useMemo(() => {
    const query = conversationSearchQuery.trim().toLowerCase();

    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      return (
        (conversation.otherFullName ?? "")
          .toLowerCase()
          .includes(query) ||
        (conversation.otherUsername ?? "")
          .toLowerCase()
          .includes(query) ||
        (conversation.lastMessagePreview ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [conversations, conversationSearchQuery]);



  async function reloadThread(conversationId: string) {
    const session = await supabase.auth.getSession();

    const response = await fetch(
      `/api/messages/thread?id=${encodeURIComponent(conversationId)}`,
      {
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
        },
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load messages.");
    }

    setThreadMessages((payload.messages ?? []) as ThreadMessage[]);

    await fetch("/api/messages/mark-read", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        conversationId,
      }),
    });

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, hasUnread: false }
          : conversation
      )
    );

    window.dispatchEvent(new Event("loombus:messages-changed"));
  }

  async function reloadConversationsAndSelect(conversationId: string) {
    const session = await supabase.auth.getSession();

    const response = await fetch("/api/messages/conversations", {
      headers: {
        Authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
      },
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load conversations.");
    }

    setConversations((payload.conversations ?? []) as Conversation[]);
    setSelectedConversationId(conversationId);
  }

  async function handleStartConversation(person: PeopleSearchResult) {
    setStartingConversation(person.id);
    setMessage("");

    try {
      const session = await supabase.auth.getSession();

      const response = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          targetUserId: person.id,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to start conversation.");
        setStartingConversation(null);
        return;
      }

      setPeopleSearchQuery("");
      setPeopleSearchResults([]);
      setComposerText("");

      await reloadConversationsAndSelect(payload.conversationId);
    } catch {
      setMessage("Unable to start conversation.");
    }

    setStartingConversation(null);
  }

  async function runConversationAction(
    action: "archive" | "delete" | "report",
    reportOptions?: { reason?: string; notes?: string }
  ) {
    if (!selectedConversationId) {
      return;
    }

    if (action === "report" && !reportOptions) {
      setConversationMenuOpen(false);
      setReportPanelOpen(true);
      return;
    }

    const confirmed =
      action === "archive"
        ? window.confirm("Archive this conversation from your inbox?")
        : action === "delete"
          ? window.confirm("Delete this conversation from your inbox? This only removes it for you.")
          : true;

    if (!confirmed) {
      return;
    }

    setConversationAction(action);
    setConversationMenuOpen(false);
    setMessage("");

    try {
      const session = await supabase.auth.getSession();

      const response = await fetch(`/api/messages/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
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

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? `Unable to ${action} conversation.`);
        setConversationAction(null);
        return;
      }

      if (action === "report") {
        setReportPanelOpen(false);
        setReportNotes("");
        setReportReason("harassment");
        setMessage("Conversation reported for review.");
      }

      if (action === "archive" || action === "delete") {
        setConversations((current) =>
          current.filter((conversation) => conversation.id !== selectedConversationId)
        );
        setSelectedConversationId(null);
        setThreadMessages([]);
      } else {
        setMessage("Conversation reported for review.");
      }
    } catch {
      setMessage(`Unable to ${action} conversation.`);
    }

    setConversationAction(null);
  }

  function handleAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    setAttachmentMessage("");

    if (selectedFiles.length === 0) {
      setAttachmentFiles([]);
      return;
    }

    if (selectedFiles.length > MAX_ATTACHMENT_FILES) {
      setAttachmentFiles([]);
      setAttachmentMessage("You can attach up to 3 files.");
      event.target.value = "";
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) =>
        !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type) ||
        file.size <= 0 ||
        file.size > MAX_ATTACHMENT_SIZE_BYTES
    );

    if (invalidFile) {
      setAttachmentFiles([]);
      setAttachmentMessage("Attachments must be JPG, PNG, WebP, GIF, or PDF files up to 10 MB each.");
      event.target.value = "";
      return;
    }

    setAttachmentFiles(selectedFiles);
    setAttachmentMessage(`${selectedFiles.length} attachment${selectedFiles.length === 1 ? "" : "s"} ready.`);
  }

  function clearAttachments() {
    setAttachmentFiles([]);
    setAttachmentMessage("");
  }

  async function uploadMessageAttachments({
    conversationId,
    messageId,
    accessToken,
  }: {
    conversationId: string;
    messageId: string;
    accessToken: string;
  }) {
    if (!currentUserId || attachmentFiles.length === 0) {
      return true;
    }

    for (const [index, file] of attachmentFiles.entries()) {
      const extension = getSafeAttachmentFileName(file.name).split(".").pop() || "file";
      const storagePath = `${currentUserId}/${conversationId}/${messageId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        setAttachmentMessage(`${file.name} could not upload.`);
        return false;
      }

      const { data: publicUrlData } = supabase.storage
        .from(ATTACHMENT_BUCKET)
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
        await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
        setAttachmentMessage(result.error ?? `${file.name} could not be attached.`);
        return false;
      }
    }

    return true;
  }

  async function handleSendMessage() {
    if (!selectedConversationId) {
      return;
    }

    const body = composerText.trim();
    const hasAttachments = attachmentFiles.length > 0;

    if (!body && !hasAttachments) {
      return;
    }

    setSending(true);

    try {
      const session = await supabase.auth.getSession();

      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          body,
          hasAttachments,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to send message.");
        setSending(false);
        return;
      }

      if (hasAttachments) {
        const attachmentsUploaded = await uploadMessageAttachments({
          conversationId: selectedConversationId,
          messageId: payload.message.id,
          accessToken: session.data.session?.access_token ?? "",
        });

        if (!attachmentsUploaded) {
          setSending(false);
          setMessage("Message sent, but one or more attachments could not be saved.");
          return;
        }
      }

      setComposerText("");
      clearAttachments();

      await reloadThread(selectedConversationId);

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversationId
            ? {
                ...conversation,
                lastMessagePreview: body,
                lastMessageAt: new Date().toISOString(),
              }
            : conversation
        )
      );
    } catch {
      setMessage("Unable to send message.");
    }

    setSending(false);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="rounded-2xl border border-zinc-900 bg-black p-6">
          <p className="text-sm text-zinc-500">
            Loading conversations...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-white">
          Messages
        </h1>

        <p className="mt-2 text-sm text-zinc-500">
          Private conversations between mutual followers.
        </p>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className={`rounded-2xl border border-zinc-900 bg-black ${mobileThreadOpen ? "hidden lg:block" : "block"}`}>
          <div className="border-b border-zinc-900 px-4 py-3">
            <h2 className="text-sm font-medium text-zinc-300">
              Start a message
            </h2>

            <p className="mt-1 text-xs text-zinc-600">
              Search mutual followers to open a private conversation.
            </p>

            <input
              value={peopleSearchQuery}
              onChange={(event) => setPeopleSearchQuery(event.target.value)}
              placeholder="Search people..."
              className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-700"
            />

            {peopleSearchQuery.trim().length >= 2 ? (
              <div className="mt-3 space-y-2">
                {peopleSearchLoading ? (
                  <p className="text-xs text-zinc-600">
                    Searching...
                  </p>
                ) : peopleSearchResults.length === 0 ? (
                  <p className="text-xs text-zinc-600">
                    No mutual followers match that search.
                  </p>
                ) : (
                  peopleSearchResults.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      disabled={startingConversation === person.id}
                      onClick={() => handleStartConversation(person)}
                      className="flex w-full items-start gap-3 rounded-xl border border-zinc-900 bg-black px-3 py-3 text-left transition hover:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ProfileAvatar
                        profile={{
                          avatar_url: person.avatarUrl,
                          full_name: person.fullName,
                          username: person.username,
                        }}
                        size="sm"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          {person.fullName ?? person.username ?? "Member"}
                        </div>

                        <div className="mt-1 truncate text-xs text-zinc-500">
                          {person.username ? `@${person.username}` : "Open conversation"}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="border-b border-zinc-900 px-4 py-3">
            <h2 className="text-sm font-medium text-zinc-300">
              Conversations
            </h2>

            <input
              value={conversationSearchQuery}
              onChange={(event) =>
                setConversationSearchQuery(event.target.value)
              }
              placeholder="Search conversations..."
              className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-700"
            />
          </div>

          {conversations.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-zinc-500">
                No conversations yet.
              </p>

              <p className="mt-2 text-sm text-zinc-600">
                Private messages open when you and another member follow each other. Search mutual followers above to start.
              </p>
            </div>
          ) : (
            <div>
              {filteredConversations.length === 0 ? (
                <div className="p-6">
                  <p className="text-sm text-zinc-500">
                    No conversations match that search.
                  </p>

                  <p className="mt-2 text-sm text-zinc-600">
                    Try a name, username, or message preview keyword.
                  </p>
                </div>
              ) : filteredConversations.map((conversation) => {
                const selected =
                  conversation.id === selectedConversationId;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(conversation.id);
                      setMobileThreadOpen(true);
                    }}
                    className={`flex w-full items-start gap-3 border-b border-zinc-900 px-4 py-4 text-left transition ${
                      selected
                        ? "bg-zinc-950"
                        : "hover:bg-zinc-950/50"
                    }`}
                  >
                    <ProfileAvatar
                      profile={{
                        avatar_url: conversation.otherAvatarUrl,
                        full_name: conversation.otherFullName,
                        username: conversation.otherUsername,
                      }}
                      size="md"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-medium text-white">
                          {conversation.otherFullName ??
                            conversation.otherUsername ??
                            "Member"}
                        </div>

                        {conversation.hasUnread ? (
                          <span className="h-2.5 w-2.5 rounded-full border border-emerald-300 bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.18)]" />
                        ) : null}
                      </div>

                      <div className="mt-1 truncate text-xs text-zinc-500">
                        {conversation.lastMessagePreview ??
                          "Conversation ready."}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={`rounded-2xl border border-zinc-900 bg-black ${mobileThreadOpen ? "block" : "hidden lg:block"}`}>
          <div className="border-b border-zinc-900 px-4 py-3">
            {selectedConversation ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileThreadOpen(false)}
                    className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-white lg:hidden"
                  >
                    Back
                  </button>

                  <ProfileAvatar
                    profile={{
                      avatar_url: selectedConversation.otherAvatarUrl,
                      full_name: selectedConversation.otherFullName,
                      username: selectedConversation.otherUsername,
                    }}
                    size="sm"
                  />

                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-white">
                      {selectedConversation.otherFullName ??
                        selectedConversation.otherUsername ??
                        "Member"}
                    </h2>

                    <p className="mt-0.5 truncate text-xs text-zinc-600">
                      Private conversation
                    </p>
                  </div>
                </div>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label="Conversation actions"
                    aria-expanded={conversationMenuOpen}
                    disabled={Boolean(conversationAction)}
                    onClick={() => setConversationMenuOpen((current) => !current)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-lg leading-none text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ⋯
                  </button>

                  {conversationMenuOpen ? (
                    <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40">
                      <button
                        type="button"
                        disabled={Boolean(conversationAction)}
                        onClick={() => runConversationAction("archive")}
                        className="block w-full px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-700"
                      >
                        {conversationAction === "archive" ? "Archiving..." : "Archive"}
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(conversationAction)}
                        onClick={() => runConversationAction("delete")}
                        className="block w-full px-4 py-3 text-left text-sm text-red-300 transition hover:bg-red-950/20 disabled:cursor-not-allowed disabled:text-zinc-700"
                      >
                        {conversationAction === "delete" ? "Deleting..." : "Delete"}
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(conversationAction)}
                        onClick={() => runConversationAction("report")}
                        className="block w-full px-4 py-3 text-left text-sm text-red-300 transition hover:bg-red-950/20 disabled:cursor-not-allowed disabled:text-zinc-700"
                      >
                        Report
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <h2 className="text-sm font-medium text-zinc-300">
                Conversation
              </h2>
            )}
          </div>

          <div className="p-4 sm:p-6">
            {selectedConversation ? (
              <>
                {reportPanelOpen && (
                  <div className="mb-4 rounded-2xl border border-red-950 bg-red-950/10 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-red-200">
                          Report conversation
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                          Choose the closest reason. Reports are reviewed by Loombus admins.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setReportPanelOpen(false)}
                        className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                      >
                        Close
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        ["spam", "Spam"],
                        ["harassment", "Harassment"],
                        ["abuse", "Abuse"],
                        ["impersonation", "Impersonation"],
                        ["scam", "Scam"],
                        ["other", "Other"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setReportReason(value)}
                          className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                            reportReason === value
                              ? "border-red-700 bg-red-950/30 text-red-100"
                              : "border-zinc-900 bg-black text-zinc-500 hover:border-zinc-700 hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <label className="mt-3 block">
                      <span className="mb-2 block text-xs text-zinc-500">
                        Notes optional
                      </span>
                      <textarea
                        value={reportNotes}
                        onChange={(event) => setReportNotes(event.target.value)}
                        placeholder="Add anything admins should know."
                        rows={3}
                        maxLength={1000}
                        className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                      />
                    </label>

                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setReportPanelOpen(false)}
                        className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        disabled={conversationAction === "report"}
                        onClick={() =>
                          runConversationAction("report", {
                            reason: reportReason,
                            notes: reportNotes,
                          })
                        }
                        className="rounded-full border border-red-800 px-4 py-2 text-sm text-red-200 transition hover:border-red-600 hover:text-red-100 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {conversationAction === "report" ? "Submitting..." : "Submit report"}
                      </button>
                    </div>
                  </div>
                )}

                {threadLoading ? (
                  <p className="text-sm text-zinc-500">
                    Loading conversation...
                  </p>
                ) : threadMessages.length === 0 ? (
                  <div>
                    <p className="text-sm text-zinc-500">
                      No conversations yet.
                    </p>

                    <p className="mt-2 text-sm text-zinc-600">
Send the first message when you're ready.
                    </p>
                  </div>
                ) : (
                  <div className="min-h-[45vh] space-y-3 pb-2">
                    {threadMessages.map((threadMessage) => {
                      const mine = threadMessage.senderId === currentUserId;

                      return (
                        <div
                          key={threadMessage.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[84%] rounded-[1.35rem] px-4 py-3 text-sm leading-relaxed shadow-lg ${
                              mine
                                ? "bg-white text-black"
                                : "border border-zinc-900 bg-zinc-950 text-zinc-200"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {threadMessage.body}
                            </p>

                            <p className={`mt-2 text-[11px] ${mine ? "text-zinc-600" : "text-zinc-500"}`}>
                              {new Date(threadMessage.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="sticky bottom-0 mt-6 border-t border-zinc-900 bg-black/95 pt-4 backdrop-blur-xl">
                  {attachmentFiles.length > 0 && (
                    <div className="mb-2 rounded-2xl border border-zinc-900 bg-zinc-950 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs text-zinc-500">
                          {attachmentFiles.length} attachment{attachmentFiles.length === 1 ? "" : "s"} selected
                        </p>

                        <button
                          type="button"
                          onClick={clearAttachments}
                          disabled={sending}
                          className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="space-y-2">
                        {attachmentFiles.map((file) => (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-900 bg-black px-3 py-2 text-xs text-zinc-400"
                          >
                            <span className="truncate">{file.name}</span>
                            <span className="shrink-0 text-zinc-600">
                              {file.type === "application/pdf" ? "PDF" : "Image"} · {formatAttachmentFileSize(file.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {attachmentMessage && (
                    <p className="mb-2 text-xs text-zinc-500">
                      {attachmentMessage}
                    </p>
                  )}

                  <div className="flex items-end gap-2 rounded-[1.5rem] border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <label className="mb-1 cursor-pointer rounded-full border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-white">
                      +
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        onChange={handleAttachmentSelection}
                        disabled={sending}
                        className="hidden"
                      />
                    </label>

                    <textarea
                      value={composerText}
                      onChange={(event) =>
                        setComposerText(event.target.value)
                      }
                      placeholder="Write a message..."
                      rows={1}
                      className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
                    />

                    <button
                      type="button"
                      disabled={sending || (!composerText.trim() && attachmentFiles.length === 0)}
                      onClick={handleSendMessage}
                      className="mb-1 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                    >
                      {sending ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                Choose a conversation from your inbox or start a new one from search.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
