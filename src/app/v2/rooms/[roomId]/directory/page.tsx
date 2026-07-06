"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, Globe2, Mail, Phone, Pin, Plus, Trash2, UsersRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { V2ShellMobileNav, V2ShellTopNav } from "../../../v2-shell-components";

type Row = Record<string, unknown>;
type LoadState = "checking" | "ready" | "signed_out" | "blocked" | "error";
type Room = { id: string; name: string; ownerId: string; createdBy: string };
type Member = { userId: string; role: string };
type DirectoryContact = {
  id: string;
  name: string;
  roleTitle: string;
  organization: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
  contactType: string;
  isPinned: boolean;
};

const CONTACT_TYPES = ["general", "board", "management", "maintenance", "staff", "vendor", "emergency", "other"] as const;
const REQUEST_TIMEOUT_MS = 8000;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  return value === true;
}

function normalizeRoom(row: Row | null): Room | null {
  if (!row) return null;
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || "Private room",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
  };
}

function normalizeMember(row: Row): Member {
  return { userId: asString(row.user_id), role: asString(row.role) || "member" };
}

function normalizeContact(row: Row): DirectoryContact {
  return {
    id: asString(row.id),
    name: asString(row.name) || "Unnamed contact",
    roleTitle: asString(row.role_title),
    organization: asString(row.organization),
    email: asString(row.email),
    phone: asString(row.phone),
    website: asString(row.website),
    notes: asString(row.notes),
    contactType: asString(row.contact_type) || "general",
    isPinned: asBoolean(row.is_pinned),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message ?? "");
  return "Unknown directory loading error";
}

function normalizeWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getTypeLabel(value: string) {
  return value.replace(/_/g, " ");
}

async function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export default function V2RoomDirectoryPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] ?? "" : rawRoomId ?? ""), [rawRoomId]);

  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading directory data...");
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [contactType, setContactType] = useState("general");
  const [isPinned, setIsPinned] = useState(false);

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const canManage = Boolean(isOwner || currentMember?.role === "owner" || currentMember?.role === "admin");
  const pinnedContacts = contacts.filter((contact) => contact.isPinned);
  const emergencyContacts = contacts.filter((contact) => contact.contactType === "emergency");

  async function loadDirectory() {
    if (!roomId) {
      setLoadState("error");
      setMessage("Loombus could not find the room ID for this directory.");
      return;
    }

    setLoadState("checking");
    setMessage("Loading directory data...");

    try {
      const { data: sessionData } = await withTimeout(supabase.auth.getSession(), "session check");
      const nextUserId = sessionData.session?.user.id ?? null;
      setUserId(nextUserId);

      if (!nextUserId) {
        setLoadState("signed_out");
        setMessage("Sign in first so Loombus can open this room directory.");
        setRoom(null);
        setMembers([]);
        setContacts([]);
        return;
      }

      const { data: roomData, error: roomError } = await withTimeout(supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(), "room lookup");
      if (roomError) throw roomError;

      const nextRoom = normalizeRoom((roomData as Row | null) ?? null);
      if (!nextRoom) {
        setLoadState("blocked");
        setMessage("Room Directory / Contacts is only available to approved room members.");
        return;
      }

      const { data: memberData, error: memberError } = await withTimeout(supabase.from("room_members").select("*").eq("room_id", roomId), "member lookup");
      if (memberError) throw memberError;

      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      const nextMember = nextMembers.find((member) => member.userId === nextUserId);
      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      const nextCanAccess = Boolean(nextIsOwner || nextMember);

      setRoom(nextRoom);
      setMembers(nextMembers);

      if (!nextCanAccess) {
        setLoadState("blocked");
        setMessage("Room Directory / Contacts is only available to approved room members.");
        setContacts([]);
        return;
      }

      const { data: contactData, error: contactError } = await withTimeout(
        supabase.from("room_directory_contacts").select("*").eq("room_id", roomId).order("is_pinned", { ascending: false }).order("contact_type", { ascending: true }).order("name", { ascending: true }).limit(200),
        "directory lookup",
      );

      if (contactError) throw contactError;

      setContacts(((contactData ?? []) as Row[]).map(normalizeContact).filter((contact) => contact.id));
      setLoadState("ready");
      setMessage("");
    } catch (error) {
      setRoom(null);
      setMembers([]);
      setContacts([]);
      setLoadState("error");
      setMessage(`Loombus could not load room directory. Details: ${getErrorMessage(error)}`);
    }
  }

  useEffect(() => {
    void loadDirectory();
  }, [roomId]);

  async function handleCreateContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !canManage || !name.trim()) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_directory_contacts").insert({
        room_id: room.id,
        name: name.trim(),
        role_title: roleTitle.trim(),
        organization: organization.trim(),
        email: email.trim(),
        phone: phone.trim(),
        website: normalizeWebsite(website),
        notes: notes.trim(),
        contact_type: contactType,
        is_pinned: isPinned,
        created_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      setName("");
      setRoleTitle("");
      setOrganization("");
      setEmail("");
      setPhone("");
      setWebsite("");
      setNotes("");
      setContactType("general");
      setIsPinned(false);
      setMessage("Contact added.");
      await loadDirectory();
    } catch (error) {
      setMessage(`Loombus could not add this contact yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePinned(contact: DirectoryContact) {
    if (!canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_directory_contacts").update({ is_pinned: !contact.isPinned, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", contact.id);
      if (error) throw error;
      await loadDirectory();
    } catch (error) {
      setMessage(`Loombus could not update this contact yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteContact(contact: DirectoryContact) {
    if (!canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_directory_contacts").delete().eq("id", contact.id);
      if (error) throw error;
      setMessage("Contact removed.");
      await loadDirectory();
    } catch (error) {
      setMessage(`Loombus could not remove this contact yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" /> Back to room
        </Link>

        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200" style={{ color: "#fde68a" }}>Room Directory / Contacts</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl" style={{ color: "#ffffff" }}>{room?.name ?? "Room contact directory"}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50 sm:text-base" style={{ color: "#fff7ed" }}>Keep official people, departments, vendors, and important contacts in one place.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{contacts.length} contacts</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{pinnedContacts.length} pinned</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{emergencyContacts.length} emergency</span>
            </div>
          </div>

          {loadState !== "ready" && (
            <div className="p-6">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <UsersRound className="mx-auto size-9 text-amber-700" />
                <h2 className="mt-3 text-lg font-black text-slate-950">{loadState === "checking" ? "Checking room directory access" : loadState === "signed_out" ? "Sign in required" : loadState === "blocked" ? "Directory is private" : "Directory could not load"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
                <button type="button" onClick={() => loadDirectory()} className="mt-5 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">Retry</button>
              </div>
            </div>
          )}

          {loadState === "ready" && (
            <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-4">
                {contacts.map((contact) => (
                  <article key={contact.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          {contact.isPinned && <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-100">Pinned</span>}
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 ring-1 ring-slate-200">{getTypeLabel(contact.contactType)}</span>
                        </div>
                        <h2 className="mt-3 text-xl font-black text-slate-950">{contact.name}</h2>
                        {(contact.roleTitle || contact.organization) && <p className="mt-1 text-sm font-bold text-slate-600">{[contact.roleTitle, contact.organization].filter(Boolean).join(" · ")}</p>}
                        {contact.notes && <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{contact.notes}</p>}
                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                          {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-slate-700 ring-1 ring-slate-200 hover:text-amber-700"><Mail className="size-3" /> Email</a>}
                          {contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-slate-700 ring-1 ring-slate-200 hover:text-amber-700"><Phone className="size-3" /> {contact.phone}</a>}
                          {contact.website && <a href={contact.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-slate-700 ring-1 ring-slate-200 hover:text-amber-700"><Globe2 className="size-3" /> Website</a>}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex flex-col gap-2 sm:min-w-40">
                          <button type="button" disabled={saving} onClick={() => handleTogglePinned(contact)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100 transition hover:bg-amber-100 disabled:opacity-50"><Pin className="size-3" /> {contact.isPinned ? "Unpin" : "Pin"}</button>
                          <button type="button" disabled={saving} onClick={() => handleDeleteContact(contact)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 ring-1 ring-red-100 transition hover:bg-red-100 disabled:opacity-50"><Trash2 className="size-3" /> Remove</button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}

                {contacts.length === 0 && (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                    <UsersRound className="mx-auto size-9 text-amber-700" />
                    <h2 className="mt-3 text-lg font-black text-slate-950">No contacts yet</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Owners and admins can add official contacts. Members can view the room directory.</p>
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                {canManage && (
                  <form onSubmit={handleCreateContact} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Add contact</h2>
                      <Plus className="size-4 text-amber-700" />
                    </div>
                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="contact-name">Name</label>
                    <input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Property manager" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="contact-type">Type</label>
                    <select id="contact-type" value={contactType} onChange={(event) => setContactType(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100">
                      {CONTACT_TYPES.map((type) => <option key={type} value={type}>{getTypeLabel(type)}</option>)}
                    </select>

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="role-title">Role / title</label>
                    <input id="role-title" value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} maxLength={160} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Board president, front desk, vendor" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="organization">Organization</label>
                    <input id="organization" value={organization} onChange={(event) => setOrganization(event.target.value)} maxLength={160} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="HOA, school, vendor, clinic" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="email">Email</label>
                    <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="contact@example.com" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="phone">Phone</label>
                    <input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={80} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="(555) 555-5555" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="website">Website</label>
                    <input id="website" value={website} onChange={(event) => setWebsite(event.target.value)} maxLength={500} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="example.com" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="notes">Notes</label>
                    <textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={4000} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Hours, responsibilities, instructions" />

                    <label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">
                      <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="size-4 accent-amber-700" /> Pin important contact
                    </label>

                    <button type="submit" disabled={saving || !name.trim()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <CheckCircle2 className="size-4" /> Add contact
                    </button>
                  </form>
                )}

                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Directory summary</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Contacts</dt><dd className="font-black text-slate-900">{contacts.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Pinned</dt><dd className="font-black text-slate-900">{pinnedContacts.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Emergency</dt><dd className="font-black text-slate-900">{emergencyContacts.length}</dd></div>
                  </dl>
                </section>
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-950"><Building2 className="size-4 text-amber-700" /> Room operating layer</div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Use this for official room contacts, departments, property contacts, vendors, staff, and important numbers.</p>
                </section>
              </aside>
            </div>
          )}
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
