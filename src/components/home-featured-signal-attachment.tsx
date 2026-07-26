"use client";

import { FileText, PlayCircle } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type FeaturedAttachment = {
  id: string;
  public_url: string;
  file_name: string;
  mime_type: string;
  attachment_kind: "image" | "pdf" | "video";
  sort_order: number;
};

type FeaturedMediaState = {
  mount: HTMLAnchorElement;
  attachments: FeaturedAttachment[];
};

function getDiscussionId(link: HTMLAnchorElement) {
  const href = link.getAttribute("href") ?? "";
  const match = href.match(/^\/discussions\/([^/?#]+)/);
  return match?.[1] ?? null;
}

export default function HomeFeaturedSignalAttachment() {
  const [media, setMedia] = useState<FeaturedMediaState | null>(null);

  useEffect(() => {
    let cancelled = false;
    let activeLink: HTMLAnchorElement | null = null;
    let observer: MutationObserver | null = null;

    async function attachToFeaturedSignal(link: HTMLAnchorElement) {
      const discussionId = getDiscussionId(link);
      if (!discussionId || link === activeLink) return;
      activeLink = link;

      const { data, error } = await supabase
        .from("discussion_attachments")
        .select("id, public_url, file_name, mime_type, attachment_kind, sort_order")
        .eq("discussion_id", discussionId)
        .order("sort_order", { ascending: true })
        .limit(3);

      if (cancelled || error || !data?.length) return;

      link.dataset.homeFeaturedMedia = "true";
      setMedia({
        mount: link,
        attachments: data as FeaturedAttachment[],
      });
    }

    function locateFeaturedSignal() {
      const link = document.querySelector<HTMLAnchorElement>(
        'a.home-v2-featured-art[href^="/discussions/"]'
      );
      if (link) void attachToFeaturedSignal(link);
    }

    locateFeaturedSignal();
    observer = new MutationObserver(locateFeaturedSignal);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (activeLink) delete activeLink.dataset.homeFeaturedMedia;
    };
  }, []);

  if (!media) return null;

  const [attachment] = media.attachments;
  const additionalCount = Math.max(0, media.attachments.length - 1);

  return createPortal(
    <span className="home-featured-attachment" aria-label={`Attached file: ${attachment.file_name}`}>
      {attachment.attachment_kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={attachment.public_url} alt={attachment.file_name} loading="lazy" />
      ) : attachment.attachment_kind === "video" ? (
        <span className="home-featured-attachment-video">
          <video
            src={attachment.public_url}
            muted
            playsInline
            preload="metadata"
            aria-label={attachment.file_name}
          />
          <span className="home-featured-attachment-play" aria-hidden="true">
            <PlayCircle />
          </span>
        </span>
      ) : (
        <span className="home-featured-attachment-document">
          <FileText aria-hidden="true" />
          <strong>{attachment.file_name}</strong>
          <small>PDF attachment</small>
        </span>
      )}
      {additionalCount > 0 ? (
        <span className="home-featured-attachment-count">+{additionalCount}</span>
      ) : null}
    </span>,
    media.mount
  );
}
