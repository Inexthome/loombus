"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BellOff,
  FileText,
  Image as ImageIcon,
  LockKeyhole,
  Paperclip,
} from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";
import {
  type Conversation,
  type MessageAttachment,
  type NoticeTone,
  type PeopleSearchResult,
  type ThreadMessage,
  formatConversationTime,
  formatMessageAttachmentFileSize,
  formatMessageTime,
  getConversationHandle,
  getConversationName,
  getConversationPreview,
  getPeopleResultHandle,
  getPeopleResultName,
} from "./messages-v2-model";

let autoLoadMessageMediaPreference: Promise<boolean> | null = null;

async function getAutoLoadMessageMediaPreference() {
  if (!autoLoadMessageMediaPreference) {
    autoLoadMessageMediaPreference = (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      if (!token) return false;

      const response = await fetch("/api/settings/member-preferences", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return false;
      const payload = await response.json().catch(() => ({}));
      return payload?.preferences?.autoDownloadMessageMedia === true;
    })();
  }

  return autoLoadMessageMediaPreference;
}

export function ConversationIdentity({
  conversation,
  size = "md",
  compact = false,
}: {
  conversation: Conversation;
  size?: "sm" | "md" | "lg";
  compact?: boolean;
}) {
  const marketplace = Boolean(conversation.marketplaceContexts?.length);
  const content = (
    <>
      <ProfileAvatar
        profile={{
          avatar_url: conversation.otherAvatarUrl,
          full_name: conversation.otherFullName,
          username: conversation.otherUsername,
        }}
        size={size}
      />
      <span className="messages-v2-identity-copy">
        <strong>{getConversationName(conversation)}</strong>
        {!compact ? (
          <span>
            {getConversationHandle(conversation)}
            {marketplace ? " · Marketplace inquiry" : ""}
          </span>
        ) : null}
      </span>
    </>
  );

  return conversation.otherUsername ? (
    <Link href={`/u/${conversation.otherUsername}`} className="messages-v2-identity">
      {content}
    </Link>
  ) : (
    <span className="messages-v2-identity">{content}</span>
  );
}

export function ConversationListItem({
  conversation,
  selected,
  onSelect,
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const marketplace = Boolean(conversation.marketplaceContexts?.length);
  return (
    <button
      type="button"
      className={`messages-v2-conversation-item${selected ? " is-selected" : ""}${
        conversation.hasUnread ? " has-unread" : ""
      }`}
      onClick={onSelect}
    >
      <span className="messages-v2-conversation-avatar">
        <ProfileAvatar
          profile={{
            avatar_url: conversation.otherAvatarUrl,
            full_name: conversation.otherFullName,
            username: conversation.otherUsername,
          }}
          size="md"
        />
        {conversation.hasUnread ? <span className="messages-v2-unread-dot" /> : null}
      </span>

      <span className="messages-v2-conversation-copy">
        <span className="messages-v2-conversation-topline">
          <strong>{getConversationName(conversation)}</strong>
          <time>{formatConversationTime(conversation.lastMessageAt)}</time>
        </span>
        <span className="messages-v2-conversation-preview">
          <span>{marketplace ? "Marketplace · " : ""}{getConversationPreview(conversation)}</span>
          {conversation.mutedAt ? (
            <BellOff aria-label="Muted" size={13} />
          ) : null}
        </span>
      </span>
    </button>
  );
}

export function PeopleSearchResultCard({
  person,
  working,
  onSelect,
}: {
  person: PeopleSearchResult;
  working: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="messages-v2-person-result"
      disabled={working}
      onClick={onSelect}
    >
      <ProfileAvatar
        profile={{
          avatar_url: person.avatarUrl,
          full_name: person.fullName,
          username: person.username,
        }}
        size="md"
      />
      <span>
        <strong>{getPeopleResultName(person)}</strong>
        <small>{getPeopleResultHandle(person)}</small>
        {person.bio ? <p>{person.bio}</p> : null}
      </span>
      <span className="messages-v2-person-action">{working ? "Opening…" : "Message"}</span>
    </button>
  );
}

export function MessageAttachmentCard({
  attachment,
  mine,
  compact = false,
  autoLoadMedia,
}: {
  attachment: MessageAttachment;
  mine: boolean;
  compact?: boolean;
  autoLoadMedia?: boolean;
}) {
  const [savedPreferenceAllowsMedia, setSavedPreferenceAllowsMedia] = useState(false);

  useEffect(() => {
    let alive = true;
    if (mine || autoLoadMedia !== undefined || attachment.attachmentKind !== "image") {
      return () => {
        alive = false;
      };
    }

    void getAutoLoadMessageMediaPreference().then((allowed) => {
      if (alive) setSavedPreferenceAllowsMedia(allowed);
    });

    return () => {
      alive = false;
    };
  }, [attachment.attachmentKind, autoLoadMedia, mine]);

  const shouldAutoLoadImage =
    mine || autoLoadMedia === true || (autoLoadMedia === undefined && savedPreferenceAllowsMedia);

  if (attachment.attachmentKind === "image") {
    if (!shouldAutoLoadImage) {
      return (
        <a
          href={attachment.publicUrl}
          target="_blank"
          rel="noreferrer"
          className={`messages-v2-message-attachment is-file${compact ? " is-compact" : ""}`}
        >
          <span className="messages-v2-message-file-icon">
            <ImageIcon aria-hidden="true" size={20} />
          </span>
          <span>
            <strong>{attachment.fileName}</strong>
            <small>Image · Open to view</small>
          </span>
        </a>
      );
    }

    return (
      <a
        href={attachment.publicUrl}
        target="_blank"
        rel="noreferrer"
        className={`messages-v2-message-attachment is-image${mine ? " is-mine" : ""}${
          compact ? " is-compact" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.publicUrl} alt={attachment.fileName} loading="lazy" />
        {!compact ? (
          <span>
            <ImageIcon aria-hidden="true" size={14} />
            {attachment.fileName}
          </span>
        ) : null}
      </a>
    );
  }

  return (
    <a
      href={attachment.publicUrl}
      target="_blank"
      rel="noreferrer"
      className={`messages-v2-message-attachment is-file${mine ? " is-mine" : ""}`}
    >
      <span className="messages-v2-message-file-icon">
        <FileText aria-hidden="true" size={20} />
      </span>
      <span>
        <strong>{attachment.fileName}</strong>
        <small>PDF · {formatMessageAttachmentFileSize(attachment.fileSizeBytes)}</small>
      </span>
    </a>
  );
}

export function MessageBubble({
  message,
  mine,
  autoLoadMedia,
}: {
  message: ThreadMessage;
  mine: boolean;
  autoLoadMedia?: boolean;
}) {
  const visibleBody = message.body && message.body !== "[Attachment]";

  return (
    <div className={`messages-v2-message-row${mine ? " is-mine" : ""}`}>
      <article className={`messages-v2-message-bubble${mine ? " is-mine" : ""}`}>
        {message.deletedBySender ? (
          <p className="messages-v2-deleted-message">Message removed</p>
        ) : (
          <>
            {visibleBody ? <p className="messages-v2-message-body">{message.body}</p> : null}
            {message.attachments?.length ? (
              <div className="messages-v2-message-attachments">
                {message.attachments.map((attachment) => (
                  <MessageAttachmentCard
                    key={attachment.id}
                    attachment={attachment}
                    mine={mine}
                    autoLoadMedia={autoLoadMedia}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
        <footer>
          <time>{formatMessageTime(message.createdAt)}</time>
          {message.editedAt ? <span>Edited</span> : null}
        </footer>
      </article>
    </div>
  );
}

export function MessagesInlineNotice({
  tone,
  children,
  onDismiss,
}: {
  tone: NoticeTone;
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  if (!children) return null;
  return (
    <div className={`messages-v2-notice is-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span>{children}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss message">
          ×
        </button>
      ) : null}
    </div>
  );
}

export function PrivateMessagingNote() {
  return (
    <div className="messages-v2-private-note">
      <LockKeyhole aria-hidden="true" size={16} />
      <div>
        <strong>Private by design</strong>
        <span>Messages are visible only to conversation participants and authorized safety operations.</span>
      </div>
    </div>
  );
}

export function AttachmentLimitNote() {
  return (
    <div className="messages-v2-attachment-limit-note">
      <Paperclip aria-hidden="true" size={14} />
      <span>JPG, PNG, WebP, GIF, or PDF · 10 MB each · 3 per message</span>
    </div>
  );
}
