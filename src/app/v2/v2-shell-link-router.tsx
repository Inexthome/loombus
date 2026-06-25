"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

function isV2DiscussionsRailLink(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const anchor = target.closest<HTMLAnchorElement>(
    'a[href="/discussions"][aria-label="Discussions"]'
  );

  return Boolean(anchor);
}

export function V2ShellLinkRouter() {
  const router = useRouter();

  useEffect(() => {
    function handleV2ShellLinkClick(event: MouseEvent) {
      if (!isV2DiscussionsRailLink(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      router.push("/v2/discussions");
    }

    document.addEventListener("click", handleV2ShellLinkClick, true);

    return () => {
      document.removeEventListener("click", handleV2ShellLinkClick, true);
    };
  }, [router]);

  return null;
}
