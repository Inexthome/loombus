"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type MemberSummary = {
  id: string;
  userId: string;
  role: string;
  createdAt: string | null;
};

const ROLE_ORDER = ["owner", "admin", "moderator", "contributor", "member", "viewer"] as const;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMember(row: Row, index: number): MemberSummary {
  return {
    id: asString(row.id) || `${asString(row.user_id) || "member"}-${index}`,
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
    createdAt: asString(row.created_at) || null,
  };
}

function formatRelativeTime(value: string | null) {
  if (!value) return "recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function RoomMembersSummary({ roomId }: { roomId: string }) {
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [railHost, setRailHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const billingSection = document.getElementById("billing");
    if (!billingSection) return;

    const host = document.createElement("div");
    host.setAttribute("data-room-members-summary", "true");
    billingSection.insertAdjacentElement("afterend", host);
    setRailHost(host);

    return () => {
      host.remove();
      setRailHost(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!roomId) return;
      setLoading(true);

      const { data } = await supabase
        .from("room_members")
        .select("id,user_id,role,created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (!cancelled) {
        setMembers(((data ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId));
        setLoading(false);
      }
    }

    loadSummary();

    const channel = supabase
      .channel(`room-members-summary-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, loadSummary)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const adminCount = members.filter((member) => member.role === "owner" || member.role === "admin").length;
  const moderatorCount = members.filter((member) => member.role === "moderator").length;
  const latestMember = [...members].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
  const roleLabel = ROLE_ORDER.find((role) => role === latestMember?.role) ?? "member";

  const card = (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <Users className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Members / Roles</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">
              {loading ? "Checking members" : `${members.length} member${members.length === 1 ? "" : "s"}`}
            </h2>
          </div>
        </div>
        {adminCount > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">{adminCount} admin</span>}
      </div>

      {latestMember ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{roleLabel}</span>
          <p className="mt-2 line-clamp-2 break-all text-sm font-black text-slate-900">{latestMember.userId}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">Added {formatRelativeTime(latestMember.createdAt)}</p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-slate-200">No approved room members yet.</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs font-black text-slate-600">
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><span className="block text-lg text-slate-950">{adminCount}</span> admins</div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><span className="block text-lg text-slate-950">{moderatorCount}</span> mods</div>
      </div>

      <Link href={`/rooms/${roomId}/members`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
        Open Members / Roles
      </Link>
    </section>
  );

  if (!railHost) return null;
  return createPortal(card, railHost);
}
