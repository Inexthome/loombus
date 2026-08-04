"use client";

import Link from "next/link";
import { Wrench } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export function RoomMaintenanceNavigationBridge() {
  const params = useParams();
  const pathname = usePathname();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const findTarget = () => {
      const workspace = document.querySelector<HTMLElement>(
        'nav[aria-label="Room workspace"]'
      );
      setTarget(workspace);
      return Boolean(workspace);
    };
    if (findTarget()) return;
    const observer = new MutationObserver(() => {
      if (findTarget()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [roomId]);

  if (!target || !roomId) return null;
  const href = `/rooms/${encodeURIComponent(roomId)}/maintenance`;
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return createPortal(
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rooms-phase1-nav-link"
      title="Maintenance"
    >
      <Wrench aria-hidden="true" />
      <span>Maintenance</span>
    </Link>,
    target
  );
}
