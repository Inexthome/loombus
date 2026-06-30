"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  EyeOff,
  FileText,
  Image,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

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

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate or abusive content" },
  { value: "threats", label: "Threats or safety concern" },
  { value: "spam", label: "Spam or scam" },
  { value: "sexual_content", label: "Sexual or inappropriate content" },
  { value: "other", label: "Something else" },
];

type Conversation = {
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

function getDisplayName(conversation: Conversation | null) {
  if (!conversation) return "Select a conversation";
  return conversation.otherFullName?.trim() || conversation.otherUsername?.trim() || "Loombus member";
}

function getSubLabel(conversation: Conversation | null) {
  if (!conversation) return "Choose a private message thread to continue.";
  return conversation.otherUsername?.trim() ? `@${conversation.otherUsername}` : "Mutual follower";
}

function getSafeAttachmentFileName(fileName: string) {
  return fileName.trim().replace(/[\\/]/g, "-").slice(0, 120);
}

function formatAttachmentFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatMessageTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function MessagesGateCard({
  title,
  message,
  loading = false,
  payload,
}: {
  title: string;
  message: string;
  loading?: boolean;
  payload?: ShellPayload | null;
}) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-stone-50 px-4 py-10 text-slate-950">
      <section className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-200">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">Loombus Messages</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm font-medium leading-6 text-slate-600 sm:text-base">{message}</p>
        {payload ? <p className="mt-5 text-xs font-bold text-slate-500">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</p> : null}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/login?next=/v2/messages" className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-400">
            Sign in
          </Link>
          <Link href="/v2" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:text-slate-950">
            Back to V2 Home
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function V2MessagesPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [shellLoading, setShellLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [peopleSearchResults, setPeopleSearchResults] = useState<PeopleSearchResult[]>([]);
  const [peopleSearchLoading, setPeopleSearchLoading] = useState(false);
  const [startingConversation, setStartingConversation] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [conversationAction, setConversationAction] = useState<string | null>(null);
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportNotes, setReportNotes] = useState("");

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const filteredConversations = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matchesQuery = !cleanQuery || [conversation.otherFullName, conversation.otherUsername, conversation.lastMessagePreview]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery);
      const matchesTab = activeTab === "All" || (activeTab === "Unread" && conversation.hasUnread) || (activeTab === "Muted" && conversation.mutedAt);
      return matchesQuery && matchesTab;
    });
  }, [activeTab, conversations, query]);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadShell() {
    setShellLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
      setCurrentUserId(data.session?.user.id ?? null);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 Messages access. Current Messages remains available.");
    } finally {
      setShellLoading(false);
    }
  }

  async function loadConversations() {
    setConversationLoading(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch("/api/messages/conversations", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to load conversations.");
        setConversations([]);
        return;
      }

      const loadedConversations = (result.conversations ?? []) as Conversation[];
      setConversations(loadedConversations);

      const requestedConversationId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("conversation") : null;
      const requestedConversation = requestedConversationId ? loadedConversations.find((conversation) => conversation.id === requestedConversationId) : null;
      const currentStillExists = selectedConversationId ? loadedConversations.find((conversation) => conversation.id === selectedConversationId) : null;
      const nextConversationId = requestedConversation?.id ?? currentStillExists?.id ?? loadedConversations[0]?.id ?? null;

      setSelectedConversationId(nextConversationId);
      if (requestedConversation?.id) setMobileThreadOpen(true);
    } catch {
      setMessage("Unable to load conversations.");
      setConversations([]);
    } finally {
      setConversationLoading(false);
    }
  }

  async function loadThread(conversationId: string) {
    setThreadLoading(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/messages/thread?id=${encodeURIComponent(conversationId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to load messages.");
        setThreadMessages([]);
        return;
      }

      setThreadMessages((result.messages ?? []) as ThreadMessage[]);

      await fetch("/api/messages/mark-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ conversationId }),
      });

      setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, hasUnread: false } : conversation));
      window.dispatchEvent(new Event("loombus:messages-changed"));
    } catch {
      setMessage("Unable to load messages.");
      setThreadMessages([]);
    } finally {
      setThreadLoading(false);
    }
  }

  useEffect(() => {
    void loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadShell();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (payload?.authenticated && payload.configured && payload.flags.v2_shell && payload.version === "v2") {
      void loadConversations();
    }
  }, [payload?.authenticated, payload?.configured, payload?.flags.v2_shell, payload?.version]);

  useEffect(() => {
    if (!selectedConversationId) {
      setThreadMessages([]);
      return;
    }
    void loadThread(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2 || !payload?.authenticated) {
      setPeopleSearchResults([]);
      setPeopleSearchLoading(false);
      return;
    }

    let cancelled = false;
    async function searchPeople() {
      setPeopleSearchLoading(true);
      try {
        const accessToken = await getAccessToken();
        const response = await fetch(`/api/messages/people-search?q=${encodeURIComponent(cleanQuery)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await response.json();
        if (!cancelled) setPeopleSearchResults(response.ok ? ((result.people ?? []) as PeopleSearchResult[]) : []);
      } catch {
        if (!cancelled) setPeopleSearchResults([]);
      } finally {
        if (!cancelled) setPeopleSearchLoading(false);
      }
    }

    const timeoutId = window.setTimeout(() => void searchPeople(), 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query, payload?.authenticated]);

  async function handleStartConversation(person: PeopleSearchResult) {
    setStartingConversation(person.id);
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ targetUserId: person.id }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to start conversation.");
        return;
      }

      setQuery("");
      setPeopleSearchResults([]);
      await loadConversations();
      setSelectedConversationId(result.conversationId);
      setMobileThreadOpen(true);
    } catch {
      setMessage("Unable to start conversation.");
    } finally {
      setStartingConversation(null);
    }
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

    const invalidFile = selectedFiles.find((file) => !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_ATTACHMENT_SIZE_BYTES);
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

  async function uploadMessageAttachments(conversationId: string, messageId: string, accessToken: string) {
    if (!currentUserId || attachmentFiles.length === 0) return true;

    for (const [index, file] of attachmentFiles.entries()) {
      const extension = getSafeAttachmentFileName(file.name).split(".").pop() || "file";
      const storagePath = `${currentUserId}/${conversationId}/${messageId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) {
        setMessage(`Attachment upload failed: ${uploadError.message}`);
        setAttachmentMessage(`${file.name} could not upload.`);
        return false;
      }

      const { data: publicUrlData } = supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(storagePath);
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
        setMessage(`Attachment save failed: ${result.error ?? "Unknown attachment error."}`);
        setAttachmentMessage(result.error ?? `${file.name} could not be attached.`);
        return false;
      }
    }

    return true;
  }

  async function handleSendMessage() {
    if (!selectedConversationId || sending) return;

    const body = composerText.trim();
    const hasAttachments = attachmentFiles.length > 0;
    if (!body && !hasAttachments) return;

    setSending(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ conversationId: selectedConversationId, body, hasAttachments }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to send message.");
        return;
      }

      if (hasAttachments) {
        const uploaded = await uploadMessageAttachments(selectedConversationId, result.message.id, accessToken);
        if (!uploaded) return;
      }

      setComposerText("");
      clearAttachments();
      await loadThread(selectedConversationId);
      await loadConversations();
    } catch {
      setMessage("Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  async function runConversationAction(action: "archive" | "delete" | "mute" | "unmute") {
    if (!selectedConversationId || conversationAction) return;

    const confirmed = action === "archive"
      ? window.confirm("Archive this conversation from your inbox?")
      : action === "delete"
        ? window.confirm("Delete this conversation from your inbox? This only removes it for you.")
        : true;

    if (!confirmed) return;

    setConversationAction(action);
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      const endpoint = action === "mute" || action === "unmute" ? "/api/messages/mute" : `/api/messages/${action}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          ...(action === "mute" || action === "unmute" ? { muted: action === "mute" } : {}),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? `Unable to ${action} conversation.`);
        return;
      }

      if (action === "archive" || action === "delete") {
        setConversations((current) => current.filter((conversation) => conversation.id !== selectedConversationId));
        setSelectedConversationId(null);
        setThreadMessages([]);
        setMobileThreadOpen(false);
        setReportPanelOpen(false);
      } else if (action === "mute" || action === "unmute") {
        setConversations((current) => current.map((conversation) => conversation.id === selectedConversationId ? { ...conversation, mutedAt: result.mutedAt } : conversation));
      }
    } catch {
      setMessage(`Unable to ${action} conversation.`);
    } finally {
      setConversationAction(null);
    }
  }

  async function submitReport() {
    if (!selectedConversationId || conversationAction) return;

    setConversationAction("report");
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/messages/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          reason: reportReason,
          notes: reportNotes,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to report conversation.");
        return;
      }

      setReportPanelOpen(false);
      setReportReason("harassment");
      setReportNotes("");
      setMessage("Conversation reported for review.");
    } catch {
      setMessage("Unable to report conversation.");
    } finally {
      setConversationAction(null);
    }
  }

  if (shellLoading) {
    return <MessagesGateCard title="Checking Messages access" message="Loombus is preparing your private conversations." loading />;
  }

  if (message && !payload?.authenticated) {
    return <MessagesGateCard title="Messages check failed safely" message={message} payload={payload} />;
  }

  if (!payload?.authenticated) {
    return <MessagesGateCard title="Sign in required" message="Messages are private. Sign in first so Loombus can open your conversations safely." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <MessagesGateCard title="V2 Messages is not enabled" message="This account is not currently allowed through the v2_shell flag. You can continue using the current Messages experience." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <section className="grid min-h-[760px] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)] lg:grid-cols-[340px_minmax(0,1fr)_300px]">
          <aside className={`border-b border-slate-200 bg-white p-5 lg:block lg:border-b-0 lg:border-r ${mobileThreadOpen ? "hidden" : "block"}`}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Private messages</p>
                <h1 className="mt-2 text-2xl font-black text-slate-950">Messages</h1>
              </div>
              <Mail className="size-6 text-slate-500" />
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Search className="size-5 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search messages or people" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </div>

            {query.trim().length >= 2 ? (
              <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Start a conversation</p>
                {peopleSearchLoading ? <p className="text-xs font-bold text-slate-500">Searching mutual followers...</p> : null}
                {!peopleSearchLoading && peopleSearchResults.length === 0 ? <p className="text-xs font-semibold text-slate-500">No mutual followers match that search.</p> : null}
                <div className="space-y-2">
                  {peopleSearchResults.map((person) => (
                    <button key={person.id} type="button" disabled={startingConversation === person.id} onClick={() => void handleStartConversation(person)} className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:bg-amber-50 disabled:opacity-60">
                      <ProfileAvatar profile={{ avatar_url: person.avatarUrl, full_name: person.fullName, username: person.username }} size="sm" />
                      <span className="min-w-0 flex-1"><span className="block truncate font-black text-slate-900">{person.fullName ?? person.username ?? "Member"}</span><span className="block truncate text-xs font-semibold text-slate-500">{person.username ? `@${person.username}` : "Open conversation"}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mb-4 grid grid-cols-3 gap-2 border-b border-slate-100 pb-3 text-sm font-bold">
              {["All", "Unread", "Muted"].map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-xl px-3 py-2 transition ${activeTab === tab ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"}`}>
                  {tab}
                </button>
              ))}
            </div>

            {conversationLoading ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Loading conversations...</p> : null}
            {!conversationLoading && conversations.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-black text-slate-700">No conversations yet.</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Messages open when you and another member follow each other. Search mutual followers above to start.</p>
              </div>
            ) : null}

            <div className="space-y-1">
              {!conversationLoading && filteredConversations.map((conversation) => {
                const selected = conversation.id === selectedConversationId;
                return (
                  <button key={conversation.id} type="button" onClick={() => { setSelectedConversationId(conversation.id); setMobileThreadOpen(true); }} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${selected ? "bg-amber-50 ring-1 ring-amber-200" : "hover:bg-slate-50"}`}>
                    <ProfileAvatar profile={{ avatar_url: conversation.otherAvatarUrl, full_name: conversation.otherFullName, username: conversation.otherUsername }} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-black text-slate-950">{getDisplayName(conversation)}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-slate-400">{formatMessageTime(conversation.lastMessageAt)}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{conversation.lastMessagePreview || getSubLabel(conversation)}</span>
                    </span>
                    {conversation.hasUnread ? <span className="size-2 shrink-0 rounded-full bg-amber-600" /> : null}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className={`min-h-[760px] flex-col bg-white lg:flex ${mobileThreadOpen ? "flex" : "hidden"}`}>
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setMobileThreadOpen(false)} className="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 lg:hidden" aria-label="Back to messages">
                  <ArrowLeft className="size-5" />
                </button>
                <ProfileAvatar profile={{ avatar_url: selectedConversation?.otherAvatarUrl ?? null, full_name: selectedConversation?.otherFullName ?? null, username: selectedConversation?.otherUsername ?? null }} size="sm" />
                <div>
                  <h2 className="font-black text-slate-950">{getDisplayName(selectedConversation)}</h2>
                  <p className="text-xs font-semibold text-slate-500">{getSubLabel(selectedConversation)}{selectedConversation?.mutedAt ? " · Muted" : ""}</p>
                </div>
              </div>
              <MoreHorizontal className="size-5 text-slate-400" />
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto bg-white px-5 py-5">
              {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{message}</div> : null}
              {threadLoading ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Loading messages...</p> : null}
              {!threadLoading && !selectedConversation ? <p className="rounded-2xl bg-slate-50 p-6 text-sm font-bold text-slate-500">Select a conversation to view the thread.</p> : null}
              {!threadLoading && selectedConversation && threadMessages.length === 0 ? <p className="rounded-2xl bg-slate-50 p-6 text-sm font-bold text-slate-500">No messages in this conversation yet.</p> : null}

              {!threadLoading && threadMessages.map((threadMessage) => {
                const fromMe = threadMessage.senderId === currentUserId;
                return (
                  <div key={threadMessage.id} className={`flex items-end gap-3 ${fromMe ? "justify-end" : "justify-start"}`}>
                    {!fromMe ? <ProfileAvatar profile={{ avatar_url: selectedConversation?.otherAvatarUrl ?? null, full_name: selectedConversation?.otherFullName ?? null, username: selectedConversation?.otherUsername ?? null }} size="sm" /> : null}
                    <div className="max-w-[78%]">
                      <div className={`rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${fromMe ? "bg-amber-100 text-slate-950" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
                        {threadMessage.deletedBySender ? <p className="italic text-slate-400">Message deleted.</p> : <p className="whitespace-pre-wrap">{threadMessage.body}</p>}
                        {threadMessage.attachments && threadMessage.attachments.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {threadMessage.attachments.map((attachment) => (
                              <a key={attachment.id} href={attachment.publicUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 transition hover:border-amber-300 hover:bg-amber-50">
                                <span className="flex items-center gap-3">
                                  {attachment.attachmentKind === "image" ? <Image className="size-6 text-amber-700" /> : <FileText className="size-6 text-red-500" />}
                                  <span className="min-w-0"><span className="block truncate font-black">{attachment.fileName}</span><span className="text-xs font-semibold text-slate-500">{formatAttachmentFileSize(attachment.fileSizeBytes)}</span></span>
                                </span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-1 text-xs font-semibold text-slate-400">{formatMessageTime(threadMessage.createdAt)}{threadMessage.editedAt ? " · edited" : ""}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="border-t border-slate-200 bg-white px-5 py-4">
              {attachmentMessage ? <p className="mb-2 text-xs font-bold text-slate-500">{attachmentMessage}</p> : null}
              {attachmentFiles.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachmentFiles.map((file) => <span key={`${file.name}-${file.size}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{file.name}</span>)}
                  <button type="button" onClick={clearAttachments} className="rounded-full px-3 py-1 text-xs font-black text-slate-500 hover:bg-slate-100">Clear</button>
                </div>
              ) : null}
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <label className="grid size-9 cursor-pointer place-items-center rounded-full text-amber-700 transition hover:bg-amber-50" aria-label="Attach files">
                  <Paperclip className="size-5" />
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={handleAttachmentSelection} className="sr-only" />
                </label>
                <textarea value={composerText} onChange={(event) => setComposerText(event.target.value)} placeholder={selectedConversation ? "Write a message" : "Select a conversation first"} disabled={!selectedConversation || sending} rows={1} className="min-h-10 min-w-0 flex-1 resize-none rounded-xl px-3 py-2 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60" />
                <button type="button" onClick={() => void handleSendMessage()} disabled={!selectedConversation || sending || (!composerText.trim() && attachmentFiles.length === 0)} className="grid size-9 place-items-center rounded-full bg-amber-300 text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Send message">
                  {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
                </button>
              </div>
            </footer>
          </section>

          <aside className="hidden border-l border-slate-200 bg-white p-5 xl:block">
            <h2 className="font-black text-slate-950">Conversation details</h2>
            <div className="mt-6 text-center">
              <ProfileAvatar profile={{ avatar_url: selectedConversation?.otherAvatarUrl ?? null, full_name: selectedConversation?.otherFullName ?? null, username: selectedConversation?.otherUsername ?? null }} size="lg" />
              <h3 className="mt-3 font-black text-slate-950">{getDisplayName(selectedConversation)}</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">{getSubLabel(selectedConversation)}</p>
            </div>

            <div className="mt-6 grid gap-2">
              <Link href={selectedConversation?.otherUsername ? `/v2/people/${selectedConversation.otherUsername}` : "/v2/people"} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 hover:text-slate-950">
                <UserRound className="size-4" /> View profile
              </Link>
              <button type="button" onClick={() => void runConversationAction(selectedConversation?.mutedAt ? "unmute" : "mute")} disabled={!selectedConversation || Boolean(conversationAction)} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-left text-sm font-black text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50">
                <EyeOff className="size-4" /> {selectedConversation?.mutedAt ? "Unmute" : "Mute"}
              </button>
              <button type="button" onClick={() => void runConversationAction("archive")} disabled={!selectedConversation || Boolean(conversationAction)} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-left text-sm font-black text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50">
                <Archive className="size-4" /> Archive
              </button>
              <button type="button" onClick={() => setReportPanelOpen((open) => !open)} disabled={!selectedConversation || Boolean(conversationAction)} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-left text-sm font-black text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50">
                <ShieldAlert className="size-4" /> Report
              </button>
            </div>

            {reportPanelOpen ? (
              <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-black text-slate-950">Report conversation</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">Choose a reason and add any context that will help moderation review this conversation.</p>
                <label className="mt-4 block text-xs font-black uppercase tracking-[0.16em] text-slate-500" htmlFor="v2-message-report-reason">Reason</label>
                <select id="v2-message-report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-amber-400">
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </select>
                <label className="mt-4 block text-xs font-black uppercase tracking-[0.16em] text-slate-500" htmlFor="v2-message-report-notes">Notes</label>
                <textarea id="v2-message-report-notes" value={reportNotes} onChange={(event) => setReportNotes(event.target.value)} rows={4} placeholder="Add optional context for the moderation team." className="mt-2 w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-amber-400" />
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => void submitReport()} disabled={conversationAction === "report"} className="flex-1 rounded-xl bg-amber-300 px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:opacity-60">
                    {conversationAction === "report" ? "Reporting..." : "Submit report"}
                  </button>
                  <button type="button" onClick={() => setReportPanelOpen(false)} disabled={conversationAction === "report"} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-black text-slate-600 transition hover:text-slate-950 disabled:opacity-60">
                    Cancel
                  </button>
                </div>
              </section>
            ) : null}
          </aside>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
