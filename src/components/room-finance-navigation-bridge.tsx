"use client";

import Link from "next/link";
import { Landmark } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export function RoomFinanceNavigationBridge() {
  const params = useParams();
  const pathname = usePathname();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!roomId) return;
    const find = () => {
      const node = document.querySelector<HTMLElement>('nav[aria-label="Room workspace"]');
      setTarget(node);
      return Boolean(node);
    };
    if (find()) return;
    const observer = new MutationObserver(() => { if (find()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [roomId]);
  if (!target || !roomId) return null;
  const href = `/rooms/${encodeURIComponent(roomId)}/finance`;
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return createPortal(
    <Link href={href} aria-current={active ? "page" : undefined} className="rooms-phase1-nav-link" title="Finance">
      <Landmark aria-hidden="true" /><span>Finance</span>
    </Link>, target
  );
}