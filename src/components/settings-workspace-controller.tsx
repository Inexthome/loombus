"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, BookOpen, Clock3, CreditCard, Database, Eye, History, Lock, Mail, MessageCircle, Shield, ShieldOff, Sparkles, Trash2, User, Users } from "lucide-react";
import { SettingsPreferencePanel } from "@/components/settings-preference-panels";
import { SettingsBlockedMembersPanel } from "@/components/settings-blocked-members-panel";

type Section = "account" | "profile" | "appearance" | "data-history" | "messages" | "notifications" | "signal" | "topics" | "privacy" | "blocked-members" | "security" | "plan" | "reference" | "account-controls";

const sections: { key: Section; label: string; group: string; Icon: typeof User }[] = [
  { key: "account", label: "Account", group: "Account", Icon: User },
  { key: "profile", label: "Profile", group: "Account", Icon: Users },
  { key: "security", label: "Security", group: "Account", Icon: Lock },
  { key: "plan", label: "Plan", group: "Account", Icon: CreditCard },
  { key: "appearance", label: "Appearance", group: "Preferences", Icon: Eye },
  { key: "messages", label: "Messages", group: "Preferences", Icon: MessageCircle },
  { key: "notifications", label: "Notifications", group: "Preferences", Icon: Bell },
  { key: "signal", label: "Signal delivery", group: "Preferences", Icon: Mail },
  { key: "topics", label: "Topic alerts", group: "Preferences", Icon: Sparkles },
  { key: "privacy", label: "Privacy", group: "Privacy and data", Icon: Shield },
  { key: "blocked-members", label: "Blocked members", group: "Privacy and data", Icon: ShieldOff },
  { key: "data-history", label: "Data and history", group: "Privacy and data", Icon: Database },
  { key: "reference", label: "Reference", group: "Support and management", Icon: BookOpen },
  { key: "account-controls", label: "Account controls", group: "Support and management", Icon: Trash2 },
];

const existingIds = new Set(["appearance", "topics", "privacy", "security", "plan", "reference", "account-controls"]);

function Card({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="settings-v2-card settings-workspace-generated"><div className="settings-v2-card-header"><div><p className="settings-v2-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div></div>{children}</section>;
}

export function SettingsWorkspaceController() {
  const [active, setActive] = useState<Section>("account");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("section") as Section | null;
    if (requested && sections.some((section) => section.key === requested)) setActive(requested);
  }, []);

  useEffect(() => {
    const oldNav = document.querySelector<HTMLElement>(".settings-v2-nav");
    if (oldNav) oldNav.hidden = true;
    const main = document.querySelector<HTMLElement>(".settings-v2-main");
    if (!main) return;
    let slot = main.querySelector<HTMLElement>("[data-settings-workspace-slot]");
    if (!slot) {
      slot = document.createElement("div");
      slot.dataset.settingsWorkspaceSlot = "true";
      main.prepend(slot);
    }
    setPortalTarget(slot);
    return () => { slot?.remove(); if (oldNav) oldNav.hidden = false; };
  }, []);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".settings-v2-main > .settings-v2-card").forEach((card) => {
      card.style.display = card.id === active && existingIds.has(active) ? "" : "none";
    });
    const url = new URL(window.location.href);
    url.searchParams.set("section", active);
    window.history.replaceState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [active]);

  const groups = useMemo(() => [...new Set(sections.map((section) => section.group))], []);

  const generated = (() => {
    if (existingIds.has(active)) return null;
    if (active === "account") return <Card eyebrow="Private account" title="Account" description="Review account identity and open the correct workspace for account-level changes."><div className="settings-v2-resource-grid"><Link className="settings-v2-resource-link" href="/profile"><div><strong>Public identity</strong><span>Manage the profile connected to this account.</span></div></Link><Link className="settings-v2-resource-link" href="/settings?section=security"><div><strong>Sign-in and password</strong><span>Review provider, password, and account status.</span></div></Link><Link className="settings-v2-resource-link" href="/settings?section=plan"><div><strong>Subscription plan</strong><span>Review current access and premium capabilities.</span></div></Link><Link className="settings-v2-resource-link" href="/settings?section=account-controls"><div><strong>Account controls</strong><span>Deactivate or request deletion.</span></div></Link></div></Card>;
    if (active === "profile") return <Card eyebrow="Settings only" title="Profile settings" description="Profile settings summarize your public identity while the dedicated Profile workspace handles editing."><div className="settings-workspace-stack"><p className="settings-v2-card-copy">Your public name, username, bio, avatar, perspective marker, creator links, preview, and sharing tools are managed in Profile.</p><Link href="/profile" className="settings-v2-primary-action"><User aria-hidden="true" /> Open Profile workspace</Link></div></Card>;
    if (active === "messages") return <Card eyebrow="Private communication" title="Messages" description="Control message-specific delivery without duplicating conversation controls from the Messages workspace."><SettingsPreferencePanel scope="messages" /></Card>;
    if (active === "notifications") return <Card eyebrow="In-app Signal" title="Notifications" description="Choose which activity creates an item in your Signal Inbox."><SettingsPreferencePanel scope="notifications" /></Card>;
    if (active === "signal") return <Card eyebrow="Delivery channels" title="Signal delivery" description="Choose which Signal can reach your device or email outside the in-app inbox."><SettingsPreferencePanel scope="delivery" /></Card>;
    if (active === "blocked-members") return <Card eyebrow="Private boundaries" title="Blocked members" description="Review the members you blocked and restore access when appropriate."><SettingsBlockedMembersPanel /></Card>;
    if (active === "data-history") return <Card eyebrow="Account records" title="Data and history" description="Open the account-owned histories and libraries that already exist across Loombus."><div className="settings-v2-resource-grid"><Link className="settings-v2-resource-link" href="/my-activity"><div><strong>My Activity</strong><span>Combined discussions, replies, saved items, and Signal history.</span></div></Link><Link className="settings-v2-resource-link" href="/my-discussions"><div><strong>My Discussions</strong><span>Review discussions you created.</span></div></Link><Link className="settings-v2-resource-link" href="/my-replies"><div><strong>My Replies</strong><span>Review replies you posted.</span></div></Link><Link className="settings-v2-resource-link" href="/saved"><div><strong>Saved Library</strong><span>Bookmarks, folders, notes, and exports.</span></div></Link><Link className="settings-v2-resource-link" href="/reading-history"><div><strong>Reading History</strong><span>Review and clear viewed discussions where available.</span></div></Link><Link className="settings-v2-resource-link" href="/ai-usage"><div><strong>AI Usage</strong><span>Review limits, cached outputs, and recent AI activity.</span></div></Link></div><div className="settings-v2-section-note"><History aria-hidden="true" /> A full Download My Data package and login-history report are recommended as a later backend phase.</div></Card>;
    return null;
  })();

  return (
    <>
      <nav className="settings-workspace-nav" aria-label="Settings sections">
        {groups.map((group) => <div key={group} className="settings-workspace-nav-group"><p>{group}</p>{sections.filter((section) => section.group === group).map(({ key, label, Icon }) => <button type="button" key={key} className={active === key ? "is-active" : ""} aria-current={active === key ? "page" : undefined} onClick={() => setActive(key)}><Icon aria-hidden="true" /> {label}</button>)}</div>)}
      </nav>
      {portalTarget && generated ? createPortal(generated, portalTarget) : null}
    </>
  );
}
