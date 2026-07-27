"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function AdminTeenSafetyLink() {
  const [allowed, setAllowed] = useState(false);
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/admin/teen-safety", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (cancelled || !response.ok) return;
      const open = [
        ...(payload.corrections ?? []),
        ...(payload.underageReports ?? []),
        ...(payload.reviewItems ?? []),
      ].filter((item) => ["pending", "reviewing", "new", "open"].includes(item.status)).length;
      setOpenCount(open);
      setAllowed(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!allowed) return null;

  return (
    <aside className="mx-auto mb-28 mt-6 flex w-[min(1180px,calc(100%-24px))] items-center justify-between gap-4 rounded-3xl border border-[#CBAB5B]/25 bg-[#CBAB5B]/[0.06] p-5 text-current">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-[#CBAB5B]" aria-hidden="true" />
        <div>
          <strong className="block">Teen Safety Operations</strong>
          <span className="mt-1 block text-sm opacity-65">
            {openCount} open age correction, underage-account, or migration review{openCount === 1 ? "" : "s"}.
          </span>
        </div>
      </div>
      <Link
        href="/admin/teen-safety"
        className="shrink-0 rounded-full bg-[#CBAB5B] px-4 py-2 text-sm font-semibold text-[#171208]"
      >
        Open queue
      </Link>
    </aside>
  );
}
