"use client";

import { Eye, Link2, Sparkles, User, Users, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { CreatorHubPhaseOne } from "@/components/creator-hub-phase-one";
import { CreatorPaidSupporterManager } from "@/components/creator-paid-supporter-manager";
import { CreatorSupporterProgramManagerPhase2 } from "@/components/creator-supporter-program-manager-phase2";
import { ProfileViewersPanel } from "@/components/profile-viewers-panel";
import "@/components/creator-hub-phase-one.css";

type Section = "overview" | "public" | "creator" | "viewers" | "preview";

const sections = [
  { key: "overview" as const, label: "Overview", Icon: Sparkles },
  { key: "public" as const, label: "Public profile", Icon: User },
  { key: "creator" as const, label: "Creator Hub", Icon: Wrench },
  { key: "viewers" as const, label: "Profile viewers", Icon: Users },
  { key: "preview" as const, label: "Preview and sharing", Icon: Eye },
];

export function ProfileWorkspaceController() {
  const [active, setActive] = useState<Section>("overview");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("section") as Section | null;
    if (requested && sections.some((section) => section.key === requested)) {
      setActive(requested);
    }
  }, []);

  useEffect(() => {
    const content = document.querySelector<HTMLElement>(".profile-workspace-content");
    if (!content) return;

    content.dataset.profileSection = active;

    const directSections = [
      ...content.querySelectorAll<HTMLElement>(":scope > section"),
    ];
    const publicLink = directSections[0] ?? null;
    const form = content.querySelector<HTMLFormElement>("form");
    const preview = content.querySelector<HTMLElement>("aside");
    const grid = form?.parentElement ?? null;
    const formSections = form
      ? [...form.querySelectorAll<HTMLElement>(":scope > section")]
      : [];
    const completion =
      formSections.find((section) =>
        section.textContent?.includes("Profile completion")
      ) ?? null;
    const publicProfile =
      formSections.find((section) =>
        section.textContent?.includes("Public profile")
      ) ?? null;
    const formFooterControls = form
      ? [
          ...form.querySelectorAll<HTMLElement>(
            ":scope > button, :scope > p"
          ),
        ]
      : [];

    const standaloneSection = active === "creator" || active === "viewers";
    content.style.display = standaloneSection ? "none" : "";

    if (publicLink) {
      publicLink.style.display =
        active === "overview" || active === "preview" ? "" : "none";
    }

    formSections.forEach((section) => {
      section.style.display = "none";
    });

    if (completion && active === "overview") completion.style.display = "";
    if (publicProfile && active === "public") publicProfile.style.display = "";

    if (form) {
      form.style.display = active === "preview" ? "none" : "";
    }

    formFooterControls.forEach((control) => {
      control.style.display = active === "public" ? "" : "none";
    });

    if (preview) preview.style.display = active === "preview" ? "" : "none";
    if (grid) grid.classList.toggle("is-preview-only", active === "preview");

    const url = new URL(window.location.href);
    url.searchParams.set("section", active);
    window.history.replaceState({}, "", url);
  }, [active]);

  return (
    <>
      <nav className="profile-workspace-nav" aria-label="Profile sections">
        <p>Profile workspace</p>
        {sections.map(({ key, label, Icon }) => (
          <button
            type="button"
            key={key}
            className={active === key ? "is-active" : ""}
            aria-current={active === key ? "page" : undefined}
            onClick={() => setActive(key)}
          >
            <Icon aria-hidden="true" /> {label}
          </button>
        ))}
        <a href="/settings?section=profile">
          <Link2 aria-hidden="true" /> Profile settings
        </a>
      </nav>
      {active === "creator" ? (
        <div className="grid min-w-0 gap-4">
          <CreatorHubPhaseOne />
          <CreatorSupporterProgramManagerPhase2 />
          <CreatorPaidSupporterManager />
        </div>
      ) : null}
      {active === "viewers" ? (
        <div className="profile-workspace-standalone-section min-w-0">
          <ProfileViewersPanel />
        </div>
      ) : null}
    </>
  );
}
