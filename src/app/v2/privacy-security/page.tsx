"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bookmark,
  BookOpen,
  ChevronRight,
  CloudDownload,
  CreditCard,
  Eye,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Monitor,
  Paintbrush,
  Save,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

type SettingsNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio?: string | null;
};

type BlockedUser = {
  blocked_id: string;
  created_at: string | null;
  profile: ProfileRow | null;
};

type SecurityEvent = {
  label: string;
  detail: string;
  meta: string;
  icon: LucideIcon;
};

type PrivacyAction = {
  label: string;
  description: string;
  icon: LucideIcon;
  value: string;
  actionLabel: string;
  href?: string;
  onClick?: () => void;
  tone?: string;
};

type PasswordForm = {
  password: string;
  confirmPassword: string;
};

const SETTINGS_NAV: SettingsNavItem[] = [
  { label: "Account", href: "/v2/settings", icon: UserRound },
  { label: "Profile", href: "/v2/profile", icon: UserRound },
  { label: "Privacy & Security", href: "/v2/privacy-security", icon: Lock, active: true },
  { label: "Notifications", href: "/v2/notifications", icon: Bell },
  { label: "Appearance", href: "/v2/settings", icon: Paintbrush },
  { label: "Messages", href: "/v2/messages", icon: Mail },
  { label: "Billing & Plans", href: "/v2/premium", icon: CreditCard },
];

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not available";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function getProfileName(profile: ProfileRow | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

function getProfileHandle(profile: ProfileRow | null) {
  return profile?.username?.trim() ? `@${profile.username}` : "Blocked profile";
}

function getInitial(profile: ProfileRow | null) {
  return getProfileName(profile).slice(0, 1).toUpperCase() || "L";
}

function isV2Allowed(payload: ShellPayload | null) {
  return Boolean(payload?.authenticated && payload.configured && payload.flags.v2_shell && payload.version === "v2");
}

function SettingsSidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-5 lg:flex lg:flex-col lg:justify-between">
      <div>
        <h2 className="mb-7 text-base font-black text-slate-950">Settings</h2>
        <nav className="space-y-2">
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${item.active ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200" : "text-slate-600 hover:bg-amber-50 hover:text-amber-800"}`}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Link href="/v2/support" className="rounded-2xl p-3 text-sm transition hover:bg-amber-50">
        <p className="flex items-center gap-2 font-black text-slate-700"><MessageCircle className="size-4 text-amber-700" />Need help?</p>
        <p className="mt-2 text-xs font-black text-amber-800">Visit Help Center</p>
      </Link>
    </aside>
  );
}

function SecurityStatusCard({ user }: { user: User | null }) {
  const hasEmail = Boolean(user?.email);
  const emailConfirmed = Boolean(user?.email_confirmed_at);
  const providerCount = user?.identities?.length ?? 0;
  const completedChecks = [hasEmail, emailConfirmed, providerCount > 0].filter(Boolean).length;

  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Security Status</h2>
      <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
        <p className="text-3xl font-black">{completedChecks}/3</p>
        <p className="mt-1 text-xs font-black text-amber-800">Verified account checks</p>
      </div>
      <div className="mt-4 space-y-2 text-xs font-semibold text-slate-600">
        <p className="flex items-center gap-2"><ShieldCheck className={`size-4 ${hasEmail ? "text-emerald-600" : "text-slate-400"}`} />Email on account: {hasEmail ? user?.email : "Not available"}</p>
        <p className="flex items-center gap-2"><ShieldCheck className={`size-4 ${emailConfirmed ? "text-emerald-600" : "text-slate-400"}`} />Email verification: {emailConfirmed ? "Verified" : "Not verified"}</p>
        <p className="flex items-center gap-2"><ShieldCheck className={`size-4 ${providerCount > 0 ? "text-emerald-600" : "text-slate-400"}`} />Sign-in providers: {providerCount || "None detected"}</p>
      </div>
    </section>
  );
}

function SecurityEventsCard({ events }: { events: SecurityEvent[] }) {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Recent Sign-Ins</h2>
        <span className="text-xs font-black text-slate-400">Current account</span>
      </div>
      <div className="space-y-4">
        {events.map((event) => {
          const Icon = event.icon;
          return (
            <article key={`${event.label}-${event.meta}`} className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-950">{event.label}</h3>
                <p className="text-xs font-semibold text-slate-500">{event.detail}</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{event.meta}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ActionCard({ action }: { action: PrivacyAction }) {
  const Icon = action.icon;
  const card = (
    <article className="rounded-[1.6rem] border border-slate-200/90 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-white/80 transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_24px_70px_rgba(214,168,79,0.12)] sm:p-6">
      <div className="flex items-start gap-4">
        <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${action.tone ?? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"}`}>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-black leading-tight text-slate-950">{action.label}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{action.description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">{action.value}</span>
          </div>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-amber-800">
            {action.actionLabel}
            <ChevronRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );

  if (action.href) return <Link href={action.href} className="block">{card}</Link>;
  return <button type="button" onClick={action.onClick} className="block w-full text-left">{card}</button>;
}

function PasswordPanel({
  passwordForm,
  setPasswordForm,
  saving,
  onSubmit,
}: {
  passwordForm: PasswordForm;
  setPasswordForm: (next: PasswordForm) => void;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-200"><KeyRound className="size-5" /></span>
        <div>
          <h2 className="font-black text-slate-950">Change Password</h2>
          <p className="text-xs font-semibold text-slate-500">Updates your Supabase auth password for email sign-in.</p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="grid gap-3">
        <input
          type="password"
          autoComplete="new-password"
          value={passwordForm.password}
          onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })}
          placeholder="New password"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
        />
        <input
          type="password"
          autoComplete="new-password"
          value={passwordForm.confirmPassword}
          onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
          placeholder="Confirm new password"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
        />
        <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:opacity-60">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "Updating..." : "Update password"}
        </button>
      </form>
    </section>
  );
}

function BlockedUsersPanel({
  blockedUsers,
  workingBlockedId,
  onUnblock,
}: {
  blockedUsers: BlockedUser[];
  workingBlockedId: string;
  onUnblock: (blockedId: string) => void;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-slate-950">Blocked Users</h2>
          <p className="text-xs font-semibold text-slate-500">Manage accounts you have blocked.</p>
        </div>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">{blockedUsers.length}</span>
      </div>
      <div className="space-y-3">
        {blockedUsers.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600">No blocked users.</div>
        ) : blockedUsers.map((blocked) => (
          <article key={blocked.blocked_id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3">
            <div className="flex min-w-0 items-center gap-3">
              {blocked.profile?.avatar_url ? (
                <img src={blocked.profile.avatar_url} alt="" className="size-10 rounded-full object-cover" />
              ) : (
                <span className="grid size-10 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">{getInitial(blocked.profile)}</span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{getProfileName(blocked.profile)}</p>
                <p className="truncate text-xs font-semibold text-slate-500">{getProfileHandle(blocked.profile)} · blocked {formatRelativeTime(blocked.created_at)}</p>
              </div>
            </div>
            <button type="button" onClick={() => onUnblock(blocked.blocked_id)} disabled={workingBlockedId === blocked.blocked_id} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-60">
              {workingBlockedId === blocked.blocked_id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              Unblock
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function DangerZone({ onSignOutAll, onRequestDeletion, signingOut }: { onSignOutAll: () => void; onRequestDeletion: () => void; signingOut: boolean }) {
  return (
    <section className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-white text-red-700 ring-1 ring-red-200"><ShieldAlert className="size-5" /></span>
        <div>
          <h2 className="font-black text-slate-950">Security Actions</h2>
          <p className="text-xs font-semibold text-slate-600">Use carefully. These actions affect account access.</p>
        </div>
      </div>
      <div className="grid gap-3">
        <button type="button" onClick={onSignOutAll} disabled={signingOut} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-red-700 ring-1 ring-red-200 transition hover:bg-red-100 disabled:opacity-60">
          {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          {signingOut ? "Signing out..." : "Sign out all sessions"}
        </button>
        <button type="button" onClick={onRequestDeletion} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-700">
          <Trash2 className="size-4" />
          Request account deletion
        </button>
      </div>
    </section>
  );
}

export default function V2PrivacySecurityPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [message, setMessage] = useState("");
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({ password: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [workingBlockedId, setWorkingBlockedId] = useState("");

  async function loadBlockedUsers(currentUserId: string) {
    const { data: blockRows, error } = await supabase
      .from("user_blocks")
      .select("blocked_id, created_at")
      .eq("blocker_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setBlockedUsers([]);
      return;
    }

    const rows = (blockRows ?? []) as Array<{ blocked_id: string; created_at: string | null }>;
    const blockedIds = rows.map((row) => row.blocked_id).filter(Boolean);
    let profileMap = new Map<string, ProfileRow>();

    if (blockedIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", blockedIds);
      profileMap = new Map(((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, row]));
    }

    setBlockedUsers(rows.map((row) => ({ blocked_id: row.blocked_id, created_at: row.created_at, profile: profileMap.get(row.blocked_id) ?? null })));
  }

  async function loadShell() {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, bio")
          .eq("id", currentUser.id)
          .maybeSingle();
        setProfile((profileData ?? null) as ProfileRow | null);
        await loadBlockedUsers(currentUser.id);
      } else {
        setProfile(null);
        setBlockedUsers([]);
      }

      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
    } catch {
      setPayload(getDefaultShellPayload());
      setProfile(null);
      setBlockedUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => void loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  const securityEvents = useMemo<SecurityEvent[]>(() => [
    {
      label: "Current session",
      detail: user?.email ?? "Signed-in user not available",
      meta: formatRelativeTime(user?.last_sign_in_at),
      icon: Smartphone,
    },
    {
      label: "Account created",
      detail: "Loombus account record",
      meta: formatRelativeTime(user?.created_at),
      icon: Monitor,
    },
  ], [user]);

  function handleDownloadData() {
    setExportingData(true);
    setMessage("");

    try {
      const exportPayload = {
        exported_at: new Date().toISOString(),
        account: {
          id: user?.id ?? null,
          email: user?.email ?? null,
          email_confirmed_at: user?.email_confirmed_at ?? null,
          created_at: user?.created_at ?? null,
          last_sign_in_at: user?.last_sign_in_at ?? null,
          providers: user?.identities?.map((identity) => identity.provider) ?? [],
        },
        profile,
        privacy_security: {
          blocked_users: blockedUsers.map((blocked) => ({
            blocked_id: blocked.blocked_id,
            blocked_at: blocked.created_at,
            profile: blocked.profile,
          })),
          saved_items_visibility: "private",
          profile_visibility: "public",
          activity_visibility: "public",
        },
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `loombus-privacy-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("Privacy export downloaded.");
    } finally {
      setExportingData(false);
    }
  }

  async function handleResendVerification() {
    if (!user?.email || resendingEmail) return;

    setResendingEmail(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      setMessage(error ? error.message : "Verification email sent.");
    } catch {
      setMessage("Unable to send verification email.");
    } finally {
      setResendingEmail(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordSaving) return;

    setMessage("");
    if (passwordForm.password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.password });
      if (error) {
        setMessage(error.message);
        return;
      }
      setPasswordForm({ password: "", confirmPassword: "" });
      setMessage("Password updated.");
    } catch {
      setMessage("Unable to update password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleUnblock(blockedId: string) {
    if (!user?.id || workingBlockedId) return;

    setWorkingBlockedId(blockedId);
    setMessage("");
    try {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", blockedId);

      if (error) {
        setMessage(error.message || "Unable to unblock this user.");
        return;
      }

      setBlockedUsers((current) => current.filter((blocked) => blocked.blocked_id !== blockedId));
      setMessage("User unblocked.");
    } catch {
      setMessage("Unable to unblock this user.");
    } finally {
      setWorkingBlockedId("");
    }
  }

  async function handleSignOutAllSessions() {
    if (signingOut) return;

    setSigningOut(true);
    setMessage("");
    try {
      await supabase.auth.signOut({ scope: "global" });
      window.location.href = "/login";
    } catch {
      setMessage("Unable to sign out all sessions.");
      setSigningOut(false);
    }
  }

  function handleRequestDeletion() {
    const subject = encodeURIComponent("Loombus account deletion request");
    const body = encodeURIComponent(`Please help me delete my Loombus account.\n\nAccount email: ${user?.email ?? ""}\nUser ID: ${user?.id ?? ""}`);
    window.location.href = `mailto:support@loombus.com?subject=${subject}&body=${body}`;
  }

  const privacyActions = useMemo<PrivacyAction[]>(() => [
    {
      label: "Profile Visibility",
      description: "Review the public profile fields other members can see and update them from your profile page.",
      icon: UserRound,
      value: "Public",
      actionLabel: "Manage profile",
      href: "/v2/profile",
    },
    {
      label: "Messaging Permissions",
      description: "Open your messages area to review direct-message access and current conversation safety controls.",
      icon: Mail,
      value: "Guarded",
      actionLabel: "Open messages",
      href: "/v2/messages",
    },
    {
      label: "Activity Visibility",
      description: "Review your visible discussions, replies, and profile activity in the V2 activity hub.",
      icon: Eye,
      value: "Public activity",
      actionLabel: "Review activity",
      href: "/v2/my-activity",
    },
    {
      label: "Reading History",
      description: "Open your reading history page to review what Loombus has recorded for the V2 shell.",
      icon: BookOpen,
      value: "Private",
      actionLabel: "View history",
      href: "/v2/reading-history",
    },
    {
      label: "Download Your Data",
      description: "Download a local JSON export of account, profile, and privacy-security data available to this page.",
      icon: CloudDownload,
      value: exportingData ? "Preparing" : "Available",
      actionLabel: exportingData ? "Preparing export" : "Download export",
      onClick: handleDownloadData,
    },
    {
      label: "Blocked Users",
      description: "Review and unblock accounts you have blocked from interacting with you.",
      icon: UserRoundX,
      value: `${blockedUsers.length} blocked`,
      actionLabel: "Manage below",
      onClick: () => document.getElementById("v2-blocked-users")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    },
  ], [blockedUsers.length, exportingData]);

  if (loading) return <V2ShellGateCard title="Checking V2 Privacy & Security access" message="Loombus is verifying access before loading the V2 Privacy & Security shell." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!isV2Allowed(payload)) return <V2ShellGateCard title="V2 Privacy & Security is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on the current experience." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <div className="mx-auto flex max-w-7xl bg-white/40">
        <SettingsSidebar />
        <section className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
          <header className="mb-6">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-amber-800 lg:hidden">Account</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Privacy & Security</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Control your public profile visibility, account access, blocked users, and local data export.</p>
          </header>

          {message && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{message}</div>}

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-6">
              <section className="grid gap-4 md:grid-cols-2">
                {privacyActions.map((action) => <ActionCard key={action.label} action={action} />)}
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <PasswordPanel passwordForm={passwordForm} setPasswordForm={setPasswordForm} saving={passwordSaving} onSubmit={handlePasswordSubmit} />
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-200"><Mail className="size-5" /></span>
                    <div>
                      <h2 className="font-black text-slate-950">Email Verification</h2>
                      <p className="text-xs font-semibold text-slate-500">Confirm the email tied to this account.</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                    <p className="font-black text-slate-950">{user?.email ?? "No email available"}</p>
                    <p className="mt-1">Status: {user?.email_confirmed_at ? "Verified" : "Not verified"}</p>
                  </div>
                  <button type="button" onClick={() => void handleResendVerification()} disabled={resendingEmail || !user?.email || Boolean(user?.email_confirmed_at)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
                    {resendingEmail ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                    {user?.email_confirmed_at ? "Email verified" : resendingEmail ? "Sending..." : "Resend verification"}
                  </button>
                </section>
              </section>

              <div id="v2-blocked-users">
                <BlockedUsersPanel blockedUsers={blockedUsers} workingBlockedId={workingBlockedId} onUnblock={(blockedId) => void handleUnblock(blockedId)} />
              </div>

              <p className="flex items-center justify-center gap-2 pt-2 text-sm font-semibold text-slate-600">
                <ShieldCheck className="size-4 text-amber-700" />
                Account-specific values are shown only when Loombus can read them from the current signed-in session.
              </p>
            </div>

            <aside className="space-y-4">
              <SecurityStatusCard user={user} />
              <SecurityEventsCard events={securityEvents} />
              <DangerZone onSignOutAll={() => void handleSignOutAllSessions()} onRequestDeletion={handleRequestDeletion} signingOut={signingOut} />
              <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Privacy Links</h2>
                <div className="mt-4 space-y-3">
                  <Link href="/privacy" className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-black text-amber-800 transition hover:bg-amber-50">
                    <span className="inline-flex items-center gap-3"><Lock className="size-4" />Review Privacy Policy</span>
                    <ChevronRight className="size-4" />
                  </Link>
                  <Link href="/terms" className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-black text-amber-800 transition hover:bg-amber-50">
                    <span className="inline-flex items-center gap-3"><Bookmark className="size-4" />Review Terms</span>
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </section>
            </aside>
          </section>
        </section>
      </div>
      <V2ShellMobileNav />
    </main>
  );
}
