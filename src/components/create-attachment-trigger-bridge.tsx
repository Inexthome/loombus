"use client";

import { useEffect } from "react";

const RESTRICTED_TITLE =
  "Attachments require Public visibility. Change Future Discussion visibility in Settings.";

export function CreateAttachmentTriggerBridge() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-create-composer-variant]");
    if (!root) return;

    let footerButton: HTMLButtonElement | null = null;
    let observer: MutationObserver | null = null;

    const connect = () => {
      const input = root.querySelector<HTMLInputElement>('input[type="file"]');
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(".create-footer-secondary button"));
      const button = buttons.find((candidate) =>
        candidate.textContent?.includes("Add files / evidence")
      );

      if (!input || !button) return;
      footerButton = button;

      const makeInteractive = () => {
        if (button.disabled) {
          button.disabled = false;
          button.dataset.attachmentRestriction = "true";
          button.title = RESTRICTED_TITLE;
        }
      };

      makeInteractive();
      observer?.disconnect();
      observer = new MutationObserver(makeInteractive);
      observer.observe(button, { attributes: true, attributeFilter: ["disabled"] });

      button.dataset.attachmentTriggerWired = "true";
    };

    connect();

    const rootObserver = new MutationObserver(() => {
      if (!footerButton || !root.contains(footerButton)) connect();
    });
    rootObserver.observe(root, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      rootObserver.disconnect();
    };
  }, []);

  return null;
}
