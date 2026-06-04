"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/profile-avatar";

type Conversation = {
  id: string;
  otherUserId: string | null;
  otherUsername: string | null;
  otherFullName: string | null;
  otherAvatarUrl: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
};

type ThreadMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedBySender: boolean;
};

export default function MessagesPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);

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
          setSelectedConversationId(loadedConversations[0].id);
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
      } catch {
        setMessage("Unable to load messages.");
        setThreadMessages([]);
      }

      setThreadLoading(false);
    }

    loadThread();
  }, [selectedConversationId]);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === selectedConversationId
      ) ?? null,
    [conversations, selectedConversationId]
  );

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
  }

  async function handleSendMessage() {
    if (!selectedConversationId) {
      return;
    }

    const body = composerText.trim();

    if (!body) {
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
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to send message.");
        setSending(false);
        return;
      }

      setComposerText("");

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
        <div className="mb-4 rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-zinc-900 bg-black">
          <div className="border-b border-zinc-900 px-4 py-3">
            <h2 className="text-sm font-medium text-zinc-300">
              Conversations
            </h2>
          </div>

          {conversations.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-zinc-500">
                No messages yet.
              </p>

              <p className="mt-2 text-sm text-zinc-600">
                Messages become available when you and another member follow each other.
              </p>
            </div>
          ) : (
            <div>
              {conversations.map((conversation) => {
                const selected =
                  conversation.id === selectedConversationId;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() =>
                      setSelectedConversationId(conversation.id)
                    }
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
                      <div className="truncate text-sm font-medium text-white">
                        {conversation.otherFullName ??
                          conversation.otherUsername ??
                          "Member"}
                      </div>

                      <div className="mt-1 truncate text-xs text-zinc-500">
                        {conversation.lastMessagePreview ??
                          "No messages yet."}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-black">
          <div className="border-b border-zinc-900 px-4 py-3">
            <h2 className="text-sm font-medium text-zinc-300">
              Conversation
            </h2>
          </div>

          <div className="p-6">
            {selectedConversation ? (
              <>
                <div className="mb-4 text-lg font-medium text-white">
                  {selectedConversation.otherFullName ??
                    selectedConversation.otherUsername ??
                    "Member"}
                </div>

                {threadLoading ? (
                  <p className="text-sm text-zinc-500">
                    Loading messages...
                  </p>
                ) : threadMessages.length === 0 ? (
                  <div>
                    <p className="text-sm text-zinc-500">
                      No messages yet.
                    </p>

                    <p className="mt-2 text-sm text-zinc-600">
                      Start the conversation once the composer is added.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {threadMessages.map((threadMessage) => {
                      const mine = threadMessage.senderId === currentUserId;

                      return (
                        <div
                          key={threadMessage.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                              mine
                                ? "bg-zinc-800 text-white"
                                : "bg-zinc-950 text-zinc-200"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {threadMessage.body}
                            </p>

                            <p className="mt-2 text-[11px] text-zinc-500">
                              {new Date(threadMessage.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 border-t border-zinc-900 pt-4">
                  <textarea
                    value={composerText}
                    onChange={(event) =>
                      setComposerText(event.target.value)
                    }
                    placeholder="Write a message..."
                    rows={4}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-zinc-700"
                  />

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={sending || !composerText.trim()}
                      onClick={handleSendMessage}
                      className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                Select a conversation.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
