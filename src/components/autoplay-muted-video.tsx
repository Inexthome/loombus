"use client";

import { Volume2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";

const AUTOPLAY_VISIBILITY_THRESHOLD = 0.6;

type ActiveVideoController = {
  element: HTMLVideoElement;
  deactivate: () => void;
};

let activeVideoController: ActiveVideoController | null = null;

type AutoplayMutedVideoProps = {
  src: string;
  ariaLabel: string;
  className?: string;
  containerClassName?: string;
  fallbackText?: string;
};

export function AutoplayMutedVideo({
  src,
  ariaLabel,
  className = "",
  containerClassName = "",
  fallbackText = "Your browser does not support this video.",
}: AutoplayMutedVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isVisibleRef = useRef(false);
  const [muted, setMuted] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const deactivate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    video.muted = true;
    setMuted(true);
    setAutoplayBlocked(false);

    if (activeVideoController?.element === video) {
      activeVideoController = null;
    }
  }, []);

  const claimActiveVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (
      activeVideoController &&
      activeVideoController.element !== video
    ) {
      activeVideoController.deactivate();
    }

    activeVideoController = {
      element: video,
      deactivate,
    };
  }, [deactivate]);

  const playMuted = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isVisibleRef.current || document.hidden) return;

    claimActiveVideo();
    video.muted = true;
    setMuted(true);

    try {
      await video.play();
      setAutoplayBlocked(false);
    } catch {
      if (activeVideoController?.element === video) {
        activeVideoController = null;
      }
      setAutoplayBlocked(true);
    }
  }, [claimActiveVideo]);

  const enableSound = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    claimActiveVideo();
    video.muted = false;
    setMuted(false);
    setAutoplayBlocked(false);

    try {
      await video.play();
    } catch {
      video.muted = true;
      setMuted(true);
      setAutoplayBlocked(true);
    }
  }, [claimActiveVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldPlay =
          entry.isIntersecting &&
          entry.intersectionRatio >= AUTOPLAY_VISIBILITY_THRESHOLD;

        isVisibleRef.current = shouldPlay;

        if (shouldPlay) {
          void playMuted();
        } else {
          deactivate();
        }
      },
      {
        threshold: [0, AUTOPLAY_VISIBILITY_THRESHOLD, 1],
      }
    );

    const handleVisibilityChange = () => {
      if (document.hidden) {
        deactivate();
      } else if (isVisibleRef.current) {
        void playMuted();
      }
    };

    observer.observe(video);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      if (activeVideoController?.element === video) {
        activeVideoController = null;
      }
      video.pause();
    };
  }, [deactivate, playMuted, src]);

  function handlePlay() {
    claimActiveVideo();
  }

  function handlePause() {
    const video = videoRef.current;
    if (video && activeVideoController?.element === video) {
      activeVideoController = null;
    }
  }

  function handleVolumeChange(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    setMuted(video.muted || video.volume === 0);
  }

  return (
    <div
      className={`relative isolate overflow-hidden bg-black ${containerClassName}`.trim()}
    >
      <video
        ref={videoRef}
        controls
        muted={muted}
        playsInline
        preload="metadata"
        src={src}
        aria-label={ariaLabel}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handlePause}
        onVolumeChange={handleVolumeChange}
        className={className}
      >
        {fallbackText}
      </video>

      {muted ? (
        <button
          type="button"
          onClick={() => void enableSound()}
          aria-label={
            autoplayBlocked
              ? `Play ${ariaLabel} with sound`
              : `Turn on sound for ${ariaLabel}`
          }
          className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-gradient-to-t from-black/45 via-transparent to-black/10 p-4 text-white transition hover:from-black/55 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/80"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/70 px-4 py-2 text-sm font-black shadow-xl backdrop-blur-sm">
            <Volume2 aria-hidden="true" className="h-4 w-4" />
            {autoplayBlocked ? "Tap to play with sound" : "Tap for sound"}
          </span>
        </button>
      ) : null}
    </div>
  );
}
