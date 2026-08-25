"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

function isRoomsPath(pathname: string) {
  return pathname === "/rooms" || pathname.startsWith("/rooms/");
}

function isFloorPath(pathname: string) {
  return pathname === "/the-floor" || pathname.startsWith("/the-floor/");
}

function isLibraryHomePath(pathname: string) {
  return pathname === "/library";
}

export function AppChromeBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileLibrary, setMobileLibrary] = useState(false);

  useEffect(() => {
    if (!isLibraryHomePath(pathname)) {
      setMobileLibrary(false);
      return;
    }

    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobileLibrary(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [pathname]);

  if (isRoomsPath(pathname) || isFloorPath(pathname) || mobileLibrary) return null;
  return <>{children}</>;
}
