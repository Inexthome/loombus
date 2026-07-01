"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { V2_DYNAMIC_ROUTE_PREFIXES, V2_EXACT_ROUTE_MAP } from "./v2-navigation";

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
