"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function isRoomsPath(pathname: string) {
  return pathname === "/rooms" || pathname.startsWith("/rooms/");
}

function isFloorPath(pathname: string) {
  return pathname === "/the-floor" || pathname.startsWith("/the-floor/");
}

function isLibraryPath(pathname: string) {
  return pathname === "/library" || pathname.startsWith("/library/");
}

export function AppChromeBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isRoomsPath(pathname) || isFloorPath(pathname) || isLibraryPath(pathname)) return null;
  return <>{children}</>;
}
