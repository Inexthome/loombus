"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  GraduationCap,
  Home,
  Lock,
  Send,
  Store,
} from "lucide-react";

const roomTypes = [
  {
    id: "business-team",
    title: "Business Team Room",
    shortTitle: "Business Team",
    description: "Private team planning, announcements, decisions, resources, tasks, and events.",
    icon: Building2,
  },
  {
    id: "residents",
    title: "Resident / Condo Room",
    shortTitle: "Resident / Condo",
    description: "Private resident announcements, maintenance updates, questions, documents, and events.",
    icon: Home,
  },
  {
    id: "customer-support",
    title: "Customer Support Room",
    shortTitle: "Customer Support",
    description: "Private support questions, known issues, help articles, feature requests, and product updates.",
    icon: Store,
  },
  {
    id: "classroom",
    title: "Classroom Room",
    shortTitle: "Classroom",
    description: "Private class prompts, resources, assignments, moderated discussion, and events.",
    icon: GraduationCap,
  },
] as const;

const roomPlans = [
  { id: "free", name: "Free Room", price: "$0", members: "10 members", detail: "Small private starter space", paid: false },
  { id: "starter", name: "Room Starter", price: "$19/mo", members: "50 members", detail: "One private room", paid: true },
  { id: "pro", name: "Room Pro", price: "$49/mo", members: "250 members", detail: "Larger private room", paid: true },
  { id: "organization", name: "Organization", price: "$99/mo", members: "Up to 3 rooms, 500 members", detail: "Organization admin controls and setup support", paid: true },
  { id: "organization-plus", name: "Organization Plus", price: "$149/mo", members: "Up to 10 rooms, 2,000 members", detail: "More rooms, larger membership, and advanced setup", paid: true },
  { id: "enterprise", name: "Organization Enterprise", price: "$199/mo", members: "Unlimited/custom rooms, large membership", detail: "Dedicated support and custom organization structure", paid: true },
] as const;

const customAddOns = [
  "More members",
  "More rooms",
  "White-label branding",
  "Priority support",
  "Data/export tools",
  "Custom onboarding",
];

export default function NewRoomPage() {
  const [selectedTypeId, setSelectedTypeId] = useState<(typeof roomTypes)[number]["id"]>("business-team");
  const [selectedPlanId, setSelectedPlanId] = useState<(typeof roomPlans)[number]["id"]>("free");
  const [roomName, setRoomName] = useState("Business Team");
  const [description, setDescription] = useState(roomTypes[0].description);

  const selectedType = useMemo(
    () => roomTypes.find((roomType) => roomType.id === selectedTypeId) ?? roomTypes[0],
    [selectedTypeId],
  );
  const selectedPlan = useMemo(
    () => roomPlans.find((plan) => plan.id === selectedPlanId) ?? roomPlans[0],
    [selectedPlanId],
  );

  function chooseRoomType(roomType: (typeof roomTypes)[number]) {
    setSelectedTypeId(roomType.id);
    setRoomName(roomType.shortTitle);
    setDescription(roomType.description);
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Rooms
        </Link>

        <section className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <section>
              <h1 className="text-sm font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">
                1. Choose room type
              </h1>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {roomTypes.map((roomType) => {
                  const Icon = roomType.icon;
                  const selected = roomType.id === selectedTypeId;
                  return (
                    <button
                      key={roomType.id}
                      type="button"
                      onClick={() => chooseRoomType(roomType)}
                      className={`rounded-[1.5rem] border p-5 text-left shadow-xl shadow-black/5 transition hover:-translate-y-0.5 ${
                        selected
                          ? "border-amber-600 bg-amber-50/70 dark:bg-amber-500/10"
                          : "border-[var(--loombus-border)] bg-[var(--loombus-surface)]"
                      }`}
                    >
                      <span className="flex items-start gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-surface-muted)] ring-1 ring-[var(--loombus-border)]">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-base font-black">{roomType.title}</span>
                          <span className="mt-2 block text-sm leading-6 text-[var(--loombus-text-muted)]">
                            {roomType.description}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">
                2. Pick room plan
              </h2>
              <p className="mt-2 text-sm font-semibold text-[var(--loombus-text-muted)]">
                Free rooms open immediately. Paid plans open Stripe checkout after the private room is created.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {roomPlans.map((plan) => {
                  const selected = plan.id === selectedPlanId;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`rounded-[1.5rem] border p-5 text-left shadow-xl shadow-black/5 transition hover:-translate-y-0.5 ${
                        selected
                          ? "border-amber-600 bg-amber-50/70 dark:bg-amber-500/10"
                          : "border-[var(--loombus-border)] bg-[var(--loombus-surface)]"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-4">
                        <span>
                          <span className="block text-base font-black">{plan.name}</span>
                          <span className="mt-2 block text-sm font-bold text-[var(--loombus-text-muted)]">{plan.members}</span>
                          <span className="mt-2 block text-sm leading-6 text-[var(--loombus-text-muted)]">{plan.detail}</span>
                          {plan.paid && <span className="mt-3 block text-sm font-black text-emerald-600">Checkout required</span>}
                        </span>
                        <span className="shrink-0 text-base font-black">{plan.price}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">
                3. Name the room
              </h2>
              <div className="mt-4 space-y-4">
                <input
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  aria-label="Room name"
                  className="w-full rounded-[1.25rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-5 py-4 text-base font-bold outline-none shadow-xl shadow-black/5"
                />
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  aria-label="Room description"
                  rows={5}
                  className="w-full resize-none rounded-[1.25rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-5 py-4 text-base leading-7 outline-none shadow-xl shadow-black/5"
                />
              </div>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-amber-700 dark:text-amber-500" aria-hidden="true" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">Private by default</h2>
              </div>
              <div className="mt-5 space-y-4 text-sm font-bold text-[var(--loombus-text-muted)]">
                {["Not posted to public /discussions", "Owner added automatically", "Starter welcome post created", "Invite-only member access"].map((item) => (
                  <p key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    {item}
                  </p>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">Selected</p>
              <h2 className="mt-3 text-2xl font-black">{roomName || selectedType.shortTitle}</h2>
              <p className="mt-3 text-base text-[var(--loombus-text-muted)]">
                {selectedType.title} · {selectedPlan.name}
              </p>
              <p className="mt-2 text-sm font-black text-[var(--loombus-text-muted)]">{selectedPlan.members}</p>
              <Link
                href="/rooms/team-room"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-5 py-4 text-sm font-black transition hover:bg-[var(--loombus-surface-muted)]"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {selectedPlan.paid ? "Create room and checkout" : "Create private room"}
              </Link>
            </section>

            <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-500">Custom add-ons</p>
              <div className="mt-5 space-y-4 text-sm font-black text-amber-800 dark:text-amber-400">
                {customAddOns.map((item) => (
                  <p key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item}
                  </p>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
