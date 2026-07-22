"use client";

import { Eye, Link2, Palette, Sparkles, User } from "lucide-react";
import { useEffect, useState } from "react";

type ProfileSection = "overview" | "public" | "creator" | "preview";

const ITEMS: { key: ProfileSection; label: string; icon: typeof User }[] = [
  { key: "overview", label: "Overview", icon: Sparkles },
  { key: "public", label: "Public profile", icon: User },
  { key: "creator", label: "Creator tools", icon: Link2 },
  { key: "preview", label: "Preview and sharing", icon: Eye },
];

export function ProfileWorkspaceController() {
  const [active, setActive] = useState<ProfileSection>("overview");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section") as ProfileSection | null;
    if (requested && ITEMS.some((item) => item.key === requested)) setActive(requested);
  }, []);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-profile-workspace-section]").forEach((element) => {
      const section = element.dataset.profileWorkspaceSection;
      element.hidden = section !== active;
    });
    document.querySelectorAll<HTMLElement>("[data-profile-save-controls]").forEach((element) => {
      element.hidden = !["public", "creator"].includes(active);
    });
    const url = new URL(window.location.href);
    url.searchParams.set("section", active);
    window.history.replaceState({}, "", url);
  }, [active]);

  return (
    <aside className="profile-workspace-nav" aria-label="Profile sections">
      <p>Profile workspace</p>
      {ITEMS.map(({ key, label, icon: Icon }) => (
        <button key={key} type="button" className={active === key ? "is-active" : ""} onClick={() => setActive(key)}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
      <a href="/settings?section=profile"><Palette aria-hidden="true" />Profile settings</a>
    </aside>
  );
}
