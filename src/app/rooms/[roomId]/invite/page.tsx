"use client";

import { useEffect } from "react";
import V2RoomInvitePage from "../../../v2/rooms/[roomId]/invite/page";

const PENDING_ROOM_INVITE_KEY = "loombus:pending-room-invite";

function isSafeRoomInvitePath(path: string) {
  return path.startsWith("/rooms/") && path.includes("/invite?invite=") && !path.startsWith("//");
}

export default function PublicRoomInvitePage() {
  useEffect(() => {
    const invitePath = `${window.location.pathname}${window.location.search}`;

    if (isSafeRoomInvitePath(invitePath)) {
      window.localStorage.setItem(PENDING_ROOM_INVITE_KEY, invitePath);
    }
  }, []);

  return <V2RoomInvitePage />;
}
