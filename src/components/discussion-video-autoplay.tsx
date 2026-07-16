"use client";

import { useEffect } from "react";

const AUTOPLAY_VISIBILITY_THRESHOLD = 0.6;
const VIDEO_HOST_CLASS = "loombus-autoplay-video-host";
const MUTED_HINT = "Tap for sound";
const BLOCKED_HINT = "Tap to play with sound";

type DecoratedVideo = {
  host: HTMLElement;
  originalControls: boolean;
  originalTabIndex: string | null;
  handleClick: (event: MouseEvent) => void;
  handleEnded: () => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  handlePause: () => void;
  handlePlay: () => void;
  handleVolumeChange: () => void;
};

function setVideoHint(host: HTMLElement, hint: string | null) {
  if (hint) {
    host.setAttribute("data-loombus-video-hint", hint);
  } else {
    host.removeAttribute("data-loombus-video-hint");
  }
}

function isDiscussionAttachmentVideo(video: HTMLVideoElement) {
  return Boolean(
    video.closest('section[aria-label="Discussion attachments"]')
  );
}

export function DiscussionVideoAutoplay() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      ".discussion-feed-route"
    );
    if (!root) return;

    const decoratedVideos = new Map<HTMLVideoElement, DecoratedVideo>();
    const visibilityRatios = new Map<HTMLVideoElement, number>();
    let activeVideo: HTMLVideoElement | null = null;

    function resetVideo(video: HTMLVideoElement) {
      const decorated = decoratedVideos.get(video);
      if (!decorated) return;

      video.pause();
      video.muted = true;
      video.defaultMuted = true;
      video.controls = false;
      setVideoHint(decorated.host, MUTED_HINT);

      if (activeVideo === video) {
        activeVideo = null;
      }
    }

    function claimActiveVideo(video: HTMLVideoElement) {
      if (activeVideo && activeVideo !== video) {
        resetVideo(activeVideo);
      }
      activeVideo = video;
    }

    async function playMuted(video: HTMLVideoElement) {
      const ratio = visibilityRatios.get(video) ?? 0;
      const decorated = decoratedVideos.get(video);

      if (
        !decorated ||
        !video.isConnected ||
        document.hidden ||
        ratio < AUTOPLAY_VISIBILITY_THRESHOLD
      ) {
        return;
      }

      claimActiveVideo(video);
      video.muted = true;
      video.defaultMuted = true;
      video.controls = false;
      setVideoHint(decorated.host, MUTED_HINT);

      try {
        await video.play();
      } catch {
        if (activeVideo === video) {
          activeVideo = null;
        }
        setVideoHint(decorated.host, BLOCKED_HINT);
      }
    }

    async function enableSound(video: HTMLVideoElement) {
      const decorated = decoratedVideos.get(video);
      if (!decorated) return;

      claimActiveVideo(video);
      video.muted = false;
      video.defaultMuted = false;
      video.controls = true;
      setVideoHint(decorated.host, null);

      try {
        await video.play();
      } catch {
        video.muted = true;
        video.defaultMuted = true;
        video.controls = false;
        setVideoHint(decorated.host, BLOCKED_HINT);
        if (activeVideo === video) {
          activeVideo = null;
        }
      }
    }

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!(entry.target instanceof HTMLVideoElement)) continue;

          const video = entry.target;
          const ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
          visibilityRatios.set(video, ratio);

          if (ratio >= AUTOPLAY_VISIBILITY_THRESHOLD) {
            void playMuted(video);
          } else {
            resetVideo(video);
          }
        }
      },
      {
        threshold: [0, AUTOPLAY_VISIBILITY_THRESHOLD, 1],
      }
    );

    function decorateVideo(video: HTMLVideoElement) {
      if (
        decoratedVideos.has(video) ||
        !isDiscussionAttachmentVideo(video)
      ) {
        return;
      }

      const host = video.parentElement;
      if (!host) return;

      const originalControls = video.controls;
      const originalTabIndex = video.getAttribute("tabindex");

      host.classList.add(VIDEO_HOST_CLASS);
      setVideoHint(host, MUTED_HINT);

      video.muted = true;
      video.defaultMuted = true;
      video.controls = false;
      video.playsInline = true;
      video.tabIndex = 0;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");

      const handleClick = (event: MouseEvent) => {
        if (!video.muted && video.volume > 0) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void enableSound(video);
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          (!video.muted && video.volume > 0) ||
          (event.key !== "Enter" && event.key !== " ")
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        void enableSound(video);
      };

      const handlePlay = () => {
        claimActiveVideo(video);
        const isMuted = video.muted || video.volume === 0;
        video.controls = !isMuted;
        setVideoHint(host, isMuted ? MUTED_HINT : null);
      };

      const handlePause = () => {
        if (activeVideo === video) {
          activeVideo = null;
        }
      };

      const handleEnded = () => {
        if (activeVideo === video) {
          activeVideo = null;
        }
        video.muted = true;
        video.defaultMuted = true;
        video.controls = false;
        setVideoHint(host, MUTED_HINT);
      };

      const handleVolumeChange = () => {
        const isMuted = video.muted || video.volume === 0;
        video.controls = !isMuted;
        setVideoHint(host, isMuted ? MUTED_HINT : null);
      };

      video.addEventListener("click", handleClick, true);
      video.addEventListener("keydown", handleKeyDown);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("ended", handleEnded);
      video.addEventListener("volumechange", handleVolumeChange);

      decoratedVideos.set(video, {
        host,
        originalControls,
        originalTabIndex,
        handleClick,
        handleEnded,
        handleKeyDown,
        handlePause,
        handlePlay,
        handleVolumeChange,
      });
      visibilityRatios.set(video, 0);
      visibilityObserver.observe(video);
    }

    function removeVideoDecoration(video: HTMLVideoElement) {
      const decorated = decoratedVideos.get(video);
      if (!decorated) return;

      visibilityObserver.unobserve(video);
      video.removeEventListener("click", decorated.handleClick, true);
      video.removeEventListener("keydown", decorated.handleKeyDown);
      video.removeEventListener("play", decorated.handlePlay);
      video.removeEventListener("pause", decorated.handlePause);
      video.removeEventListener("ended", decorated.handleEnded);
      video.removeEventListener(
        "volumechange",
        decorated.handleVolumeChange
      );

      video.controls = decorated.originalControls;
      if (decorated.originalTabIndex === null) {
        video.removeAttribute("tabindex");
      } else {
        video.setAttribute("tabindex", decorated.originalTabIndex);
      }

      decorated.host.classList.remove(VIDEO_HOST_CLASS);
      decorated.host.removeAttribute("data-loombus-video-hint");
      decoratedVideos.delete(video);
      visibilityRatios.delete(video);

      if (activeVideo === video) {
        activeVideo = null;
      }
    }

    function scanForVideos(node: Node) {
      if (node instanceof HTMLVideoElement) {
        decorateVideo(node);
        return;
      }

      if (!(node instanceof Element)) return;
      for (const video of node.querySelectorAll<HTMLVideoElement>("video")) {
        decorateVideo(video);
      }
    }

    scanForVideos(root);

    const mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          scanForVideos(node);
        }
      }

      for (const video of decoratedVideos.keys()) {
        if (!video.isConnected) {
          removeVideoDecoration(video);
        }
      }
    });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        for (const video of decoratedVideos.keys()) {
          resetVideo(video);
        }
        return;
      }

      let mostVisibleVideo: HTMLVideoElement | null = null;
      let highestRatio = 0;

      for (const [video, ratio] of visibilityRatios.entries()) {
        if (ratio > highestRatio) {
          highestRatio = ratio;
          mostVisibleVideo = video;
        }
      }

      if (
        mostVisibleVideo &&
        highestRatio >= AUTOPLAY_VISIBILITY_THRESHOLD
      ) {
        void playMuted(mostVisibleVideo);
      }
    };

    mutationObserver.observe(root, {
      childList: true,
      subtree: true,
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      mutationObserver.disconnect();
      visibilityObserver.disconnect();

      for (const video of Array.from(decoratedVideos.keys())) {
        video.pause();
        removeVideoDecoration(video);
      }
    };
  }, []);

  return null;
}
