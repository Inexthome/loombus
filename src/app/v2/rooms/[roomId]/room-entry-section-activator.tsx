"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus } from "lucide-react";

function replaceTextIncludes(root: HTMLElement, before: string, after: string) {
  const beforeLower = before.toLowerCase();

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    if (element.childElementCount > 0) return;
    const current = element.textContent ?? "";
    const currentLower = current.toLowerCase();

    if (currentLower.includes(beforeLower)) {
      element.textContent = current.replace(new RegExp(before, "gi"), after);
    }
  });
}

function replaceBadgeText(root: HTMLElement, before: string, after: string) {
  const beforeLower = before.toLowerCase();

  root.querySelectorAll<HTMLElement>("span,p,div").forEach((element) => {
    const normalized = (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized === beforeLower) {
      element.textContent = after;
    }
  });
}

function resolveEntrySection() {
  const direct = document.getElementById("invites") ?? document.getElementById("entry") ?? document.getElementById("members");
  if (direct) return direct;

  const headings = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,p,span"));
  const heading = headings.find((element) => {
    const text = element.textContent?.replace(/\s+/g, " ").trim().toLowerCase();
    return text === "invites" || text === "join requests" || text === "invites / join requests" || text === "members" || text === "members / roles";
  });

  return heading?.closest("section") as HTMLElement | null;
}

function applyLiveCopy(section: HTMLElement) {
  replaceBadgeText(section, "planned", "LIVE");
  replaceTextIncludes(section, "PLANNED", "LIVE");
  replaceTextIncludes(section, "Planned", "LIVE");
  replaceTextIncludes(section, "Roles, invites, access approvals, and member controls.", "Roles, invites, access approvals, join requests, and member controls are live now.");
  replaceTextIncludes(section, "Member directory, access roles, and private room controls are live now.", "Member directory, access roles, invites, join requests, and private room controls are live now.");
}

export function RoomEntrySectionActivator({ roomId }: { roomId: string }) {
  const [sectionHost, setSectionHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let activeHost: HTMLElement | null = null;

    function activate() {
      const section = resolveEntrySection();
      if (!section) return;

      section.setAttribute("data-room-entry-live", "true");
      applyLiveCopy(section);

      const existingHost = section.querySelector<HTMLElement>('[data-room-entry-section-host="true"]');
      if (existingHost) {
        activeHost = existingHost;
        setSectionHost(existingHost);
        return;
      }

      const host = document.createElement("div");
      host.setAttribute("data-room-entry-section-host", "true");
      host.className = "mt-5";

      const firstGrid = Array.from(section.children).find((child) => child instanceof HTMLElement && child.className.includes("grid"));
      if (firstGrid) {
        section.insertBefore(host, firstGrid);
      } else {
        section.appendChild(host);
      }

      activeHost = host;
      setSectionHost(host);
    }

    activate();

    const observer = new MutationObserver(() => activate());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const intervalId = window.setInterval(activate, 500);
    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 8000);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      activeHost?.remove();
      setSectionHost(null);
    };
  }, []);

  const livePanel = (
    <div className="rounded-[1.25rem] border border-amber-100 bg-amber-50/60 p-4 ring-1 ring-amber-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-amber-700 ring-1 ring-amber-100">
            <UserPlus className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Invites / Join Requests is live</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
              Use the entry center to create invites, review join requests, approve new members, reject requests, and cancel pending invites.
            </p>
          </div>
        </div>
        <Link href={`/rooms/${roomId}/invites`} className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
          Open Invites / Join Requests
        </Link>
      </div>
    </div>
  );

  if (!sectionHost) return null;
  return createPortal(livePanel, sectionHost);
}
