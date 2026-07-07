"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileQuestion,
  FileText,
  FolderOpen,
  HelpCircle,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserPlus,
  Users,
  Vote,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
type PlanKey = "starter" | "pro" | "organization" | "organization_plus" | "organization_enterprise";
type PlanFeature = {
  label: string;
  href: (roomId: string) => string;
  icon: typeof LayoutGrid;
  future?: boolean;
};
type PlanGroup = { key: PlanKey; title: string; aliases: string[]; features: PlanFeature[] };

const starterFeatures: PlanFeature[] = [
  { label: "Overview", href: (roomId) => `/rooms/${roomId}/overview`, icon: Building2 },
  { label: "Discussions", href: (roomId) => `/rooms/${roomId}/discussions`, icon: MessageCircle },
  { label: "Calendar", href: (roomId) => `/rooms/${roomId}/calendar`, icon: CalendarDays },
  { label: "Announcements", href: (roomId) => `/rooms/${roomId}/announcements`, icon: Megaphone },
  { label: "Members / Roles", href: (roomId) => `/rooms/${roomId}/members`, icon: Users },
  { label: "Requests", href: (roomId) => `/rooms/${roomId}/requests`, icon: ClipboardList },
  { label: "Resources", href: (roomId) => `/rooms/${roomId}/resources`, icon: FileText },
  { label: "Settings", href: (roomId) => `/rooms/${roomId}/settings`, icon: Settings },
];

const proAdditions: PlanFeature[] = [
  { label: "Tasks / Action Items", href: (roomId) => `/rooms/${roomId}/tasks`, icon: CheckCircle2 },
  { label: "Polls / Decisions", href: (roomId) => `/rooms/${roomId}/polls`, icon: Vote },
  { label: "Directory / Contacts", href: (roomId) => `/rooms/${roomId}/directory`, icon: Users },
  { label: "Knowledge Base / FAQ", href: (roomId) => `/rooms/${roomId}/faq`, icon: HelpCircle },
  { label: "Files / Documents", href: (roomId) => `/rooms/${roomId}/documents`, icon: FolderOpen },
  { label: "Forms / Submissions", href: (roomId) => `/rooms/${roomId}/forms`, icon: FileQuestion },
];

const organizationAdditions: PlanFeature[] = [
  { label: "Services / Store", href: (roomId) => `/rooms/${roomId}/services`, icon: ShoppingBag },
  { label: "Invites / Join Requests", href: (roomId) => `/rooms/${roomId}/members`, icon: UserPlus },
  { label: "Activity / Audit Log", href: (roomId) => `/rooms/${roomId}/activity`, icon: Activity },
  { label: "Advanced room controls", href: (roomId) => `/rooms/${roomId}/settings`, icon: ShieldCheck },
];

const organizationPlusAdditions: PlanFeature[] = [
  { label: "More admin tools", href: (roomId) => `/rooms/${roomId}/modules`, icon: Sparkles, future: true },
  { label: "Larger room operations", href: (roomId) => `/rooms/${roomId}/modules`, icon: Building2, future: true },
  { label: "Advanced member workflows", href: (roomId) => `/rooms/${roomId}/members`, icon: Users, future: true },
];

const enterpriseAdditions: PlanFeature[] = [
  { label: "Enterprise controls", href: (roomId) => `/rooms/${roomId}/settings`, icon: ShieldCheck, future: true },
  { label: "High-capacity rooms", href: (roomId) => `/rooms/${roomId}/modules`, icon: Building2, future: true },
  { label: "Full private community operations", href: (roomId) => `/rooms/${roomId}/modules`, icon: LayoutGrid, future: true },
];

const PLAN_GROUPS: PlanGroup[] = [
  { key: "starter", title: "Room Starter", aliases: ["starter", "room_starter"], features: starterFeatures },
  { key: "pro", title: "Room Pro", aliases: ["pro", "room_pro"], features: [...starterFeatures, ...proAdditions] },
  { key: "organization", title: "Organization", aliases: ["organization"], features: [...starterFeatures, ...proAdditions, ...organizationAdditions] },
  { key: "organization_plus", title: "Organization Plus", aliases: ["organization_plus", "org_plus"], features: [...starterFeatures, ...proAdditions, ...organizationAdditions, ...organizationPlusAdditions] },
  { key: "organization_enterprise", title: "Organization Enterprise", aliases: ["organization_enterprise", "enterprise", "org_enterprise"], features: [...starterFeatures, ...proAdditions, ...organizationAdditions, ...organizationPlusAdditions, ...enterpriseAdditions] },
];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlan(value: unknown): PlanKey | null {
  const plan = asString(value).toLowerCase();
  return PLAN_GROUPS.find((group) => group.aliases.includes(plan))?.key ?? null;
}

function isRoomHomePath(pathname: string | null, roomId: string) {
  if (!pathname || !roomId) return false;
  return pathname === `/rooms/${roomId}` || pathname === `/v2/rooms/${roomId}`;
}

function findBackToRoomsLink() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href="/rooms"]'));
  return links.find((link) => link.textContent?.toLowerCase().includes("back to rooms")) ?? null;
}

export function RoomPlanMenu({ roomId }: { roomId: string }) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [canView, setCanView] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<PlanKey | null>(null);

  const shouldShow = isRoomHomePath(pathname, roomId);

  useEffect(() => {
    if (!shouldShow) {
      setHost(null);
      return;
    }

    let activeHost: HTMLElement | null = null;

    function placeHost() {
      const backLink = findBackToRoomsLink();
      if (!backLink?.parentElement) return;

      if (activeHost?.parentElement) return;

      const nextHost = document.createElement("div");
      nextHost.setAttribute("data-room-plan-menu-host", "true");
      nextHost.className = "relative z-[110] float-right ml-3";
      backLink.insertAdjacentElement("afterend", nextHost);
      activeHost = nextHost;
      setHost(nextHost);
    }

    placeHost();
    const observer = new MutationObserver(placeHost);
    observer.observe(document.body, { childList: true, subtree: true });
    const intervalId = window.setInterval(placeHost, 500);
    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 7000);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      activeHost?.remove();
      setHost(null);
    };
  }, [roomId, shouldShow]);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;
      if (!currentUserId || !roomId || !shouldShow) {
        if (!cancelled) setCanView(false);
        return;
      }

      const [{ data: roomData }, { data: memberData }] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("room_members").select("*").eq("room_id", roomId),
      ]);

      const room = (roomData ?? {}) as Row;
      const members = ((memberData ?? []) as Row[]).map((member) => asString(member.user_id));
      const isOwner = asString(room.owner_id) === currentUserId || asString(room.created_by) === currentUserId;
      const isMember = members.includes(currentUserId);

      if (!cancelled) {
        setCurrentPlan(normalizePlan(room.subscription_plan));
        setCanView(Boolean(isOwner || isMember));
      }
    }

    checkAccess();
    const { data } = supabase.auth.onAuthStateChange(() => checkAccess());

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [roomId, shouldShow]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!open) return;
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const currentPlanTitle = useMemo(() => PLAN_GROUPS.find((group) => group.key === currentPlan)?.title ?? "Room plan", [currentPlan]);

  if (!host || !canView || !shouldShow) return null;

  return createPortal(
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Room Menu <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-3 w-[min(92vw,28rem)] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-950/5" role="menu">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Room plan map</p>
            <p className="mt-1 text-sm font-bold text-slate-700">Current: {currentPlanTitle}</p>
          </div>
          <div className="max-h-[72vh] overflow-y-auto p-3">
            {PLAN_GROUPS.map((group) => (
              <section key={group.key} className="rounded-2xl p-2">
                <div className="mb-2 flex items-center justify-between gap-2 px-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">{group.title}</h3>
                  {currentPlan === group.key && <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">Current Plan</span>}
                </div>
                <div className="grid gap-1">
                  {group.features.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <Link
                        key={`${group.key}-${feature.label}`}
                        href={feature.href(roomId)}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-amber-50 hover:text-amber-800"
                        role="menuitem"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Icon className="size-4 shrink-0 text-amber-700" />
                          <span className="truncate">{feature.label}</span>
                        </span>
                        {feature.future && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500 ring-1 ring-slate-200">Roadmap</span>}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>,
    host,
  );
}
