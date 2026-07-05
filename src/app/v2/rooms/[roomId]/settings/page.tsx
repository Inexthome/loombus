"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, LayoutGrid, PauseCircle, Save, Settings, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../../v2-shell-components";

type Row = Record<string, unknown>;

type Room = {
  id: string;
  name: string;
  ownerId: string;
  createdBy: string;
  isPrivate: boolean;
};

type Member = {
  userId: string;
  role: string;
};

type RoomPreferences = {
  displayName: string;
  description: string;
  privacyMode: "private" | "restricted" | "public_preview";
  roomStatus: "active" | "paused" | "archived";
  postingRule: "members" | "contributors" | "admins";
  joinRule: "owner_add_only" | "request_to_join" | "invite_only";
  roomIcon: string;
  themeLabel: string;
  calendarEnabled: boolean;
  announcementsEnabled: boolean;
  requestsEnabled: boolean;
  resourcesEnabled: boolean;
  servicesEnabled: boolean;
  membersEnabled: boolean;
};

const DEFAULT_PREFERENCES: RoomPreferences = {
  displayName: "",
  description: "",
  privacyMode: "private",
  roomStatus: "active",
  postingRule: "members",
  joinRule: "owner_add_only",
  roomIcon: "hub",
  themeLabel: "default",
  calendarEnabled: true,
  announcementsEnabled: true,
  requestsEnabled: true,
  resourcesEnabled: true,
  servicesEnabled: true,
  membersEnabled: true,
};

const MODULES: Array<{ key: keyof Pick<RoomPreferences, "calendarEnabled" | "announcementsEnabled" | "requestsEnabled" | "resourcesEnabled" | "servicesEnabled" | "membersEnabled">; label: string; description: string }> = [
  { key: "calendarEnabled", label: "Calendar", description: "Events, updates, and scheduled room activity." },
  { key: "announcementsEnabled", label: "Announcements", description: "Pinned updates and owner/admin broadcasts." },
  { key: "requestsEnabled", label: "Requests", description: "Member issues, help requests, and tracked needs." },
  { key: "resourcesEnabled", label: "Resources", description: "Documents, links, notes, rules, and forms." },
  { key: "servicesEnabled", label: "Services / Store", description: "Listings, offers, appointments, and service requests." },
  { key: "membersEnabled", label: "Members / Roles", description: "Member list, roles, and access structure." },
];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function normalizeRoom(row: Row): Room {
  const visibility = asString(row.visibility).toLowerCase();
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || "Untitled room",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
    isPrivate: asBoolean(row.is_private) || asBoolean(row.private) || visibility === "private",
  };
}

function normalizeMember(row: Row): Member {
  return {
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
  };
}

function normalizePreferences(row: Row | null, roomName: string): RoomPreferences {
  if (!row) return { ...DEFAULT_PREFERENCES, displayName: roomName };
  return {
    displayName: asString(row.display_name) || roomName,
    description: asString(row.description),
    privacyMode: ["private", "restricted", "public_preview"].includes(asString(row.privacy_mode)) ? (asString(row.privacy_mode) as RoomPreferences["privacyMode"]) : "private",
    roomStatus: ["active", "paused", "archived"].includes(asString(row.room_status)) ? (asString(row.room_status) as RoomPreferences["roomStatus"]) : "active",
    postingRule: ["members", "contributors", "admins"].includes(asString(row.posting_rule)) ? (asString(row.posting_rule) as RoomPreferences["postingRule"]) : "members",
    joinRule: ["owner_add_only", "request_to_join", "invite_only"].includes(asString(row.join_rule)) ? (asString(row.join_rule) as RoomPreferences["joinRule"]) : "owner_add_only",
    roomIcon: asString(row.room_icon) || "hub",
    themeLabel: asString(row.theme_label) || "default",
    calendarEnabled: asBoolean(row.calendar_enabled, true),
    announcementsEnabled: asBoolean(row.announcements_enabled, true),
    requestsEnabled: asBoolean(row.requests_enabled, true),
    resourcesEnabled: asBoolean(row.resources_enabled, true),
    servicesEnabled: asBoolean(row.services_enabled, true),
    membersEnabled: asBoolean(row.members_enabled, true),
  };
}

export default function V2RoomPreferencesPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => {
    if (Array.isArray(rawRoomId)) return rawRoomId[0] ?? "";
    return rawRoomId ?? "";
  }, [rawRoomId]);

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [preferences, setPreferences] = useState<RoomPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";
  const canAccess = Boolean(room && userId && (isOwner || currentMember));
  const canManage = Boolean(room && userId && (isOwner || isAdmin));
  const enabledCount = MODULES.filter((item) => preferences[item.key]).length;

  async function loadPreferences() {
    if (!roomId) return;
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const nextUserId = data.session?.user.id ?? null;
      setUserId(nextUserId);

      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (!nextUserId || !accessToken || !nextPayload.authenticated || !nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") {
        setRoom(null);
        setMembers([]);
        return;
      }

      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (roomError || !roomData) {
        setRoom(null);
        setMembers([]);
        setMessage("This room is private or unavailable to your account.");
        return;
      }

      const nextRoom = normalizeRoom(roomData as Row);
      setRoom(nextRoom);

      const { data: memberData } = await supabase.from("room_members").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      setMembers(nextMembers);

      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      const nextIsMember = nextMembers.some((member) => member.userId === nextUserId);
      if (nextRoom.isPrivate && !nextIsOwner && !nextIsMember) {
        setMessage("Room controls are private to approved room members.");
        return;
      }

      const { data: preferenceData } = await supabase.from("room_preferences").select("*").eq("room_id", roomId).maybeSingle();
      setPreferences(normalizePreferences((preferenceData as Row | null) ?? null, nextRoom.name));
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load room controls right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreferences();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadPreferences();
    });
    return () => data.subscription.unsubscribe();
  }, [roomId]);

  function updatePreference<K extends keyof RoomPreferences>(key: K, value: RoomPreferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_preferences").upsert(
        {
          room_id: room.id,
          display_name: preferences.displayName.trim() || room.name,
          description: preferences.description.trim(),
          privacy_mode: preferences.privacyMode,
          room_status: preferences.roomStatus,
          posting_rule: preferences.postingRule,
          join_rule: preferences.joinRule,
          room_icon: preferences.roomIcon.trim() || "hub",
          theme_label: preferences.themeLabel.trim() || "default",
          calendar_enabled: preferences.calendarEnabled,
          announcements_enabled: preferences.announcementsEnabled,
          requests_enabled: preferences.requestsEnabled,
          resources_enabled: preferences.resourcesEnabled,
          services_enabled: preferences.servicesEnabled,
          members_enabled: preferences.membersEnabled,
          created_by: userId,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "room_id" },
      );

      if (error) throw error;
      setMessage("Room controls saved.");
      await loadPreferences();
    } catch {
      setMessage("Loombus could not save these room controls yet. Confirm the room preferences migration and RLS policies are active.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <V2ShellGateCard title="Opening room controls" message="Loombus is loading this room control center." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open this room." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;
  if (!room || !canAccess) return <V2ShellGateCard title="Room controls are private" message={message || "Room controls are only visible to approved room members."} payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" /> Back to room
        </Link>
        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <form onSubmit={handleSave} className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Room Settings / Controls</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{preferences.displayName || room.name}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">Manage room identity, privacy posture, operating rules, and which room modules are visible.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{preferences.roomStatus}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{preferences.privacyMode.replace(/_/g, " ")}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{enabledCount} modules on</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{canManage ? "Owner/admin tools" : "Read-only view"}</span>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <Settings className="size-5 text-amber-700" />
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Room identity</h2>
                    <p className="mt-1 text-sm text-slate-600">Set how this room presents itself inside Loombus Rooms.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input value={preferences.displayName} onChange={(event) => updatePreference("displayName", event.target.value)} disabled={!canManage} placeholder="Room display name" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-60" />
                  <input value={preferences.roomIcon} onChange={(event) => updatePreference("roomIcon", event.target.value)} disabled={!canManage} placeholder="Room icon label" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-60" />
                </div>
                <textarea value={preferences.description} onChange={(event) => updatePreference("description", event.target.value)} disabled={!canManage} placeholder="Room description, purpose, rules, or operating notes" rows={4} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-60" />
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-amber-700" />
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Access rules</h2>
                    <p className="mt-1 text-sm text-slate-600">Define room visibility, joining flow, and who can post.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-2"><span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Privacy</span><select value={preferences.privacyMode} onChange={(event) => updatePreference("privacyMode", event.target.value as RoomPreferences["privacyMode"])} disabled={!canManage} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-60"><option value="private">Private</option><option value="restricted">Restricted</option><option value="public_preview">Public preview</option></select></label>
                  <label className="space-y-2"><span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Room status</span><select value={preferences.roomStatus} onChange={(event) => updatePreference("roomStatus", event.target.value as RoomPreferences["roomStatus"])} disabled={!canManage} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-60"><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label>
                  <label className="space-y-2"><span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Posting rule</span><select value={preferences.postingRule} onChange={(event) => updatePreference("postingRule", event.target.value as RoomPreferences["postingRule"])} disabled={!canManage} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-60"><option value="members">Members can post</option><option value="contributors">Contributors and above</option><option value="admins">Admins only</option></select></label>
                  <label className="space-y-2"><span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Join rule</span><select value={preferences.joinRule} onChange={(event) => updatePreference("joinRule", event.target.value as RoomPreferences["joinRule"])} disabled={!canManage} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-60"><option value="owner_add_only">Owner/admin adds members</option><option value="request_to_join">Request to join</option><option value="invite_only">Invite only</option></select></label>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <LayoutGrid className="size-5 text-amber-700" />
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Module visibility</h2>
                    <p className="mt-1 text-sm text-slate-600">Choose which operating modules this room should show as enabled.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {MODULES.map((item) => (
                    <label key={item.key} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <input type="checkbox" checked={preferences[item.key]} onChange={(event) => updatePreference(item.key, event.target.checked)} disabled={!canManage} className="mt-1 size-4" />
                      <span><span className="block text-sm font-black text-slate-950">{item.label}</span><span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">{item.description}</span></span>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Control summary</h2><Eye className="size-4 text-amber-700" /></div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd className="font-black text-slate-900">{preferences.roomStatus}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Privacy</dt><dd className="font-black text-slate-900">{preferences.privacyMode.replace(/_/g, " ")}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Posting</dt><dd className="font-black text-slate-900">{preferences.postingRule}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Modules</dt><dd className="font-black text-slate-900">{enabledCount}/{MODULES.length}</dd></div>
                </dl>
              </section>
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Room status meaning</h2><PauseCircle className="size-4 text-amber-700" /></div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <p><strong className="text-slate-900">Active:</strong> room operates normally.</p>
                  <p><strong className="text-slate-900">Paused:</strong> owner intends to slow or freeze activity.</p>
                  <p><strong className="text-slate-900">Archived:</strong> room should be treated as preserved history.</p>
                </div>
              </section>
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Important</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">This MVP stores room controls. Enforcing every module toggle across each module should be handled in follow-up PRs after this page is confirmed.</p>
              </section>
              {canManage && <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Save className="size-4" /> Save room controls</button>}
            </aside>
          </div>
        </form>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
