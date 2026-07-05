"use client";

import { useEffect } from "react";
import V2CreateRoomPage from "../../v2/rooms/new/page";

export default function PublicRoomNewPage() {
  useEffect(() => {
    const path = `${window.location.pathname}${window.location.search}`;
    if (path.startsWith("/rooms/new?") && path.includes("plan=")) {
      window.localStorage.setItem("loombus:pending-room-plan", path);
    }
  }, []);

  return <V2CreateRoomPage />;
}
