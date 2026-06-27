"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const V2_EXACT_ROUTE_MAP: Record<string, string> = {
  "/": "/v2",
  "/home": "/v2",
  "/discussions": "/v2/discussions",
  "/create": "/v2/create",
  "/rooms": "/v2/rooms",
  "/messages": "/v2/messages",
  "/people": "/v2/people",
  "/labs": "/v2/labs",
  "/topics": "/v2/topics",
  "/following": "/v2/following",
  "/saved": "/v2/saved",
  "/stickies": "/v2/stickies",
  "/reading-history": "/v2/reading-history",
  "/my-activity": "/v2/my-activity",
  "/my-discussions": "/v2/my-discussions",
  "/my-replies": "/v2/my-replies",
  "/profile": "/v2/profile",
  "/settings": "/v2/settings",
  "/premium": "/v2/premium",
  "/support": "/v2/support",
  "/privacy-security": "/v2/privacy-security",
  "/notifications": "/v2/notifications",
  "/search": "/v2/search",
  "/onboarding": "/v2/onboarding",
  "/admin": "/v2/admin",
};

const V2_DYNAMIC_ROUTE_PREFIXES: Array<{ from: string; to: string }> = [
  { from: "/discussions/", to: "/v2/discussions/" },
  { from: "/people/", to: "/v2/people/" },
  { from: "/rooms/", to: "/v2/rooms/" },
  { from: "/labs/", to: "/v2/labs/" },
  { from: "/topics/", to: "/v2/topics/" },
];

function splitHref(href: string) {
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";

  return { pathname, search, hash };
}

function mapV1HrefToV2(href: string) {
  if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }

  if (href.startsWith("/v2")) {
    return null;
  }

  const { pathname, search, hash } = splitHref(href);
  const exactTarget = V2_EXACT_ROUTE_MAP[pathname];

  if (exactTarget) {
    return `${exactTarget}${search}${hash}`;
  }

  const dynamicTarget = V2_DYNAMIC_ROUTE_PREFIXES.find((route) => pathname.startsWith(route.from));

  if (!dynamicTarget) {
    return null;
  }

  return `${dynamicTarget.to}${pathname.slice(dynamicTarget.from.length)}${search}${hash}`;
}

function getV2ShellPreviewTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const anchor = target.closest<HTMLAnchorElement>("a");

  if (!anchor) {
    return null;
  }

  return mapV1HrefToV2(anchor.getAttribute("href") ?? "");
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
