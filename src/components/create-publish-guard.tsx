"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { isVideoContextMimeType } from "@/lib/video-context-limits";

const DISCUSSION_PUBLISH_NOTICE_KEY = "loombus:discussion-publish-notice";
const DISCUSSION_PUBLISHED_MESSAGE = "Your discussion has been published.";
const CREATE_ENDPOINT = "/api/discussions/create";
const ATTACHMENT_ENDPOINT = "/api/discussions/attachments";
const ROLLBACK_ENDPOINT = "/api/discussions/rollback-create";
const ATTACHMENT_UPLOAD_ERROR_PATTERN =
  /could not upload|could not be attached|attachment could not be saved|attachments could not be saved/i;
const VIDEO_METADATA_TIMEOUT_MS = 15000;

type AttachmentPayload = {
  discussionId?: string;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  videoDurationSeconds?: number;
};

type VideoProbe = {
  key: string;
  objectUrl: string;
};

type VideoProbeDeferred = {
  resolve: (durationSeconds: number) => void;
  reject: (error: Error) => void;
  objectUrl: string;
  timeoutId: number;
};

function getFileKey({
  fileName,
  fileSizeBytes,
  mimeType,
}: {
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
}) {
  return `${fileName ?? ""}:${fileSizeBytes ?? 0}:${mimeType ?? ""}`;
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return new URL(input, window.location.origin);
  }

  if (input instanceof URL) {
    return new URL(input.href);
  }

  return new URL(input.url, window.location.origin);
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (input instanceof Request) {
    return input.method.toUpperCase();
  }

  return "GET";
}

function getRequestHeaders(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.headers) {
    return new Headers(init.headers);
  }

  if (input instanceof Request) {
    return new Headers(input.headers);
  }

  return new Headers();
}

function getRollbackMessage(isVideo: boolean) {
  return isVideo
    ? "Your video could not be uploaded. Nothing was published, and your draft is still saved."
    : "Your attachment could not be uploaded. Nothing was published, and your draft is still saved.";
}

function getRollbackFailureMessage() {
  return "The attachment failed, and Loombus could not automatically remove the incomplete discussion. Open your discussions and remove it before retrying.";
}

function createAttachmentFailureResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json",
    },
  });
}

function mutationContainsUploadError(records: MutationRecord[]) {
  for (const record of records) {
    if (
      record.type === "characterData" &&
      ATTACHMENT_UPLOAD_ERROR_PATTERN.test(record.target.textContent ?? "")
    ) {
      return true;
    }

    for (const node of record.addedNodes) {
      if (ATTACHMENT_UPLOAD_ERROR_PATTERN.test(node.textContent ?? "")) {
        return true;
      }
    }
  }

  return false;
}

export function CreatePublishGuard({ children }: { children: ReactNode }) {
  const [rollbackMessage, setRollbackMessage] = useState("");
  const [videoProbes, setVideoProbes] = useState<VideoProbe[]>([]);
  const videoDurationsRef = useRef(new Map<string, Promise<number>>());
  const videoProbeDeferredsRef = useRef(
    new Map<string, VideoProbeDeferred>()
  );

  function finishVideoProbe(key: string, durationSeconds?: number) {
    const deferred = videoProbeDeferredsRef.current.get(key);
    if (!deferred) return;

    window.clearTimeout(deferred.timeoutId);
    URL.revokeObjectURL(deferred.objectUrl);
    videoProbeDeferredsRef.current.delete(key);
    setVideoProbes((probes) =>
      probes.filter((candidate) => candidate.key !== key)
    );

    if (
      typeof durationSeconds === "number" &&
      Number.isFinite(durationSeconds) &&
      durationSeconds > 0
    ) {
      deferred.resolve(Math.ceil(durationSeconds));
      return;
    }

    videoDurationsRef.current.delete(key);
    deferred.reject(new Error("Video duration could not be read."));
  }

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const videoDurations = videoDurationsRef.current;
    const videoProbeDeferreds = videoProbeDeferredsRef.current;
    let currentDiscussionId: string | null = null;
    let authorizationHeader: string | null = null;
    let rollbackPromise: Promise<string> | null = null;
    let active = true;

    function setPublishNotice() {
      window.sessionStorage.setItem(
        DISCUSSION_PUBLISH_NOTICE_KEY,
        DISCUSSION_PUBLISHED_MESSAGE
      );
    }

    function clearPublishNotice() {
      window.sessionStorage.removeItem(DISCUSSION_PUBLISH_NOTICE_KEY);
    }

    async function rollbackIncompleteDiscussion(isVideo: boolean) {
      clearPublishNotice();

      if (rollbackPromise) {
        return rollbackPromise;
      }

      const discussionId = currentDiscussionId;
      const successMessage = getRollbackMessage(isVideo);

      if (!discussionId) {
        if (active) setRollbackMessage(successMessage);
        return successMessage;
      }

      if (!authorizationHeader) {
        const failureMessage = getRollbackFailureMessage();
        if (active) setRollbackMessage(failureMessage);
        return failureMessage;
      }

      rollbackPromise = (async () => {
        try {
          const response = await originalFetch(ROLLBACK_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authorizationHeader,
            },
            body: JSON.stringify({ discussionId }),
          });

          const message = response.ok
            ? successMessage
            : getRollbackFailureMessage();

          if (active) setRollbackMessage(message);
          return message;
        } catch {
          const failureMessage = getRollbackFailureMessage();
          if (active) setRollbackMessage(failureMessage);
          return failureMessage;
        } finally {
          currentDiscussionId = null;
          rollbackPromise = null;
        }
      })();

      return rollbackPromise;
    }

    function queueVideoDurationProbe(file: File) {
      const key = getFileKey({
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type,
      });

      if (videoDurations.has(key)) return;

      const objectUrl = URL.createObjectURL(file);
      let resolveDuration!: (durationSeconds: number) => void;
      let rejectDuration!: (error: Error) => void;
      const durationPromise = new Promise<number>((resolve, reject) => {
        resolveDuration = resolve;
        rejectDuration = reject;
      });

      void durationPromise.catch(() => null);
      videoDurations.set(key, durationPromise);

      const timeoutId = window.setTimeout(() => {
        const deferred = videoProbeDeferreds.get(key);
        if (!deferred) return;

        URL.revokeObjectURL(deferred.objectUrl);
        videoProbeDeferreds.delete(key);
        videoDurations.delete(key);
        rejectDuration(new Error("Video duration could not be read."));
        if (active) {
          setVideoProbes((probes) =>
            probes.filter((candidate) => candidate.key !== key)
          );
        }
      }, VIDEO_METADATA_TIMEOUT_MS);

      videoProbeDeferreds.set(key, {
        resolve: resolveDuration,
        reject: rejectDuration,
        objectUrl,
        timeoutId,
      });
      setVideoProbes((probes) => [
        ...probes.filter((candidate) => candidate.key !== key),
        { key, objectUrl },
      ]);
    }

    function handleFileSelection(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "file") {
        return;
      }

      for (const file of Array.from(target.files ?? [])) {
        if (isVideoContextMimeType(file.type)) {
          queueVideoDurationProbe(file);
        }
      }
    }

    const guardedFetch: typeof window.fetch = async (input, init) => {
      const requestUrl = getRequestUrl(input);
      const method = getRequestMethod(input, init);
      const requestHeaders = getRequestHeaders(input, init);
      const pathname = requestUrl.pathname;
      const isCreateRequest =
        requestUrl.origin === window.location.origin &&
        pathname === CREATE_ENDPOINT &&
        method === "POST";
      const isAttachmentRequest =
        requestUrl.origin === window.location.origin &&
        pathname === ATTACHMENT_ENDPOINT &&
        method === "POST";

      if (isCreateRequest) {
        currentDiscussionId = null;
        rollbackPromise = null;
        clearPublishNotice();
        if (active) setRollbackMessage("");
      }

      const requestAuthorization = requestHeaders.get("Authorization");
      if (requestAuthorization) {
        authorizationHeader = requestAuthorization;
      }

      let nextInit = init;
      let attachmentPayload: AttachmentPayload | null = null;
      let attachmentIsVideo = false;

      if (isAttachmentRequest && typeof init?.body === "string") {
        try {
          attachmentPayload = JSON.parse(init.body) as AttachmentPayload;
          attachmentIsVideo = isVideoContextMimeType(
            attachmentPayload.mimeType ?? ""
          );

          if (attachmentIsVideo && !attachmentPayload.videoDurationSeconds) {
            const durationPromise = videoDurations.get(
              getFileKey(attachmentPayload)
            );

            if (durationPromise) {
              try {
                attachmentPayload.videoDurationSeconds = await durationPromise;
              } catch {
                const message = await rollbackIncompleteDiscussion(true);
                return createAttachmentFailureResponse(message);
              }

              nextInit = {
                ...init,
                headers: requestHeaders,
                body: JSON.stringify(attachmentPayload),
              };
            }
          }
        } catch {
          attachmentPayload = null;
        }
      }

      let response: Response;
      try {
        response = await originalFetch(input, nextInit);
      } catch (error) {
        if (isAttachmentRequest) {
          const message = await rollbackIncompleteDiscussion(
            attachmentIsVideo
          );
          return createAttachmentFailureResponse(message, 503);
        }

        throw error;
      }

      if (isCreateRequest && response.ok) {
        try {
          const result = (await response.clone().json()) as {
            discussion?: { id?: string };
          };
          currentDiscussionId = result.discussion?.id ?? null;
          if (currentDiscussionId) {
            setPublishNotice();
          }
        } catch {
          currentDiscussionId = null;
          clearPublishNotice();
        }
      }

      if (isAttachmentRequest && !response.ok) {
        const message = await rollbackIncompleteDiscussion(
          attachmentIsVideo
        );
        return createAttachmentFailureResponse(
          message,
          response.status || 400
        );
      }

      return response;
    };

    const errorObserver = new MutationObserver((records) => {
      if (!currentDiscussionId || !mutationContainsUploadError(records)) {
        return;
      }

      void rollbackIncompleteDiscussion(false);
    });

    document.addEventListener("change", handleFileSelection, true);
    errorObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    window.fetch = guardedFetch;

    return () => {
      active = false;
      document.removeEventListener("change", handleFileSelection, true);
      errorObserver.disconnect();
      if (window.fetch === guardedFetch) {
        window.fetch = originalFetch;
      }

      for (const deferred of videoProbeDeferreds.values()) {
        window.clearTimeout(deferred.timeoutId);
        URL.revokeObjectURL(deferred.objectUrl);
        deferred.reject(new Error("Video metadata probe was cancelled."));
      }
      videoProbeDeferreds.clear();
      videoDurations.clear();
    };
  }, []);

  return (
    <>
      {videoProbes.map((probe) => (
        <video
          key={probe.key}
          src={probe.objectUrl}
          preload="metadata"
          muted
          playsInline
          aria-hidden="true"
          className="hidden"
          onLoadedMetadata={(event) =>
            finishVideoProbe(probe.key, event.currentTarget.duration)
          }
          onError={() => finishVideoProbe(probe.key)}
        />
      ))}
      {rollbackMessage ? (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[120] w-[min(92vw,42rem)] -translate-x-1/2 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-900 shadow-2xl shadow-black/20 dark:border-red-900/70 dark:bg-red-950 dark:text-red-100"
        >
          {rollbackMessage}
        </div>
      ) : null}
      {children}
    </>
  );
}
