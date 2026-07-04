"use client";

import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Home,
  Mail,
  ShieldCheck,
  Store,
} from "lucide-react";
import { V2ShellMobileNav, V2ShellTopNav } from "../v2-shell-components";
import "./create-room-appearance.css";

const ROOM_TEMPLATES = [
  {
    id: "business-team",
    title: "Business Team Room",
    eyebrow: "Teams & small businesses",
    description: "A private operating room for updates, planning, decisions, resources, and internal discussion.",
    icon: Building2,
    features: ["Private discussion feed", "Announcements", "Resources", "Tasks", "Events", "Members"],
  },
  {
    id: "residents",
    title: "Resident / Condo Room",
    eyebrow: "Condos, HOAs, neighborhoods",
    description: "A private resident space for announcements, maintenance updates, board notes, questions, and documents.",
    icon: Home,
    features: ["Resident-only posts", "Maintenance updates", "Documents", "Events", "Issue reporting", "Guidelines"],
  },
  {
    id: "customer-support",
    title: "Customer Support Room",
    eyebrow: "Customers & product support",
    description: "A controlled room for help articles, known issues, feature requests, support updates, and customer questions.",
    icon: Store,
    features: ["Questions", "Known issues", "Help articles", "Product updates", "Feature requests", "Support contacts"],
  },
  {
    id: "classroom",
    title: "Classroom Room",
    eyebrow: "Schools & learning groups",
    description: "A private class discussion space for prompts, resources, assignments, events, and guided student participation.",
    icon: GraduationCap,
    features: ["Private class discussion", "Assignments", "Resources", "Events", "Member roles", "Moderated posts"],
  },
];

const ROOM_PLANS = [
  { id: "free", name: "Free Room", price: "$0", note: "For testing", limit: "Up to 10 members", cta: "Start free setup", features: ["1 private room", "Basic posts", "Basic resources", "Loombus branding"] },
  { id: "starter", name: "Room Starter", price: "$19/mo", note: "Small groups", limit: "Up to 50 members", cta: "Continue Starter setup", features: ["Private room", "Invite links", "Announcements", "Events"] },
  { id: "pro", name: "Room Pro", price: "$49/mo", note: "Businesses & residents", limit: "Up to 250 members", cta: "Continue Pro setup", features: ["Advanced permissions", "Pinned resources", "Room analytics", "AI summaries"] },
  { id: "business", name: "Organization", price: "Custom", note: "Larger organizations", limit: "Multiple rooms", cta: "Contact for organization setup", features: ["Admin dashboard", "Custom onboarding", "Multiple moderators", "Higher limits"] },
];

function getCreateRoomHref(templateId?: string, planId?: string) {
  const params = new URLSearchParams();
  if (templateId) params.set("template", templateId);
  if (planId) params.set("plan", planId);
  const query = params.toString();
  return `/rooms/new${query ? `?${query}` : ""}`;
}

function getPlanHref(planId: string) {
  if (planId === "business") {
    return "/support?topic=organization-room";
  }
  return getCreateRoomHref(undefined, planId);
}

function TemplateCard({ template }: { template: (typeof ROOM_TEMPLATES)[number] }) {
  const Icon = template.icon;
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white"><Icon className="size-6" /></span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">{template.eyebrow}</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">{template.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{template.description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {template.features.map((feature) => <span key={feature} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{feature}</span>)}
      </div>
      <Link href={getCreateRoomHref(template.id)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800">
        Start with this template
        <ChevronRight className="size-4" />
      </Link>
    </article>
  );
}

function PlanCard({ plan }: { plan: (typeof ROOM_PLANS)[number] }) {
  const isBusiness = plan.id === "business";

  return (
    <article className={`rounded-[1.5rem] border bg-white p-5 shadow-sm ${plan.id === "pro" ? "border-amber-300 ring-4 ring-amber-100" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{plan.note}</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">{plan.name}</h3>
        </div>
        <p className="text-xl font-black text-slate-950">{plan.price}</p>
      </div>
      <p className="mt-3 text-sm font-bold text-slate-600">{plan.limit}</p>
      <ul className="mt-4 space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm font-semibold text-slate-600"><CheckCircle2 className="size-4 text-emerald-600" />{feature}</li>
        ))}
      </ul>
      <Link href={getPlanHref(plan.id)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50">
        {isBusiness && <Mail className="size-4" />}
        {plan.cta}
      </Link>
    </article>
  );
}

export default function CreateRoomPage() {
  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="createRoomAppearance mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-800 p-6 text-white sm:p-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Private Loombus Rooms</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Create a private room for your business, residents, customers, classroom, or community.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-amber-50/90 sm:text-base">
                Choose a room template, pick a plan, and start with a private discussion space that stays separate from public Loombus Discussions.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/rooms/new" className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-50">
                  Create Room
                  <ChevronRight className="size-4" />
                </Link>
                <Link href="/rooms" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white ring-1 ring-white/20 transition hover:bg-white/15">
                  View My Rooms
                </Link>
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-white/10 p-5 ring-1 ring-white/15">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-6 text-amber-200" />
                <h2 className="text-lg font-black">Privacy rule</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-50/90">Room discussions belong to the room only. They stay separate from public /discussions and are visible only to approved room members based on room permissions.</p>
              <div className="mt-5 grid gap-3 text-sm font-bold">
                <span className="rounded-2xl bg-white/10 px-4 py-3">Private discussion feed</span>
                <span className="rounded-2xl bg-white/10 px-4 py-3">Invite or approval access</span>
                <span className="rounded-2xl bg-white/10 px-4 py-3">Room resources, events, and members</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Room subscriptions</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Choose a room plan</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Room checkout is not enabled yet. These plan choices continue into setup now and will map to paid entitlements when room subscriptions are connected.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ROOM_PLANS.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Room templates</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Start from the right room type</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Templates help set the room purpose before the owner starts inviting people.</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ROOM_TEMPLATES.map((template) => <TemplateCard key={template.id} template={template} />)}
          </div>
        </section>

        <section className="mt-8 grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:grid-cols-3">
          {[
            ["1", "Choose plan", "Pick the plan that matches the room size and features."],
            ["2", "Choose setup", "Select a room template and confirm the room details."],
            ["3", "Launch room", "Create the private room, invite members, and start the room-only discussion."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-[1.5rem] bg-slate-50 p-5 ring-1 ring-slate-200">
              <span className="grid size-10 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">{step}</span>
              <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </div>
          ))}
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
