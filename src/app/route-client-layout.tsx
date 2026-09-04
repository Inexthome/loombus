"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ClientLayout from "./client-layout";

const LEGAL_DOCUMENT_PATHS = new Set([
  "/legal",
  "/privacy",
  "/terms",
  "/guidelines",
  "/community-guidelines",
  "/cookies",
  "/refunds",
  "/dmca",
  "/accessibility",
]);

function isRoomsPath(pathname: string) {
  return pathname === "/rooms" || pathname.startsWith("/rooms/");
}

function isFloorPath(pathname: string) {
  return pathname === "/the-floor" || pathname.startsWith("/the-floor/");
}

function isLibraryPath(pathname: string) {
  return pathname === "/library" || pathname.startsWith("/library/");
}

function isLegalDocumentPath(pathname: string) {
  return LEGAL_DOCUMENT_PATHS.has(pathname);
}

export default function RouteClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isLegalDocumentPath(pathname)) {
    return <div className="legal-route-client-boundary">{children}</div>;
  }

  if (isRoomsPath(pathname)) {
    return <div className="rooms-route-client-boundary">{children}</div>;
  }

  if (isFloorPath(pathname)) {
    return <div className="floor-route-client-boundary">{children}</div>;
  }

  if (isLibraryPath(pathname)) {
    return <div className="library-route-client-boundary">{children}</div>;
  }

  return <ClientLayout>{children}</ClientLayout>;
}
