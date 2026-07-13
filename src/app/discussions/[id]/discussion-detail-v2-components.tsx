"use client";

import Link from "next/link";
import {
  FileText,
  Image as ImageIcon,
  PlayCircle,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import {
  type AiOutputRatingValue,
  type DiscussionAttachment,
  type Profile,
  discussionBodyToSafeHtml,
  formatAttachmentFileSize,
  getProfileHandle,
  getProfileName,
} from "./discussion-detail-v2-model";

export function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9_]{2,30})/g);

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^@([a-zA-Z0-9_]{2,30})$/);
        if (!match) return <span key={`${part}-${index}`}>{part}</span>;
        const username = match[1].toLowerCase();
        return (
          <Link key={`${part}-${index}`} href={`/u/${username}`} className="discussion-v2-mention">
            @{username}
          </Link>
        );
      })}
    </>
  );
}

export function RichText({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div
      className={`discussion-v2-rich-text ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: discussionBodyToSafeHtml(content) }}
    />
  );
}

export function AuthorIdentity({
  profile,
  size = "md",
  compact = false,
}: {
  profile?: Profile | null;
  size?: "sm" | "md" | "lg";
  compact?: boolean;
}) {
  const content = (
    <>
      <ProfileAvatar profile={profile ?? null} size={size} />
      <span className="discussion-v2-author-copy">
        <span className="discussion-v2-author-name">{getProfileName(profile)}</span>
        {!compact ? <span className="discussion-v2-author-handle">{getProfileHandle(profile)}</span> : null}
      </span>
    </>
  );

  return profile?.username ? (
    <Link href={`/u/${profile.username}`} className="discussion-v2-author-identity">
      {content}
    </Link>
  ) : (
    <span className="discussion-v2-author-identity">{content}</span>
  );
}

export function AttachmentGallery({ attachments }: { attachments: DiscussionAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <section className="discussion-v2-attachments" aria-label="Discussion attachments">
      {attachments.map((attachment) => {
        if (attachment.attachment_kind === "image") {
          return (
            <a
              key={attachment.id}
              href={attachment.public_url}
              target="_blank"
              rel="noreferrer"
              className="discussion-v2-attachment discussion-v2-attachment-image"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.public_url} alt={attachment.file_name} loading="lazy" />
              <span className="discussion-v2-attachment-meta">
                <ImageIcon aria-hidden="true" size={16} />
                <span>{attachment.file_name}</span>
              </span>
            </a>
          );
        }

        if (attachment.attachment_kind === "video") {
          return (
            <div key={attachment.id} className="discussion-v2-attachment discussion-v2-attachment-video">
              <video controls preload="metadata" src={attachment.public_url}>
                Your browser does not support this video.
              </video>
              <a href={attachment.public_url} target="_blank" rel="noreferrer" className="discussion-v2-attachment-meta">
                <PlayCircle aria-hidden="true" size={16} />
                <span>{attachment.file_name}</span>
                <span>{formatAttachmentFileSize(attachment.file_size_bytes)}</span>
              </a>
            </div>
          );
        }

        return (
          <a
            key={attachment.id}
            href={attachment.public_url}
            target="_blank"
            rel="noreferrer"
            className="discussion-v2-attachment discussion-v2-attachment-file"
          >
            <span className="discussion-v2-file-icon">
              <FileText aria-hidden="true" size={22} />
            </span>
            <span className="discussion-v2-file-copy">
              <strong>{attachment.file_name}</strong>
              <span>{formatAttachmentFileSize(attachment.file_size_bytes)}</span>
            </span>
          </a>
        );
      })}
    </section>
  );
}

export function AiRatingControls({
  featureKey,
  rating,
  working,
  onRate,
}: {
  featureKey: string;
  rating?: AiOutputRatingValue;
  working: boolean;
  onRate: (featureKey: string, rating: AiOutputRatingValue | null) => void;
}) {
  return (
    <div className="discussion-v2-ai-rating" aria-label="Rate this AI output">
      <span>Was this useful?</span>
      <button
        type="button"
        aria-pressed={rating === "helpful"}
        disabled={working}
        onClick={() => onRate(featureKey, rating === "helpful" ? null : "helpful")}
      >
        <ThumbsUp aria-hidden="true" size={15} />
        Helpful
      </button>
      <button
        type="button"
        aria-pressed={rating === "not_helpful"}
        disabled={working}
        onClick={() => onRate(featureKey, rating === "not_helpful" ? null : "not_helpful")}
      >
        <ThumbsDown aria-hidden="true" size={15} />
        Not helpful
      </button>
    </div>
  );
}

export function InlineNotice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "error";
  children: React.ReactNode;
}) {
  if (!children) return null;
  return <p className={`discussion-v2-notice discussion-v2-notice-${tone}`}>{children}</p>;
}
