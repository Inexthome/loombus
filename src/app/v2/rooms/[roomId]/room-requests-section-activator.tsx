"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardList } from "lucide-react";

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

function applyLiveCopy(section: HTMLElement) {
  replaceBadgeText(section, "planned", "LIVE");
  replaceTextIncludes(section, "PLANNED", "LIVE");
  replaceTextIncludes(section, "Planned", "LIVE");
  replaceTextIncludes(
    section,
    "Members will be able to submit structured requests with open, in progress, and resolved states.",
    "Members can submit structured requests with open, in progress, resolved, and closed states."
  );
  replaceTextIncludes(
    section,
    "Owners and admins can triage member questions without mixing them into normal discussions.",
    "Owners and admins can triage submitted requests without mixing them into normal discussions."
  );
  replaceTextIncludes(
    section,
    "Access requests are live now. Maintenance/help requests can use this structured area later.",
    "Maintenance, help, service, and general room requests are live now."
  );
}

function resolveRequestsSection() {
  const directSection = document.getElementById("requests");
  if (directSection) return directSection;

  const headings = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,p,span"));
  const heading = headings.find((element) => element.textContent?.trim().toLowerCase() === "requests");
  return heading?.closest("section") as HTMLElement | null;
}

export function RoomRequestsSectionActivator({ roomId }: { roomId: string }) {
  const [sectionHost, setSectionHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let activeHost: HTMLElement | null = null;

    function activate() {
      const section = resolveRequestsSection();
      if (!section) return;

      section.setAttribute("data-room-requests-live", "true");
      applyLiveCopy(section);

      const existingHost = section.querySelector<HTMLElement>('[data-room-requests-section-host="true"]');
      if (existingHost) {
        activeHost = existingHost;
        setSectionHost(existingHost);
        return;
      }

      const host = document.createElement("div");
      host.setAttribute("data-room-requests-section-host", "true");
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
            <ClipboardList className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Requests are live</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
              Use the Request Center to submit, review, and update maintenance, help, service, and general room requests.
            </p>
          </div>
        </div>
        <Link href={`/rooms/${roomId}/requests`} className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
          Open Request Center
        </Link>
      </div>
    </div>
  );

  if (!sectionHost) return null;
  return createPortal(livePanel, sectionHost);
}
