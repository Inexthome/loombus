"use client";

import { useParams, usePathname } from "next/navigation";
import { useMemo } from "react";
import { RoomTierModulesWorkspace } from "@/components/room-tier-modules-workspace";

export function RoomTierModulesRouteBoundary() {
  const pathname = usePathname();
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const roomHome = roomId ? `/rooms/${encodeURIComponent(roomId)}` : "";

  if (!roomHome || pathname === roomHome || pathname === `${roomHome}/`) {
    return null;
  }

  return <RoomTierModulesWorkspace />;
}
