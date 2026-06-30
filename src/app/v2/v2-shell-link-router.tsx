"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { V2_DYNAMIC_ROUTE_PREFIXES, V2_EXACT_ROUTE_MAP } from "./v2-navigation";
import { V2UserAvatarMenu } from "./v2-user-avatar-menu";

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

  return (
    <>
      <style>{`
        .loombus-v2-top-nav .v2-avatar-menu-inline {
          display: none !important;
        }

        .loombus-v2-top-nav > div > div:last-child {
          padding-right: 3.25rem !important;
        }

        .v2-global-avatar-slot {
          top: 0.5rem;
          right: max(1rem, calc((100vw - 80rem) / 2 + 1rem));
        }

        @media (min-width: 640px) {
          .v2-global-avatar-slot {
            right: max(1.5rem, calc((100vw - 80rem) / 2 + 1.5rem));
          }
        }

        @media (min-width: 1024px) {
          .v2-global-avatar-slot {
            right: max(2rem, calc((100vw - 80rem) / 2 + 2rem));
          }
        }
      `}</style>
      <div className="v2-global-avatar-slot fixed z-[120]">
        <V2UserAvatarMenu placement="topnav" />
      </div>
    </>
  );
}
