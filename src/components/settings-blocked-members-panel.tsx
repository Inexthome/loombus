"use client";

import { Search, ShieldOff, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type Item = { blockId: string; blockedAt: string; profile: { id: string; full_name: string | null; username: string | null; avatar_url: string | null; bio: string | null }; profileAvailable: boolean };

export function SettingsBlockedMembersPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return window.location.replace("/login?next=%2Fsettings");
    const response = await fetch("/api/blocks", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(result.error ?? "Unable to load blocked members.");
    else setItems(Array.isArray(result.items) ? result.items : []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => [item.profile.full_name, item.profile.username, item.profile.bio].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [items, query]);

  async function unblock(item: Item) {
    if (workingId) return;
    if (!window.confirm(`Unblock ${getProfileDisplayName(item.profile, "this member")}?`)) return;
    setWorkingId(item.profile.id);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return window.location.replace("/login?next=%2Fsettings");
      const response = await fetch("/api/blocks/toggle", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: item.profile.id, desiredState: false }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.blocked) throw new Error(result.error ?? "Unable to unblock this member.");
      setItems((current) => current.filter((entry) => entry.profile.id !== item.profile.id));
      setMessage(`${getProfileDisplayName(item.profile, "The member")} was unblocked.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to unblock this member.");
    } finally {
      setWorkingId(null);
    }
  }

  if (loading) return <div className="settings-v2-section-note">Loading your private block list…</div>;

  return (
    <div className="settings-blocked-panel">
      {message ? <div className="settings-v2-notice">{message}</div> : null}
      <label className="settings-blocked-search"><Search aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search blocked members" /></label>
      {visible.length ? <div className="settings-blocked-list">{visible.map((item) => <article key={item.blockId}>
        <ProfileAvatar profile={item.profile} size="md" />
        <div><strong>{getProfileDisplayName(item.profile, "Unavailable member")}</strong><span>{item.profile.username ? `@${item.profile.username}` : "Profile unavailable"}</span></div>
        <button type="button" disabled={workingId === item.profile.id} onClick={() => void unblock(item)}><UserRoundCheck aria-hidden="true" /> {workingId === item.profile.id ? "Unblocking…" : "Unblock"}</button>
      </article>)}</div> : <div className="settings-blocked-empty"><ShieldOff aria-hidden="true" /><strong>{items.length ? "No matching blocked members" : "No blocked members"}</strong><span>Your block list is private to your account.</span></div>}
    </div>
  );
}
