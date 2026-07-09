"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  FileText,
  Flag,
  FlaskConical,
  HeartPulse,
  Home,
  Inbox,
  KeyRound,
  Mail,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";
import styles from "./admin-v2-shell.module.css";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

const TOP_NAV_ITEMS = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Discussions", href: "/discussions", icon: MessageCircle },
  { label: "Create", href: "/create", icon: Plus, primary: true },
  { label: "Messages", href: "/messages", icon: Mail },
];

const ADMIN_NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: "Overview", items: [{ label: "Overview", href: "/admin", icon: Home, exact: true }] },
  {
    label: "Moderation",
    items: [
      { label: "Reports", href: "/admin/reports", icon: Flag },
      { label: "Safety Queue", href: "/admin/safety", icon: ShieldCheck },
      { label: "Deleted Discussions", href: "/admin/deleted", icon: RotateCcw },
      { label: "Deleted Replies", href: "/admin/deleted-replies", icon: MessageCircle },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Support Requests", href: "/admin/support", icon: Inbox },
      { label: "Billing Diagnostics", href: "/admin/billing", icon: KeyRound },
      { label: "Platform Health", href: "/admin/health", icon: HeartPulse },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Access", href: "/admin/ai-access", icon: Bot },
      { label: "Topic Memory", href: "/admin/topic-memory", icon: BarChart3 },
      { label: "Labs Requests", href: "/admin/labs", icon: FlaskConical },
      { label: "Audit Log", href: "/admin/audit", icon: FileText },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

function isActivePath(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminV2Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main data-admin-v2-shell className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] loombus-v2-top-nav shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/home" className="flex items-center gap-3 font-bold text-white">
            <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
            <span className="text-xl">Loombus</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {TOP_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Search className="size-5" /></Link>
            <Link href="/notifications" aria-label="Notifications" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Bell className="size-5" /></Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl bg-white/40">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">
          <div className="mb-8 flex items-center gap-3 text-xl font-black text-slate-950"><Shield className="size-6" />Admin</div>
          <nav className="space-y-7">
            {ADMIN_NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActivePath(pathname, item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black transition ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <section className={`min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 ${styles.content}`}>
          {children}
        </section>
      </div>
    </main>
  );
}
