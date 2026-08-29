"use client";

import { useEffect } from "react";

const RESTRICTED_MESSAGE =
  "Attachments require Public visibility. Change Future Discussion visibility in Settings.";

export function CreateAttachmentTriggerBridge() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-create-composer-variant]");
    if (!root) return;

    let button: HTMLButtonElement | null = null;
    let buttonObserver: MutationObserver | null = null;
    let restricted = false;

    const showRestriction = () => {
      let message = root.querySelector<HTMLElement>(".create-inline-message");
      if (!message) {
        message = document.createElement("p");
        message.className = "create-inline-message";
        message.setAttribute("role", "status");
        message.setAttribute("aria-live", "polite");
        root.querySelector(".create-footer-actions")?.before(message);
      }
      message.textContent = RESTRICTED_MESSAGE;
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!restricted) return;
      event.preventDefault();
      event.stopPropagation();
      showRestriction();
    };

    const connect = () => {
      const nextButton = Array.from(
        root.querySelectorAll<HTMLButtonElement>(".create-footer-secondary button")
      ).find((candidate) => candidate.textContent?.includes("Add files / evidence"));

      if (!nextButton || nextButton === button) return;
      if (button) button.removeEventListener("click", onClickCapture, true);
      buttonObserver?.disconnect();
      button = nextButton;

      const syncRestriction = () => {
        if (!button) return;
        if (button.disabled) restricted = true;
        button.disabled = false;
        button.dataset.attachmentRestriction = restricted ? "true" : "false";
        button.setAttribute("aria-disabled", String(restricted));
        button.title = restricted ? RESTRICTED_MESSAGE : "";
      };

      syncRestriction();
      buttonObserver = new MutationObserver(syncRestriction);
      buttonObserver.observe(button, { attributes: true, attributeFilter: ["disabled"] });
      button.addEventListener("click", onClickCapture, true);
      button.dataset.attachmentTriggerWired = "true";
    };

    connect();
    const rootObserver = new MutationObserver(connect);
    rootObserver.observe(root, { childList: true, subtree: true });

    return () => {
      if (button) button.removeEventListener("click", onClickCapture, true);
      buttonObserver?.disconnect();
      rootObserver.disconnect();
    };
  }, []);

  return null;
}
