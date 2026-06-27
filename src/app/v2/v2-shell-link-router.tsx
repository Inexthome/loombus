"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const V2_SHELL_LINK_TARGETS: Record<string, string> = {
  Discussions: "/v2/discussions",
  Create: "/v2/create",
  Search: "/v2/search",
  Notifications: "/v2/notifications",
};

function getV2ShellPreviewTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const anchor = target.closest<HTMLAnchorElement>("a");

  if (!anchor) {
    return null;
  }

  const label = anchor.getAttribute("aria-label");
  const href = anchor.getAttribute("href") ?? "";

  if (label === "Discussions" && href === "/discussions") {
    return V2_SHELL_LINK_TARGETS.Discussions;
  }

  if (label === "Create" && href === "/create") {
    return V2_SHELL_LINK_TARGETS.Create;
  }

  if ((label === "Search" || href === "/search") && href === "/search") {
    return V2_SHELL_LINK_TARGETS.Search;
  }

  if ((label === "Notifications" || href === "/notifications") && href === "/notifications") {
    return V2_SHELL_LINK_TARGETS.Notifications;
  }

  if (href.indexOf("/discussions/") === 0) {
    return "/v2" + href;
  }

  return null;
}

export function V2ShellLinkRouter() {
  const router = useRouter();

  useEffect(() => {
    function handleV2ShellLinkClick(event: MouseEvent) {
      const previewTarget = getV2ShellPreviewTarget(event.target);

      if (!previewTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      router.push(previewTarget);
    }

    document.addEventListener("click", handleV2ShellLinkClick, true);

    return () => {
      document.removeEventListener("click", handleV2ShellLinkClick, true);
    };
  }, [router]);

  return null;
}
