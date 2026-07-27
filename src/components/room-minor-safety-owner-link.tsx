"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function RoomMinorSafetyOwnerLink() {
  const params = useParams<{ roomId: string }>();
  const roomId = String(params?.roomId ?? "");
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!roomId) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch(`/api/rooms/${roomId}/minor-safety`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!cancelled) setCanManage(response.ok && payload.canManage === true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (!canManage) return null;

  return (
    <aside className="mx-auto mb-32 mt-6 flex w-[min(1120px,calc(100%-24px))] items-center justify-between gap-4 rounded-3xl border border-[#CBAB5B]/25 bg-[#CBAB5B]/[0.06] p-5 text-current">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-[#CBAB5B]" aria-hidden="true" />
        <div>
          <strong className="block">Minor safety</strong>
          <span className="mt-1 block text-sm opacity-65">
            Control teen admission, staff approval, and adult contact boundaries for this Room.
          </span>
        </div>
      </div>
      <Link
        href={`/rooms/${roomId}/minor-safety`}
        className="shrink-0 rounded-full bg-[#CBAB5B] px-4 py-2 text-sm font-semibold text-[#171208]"
      >
        Manage
      </Link>
    </aside>
  );
}
