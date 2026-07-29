"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function isRoomsPath(pathname: string) {
  return pathname === "/rooms" || pathname.startsWith("/rooms/");
}

export function AppChromeBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isRoomsPath(pathname)) return null;
  return <>{children}</>;
}
