"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";

type RoomType = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
};

type RoomPlan = {
  id: string;
  name: string;
  price: string;
  members: string;
  detail: string;
};

const roomTypes: RoomType[] = [
  { id: "business-team", title: "Business Team Room", shortTitle: "Business Team", description: "Private team planning, decisions, resources, tasks, announcements, and events." },
  { id: "residents", title: "Resident / Condo Room", shortTitle: "Resident / Condo", description: "Private resident notices, maintenance updates, documents, questions, and events." },
  { id: "customer-support", title: "Customer Support Room", shortTitle: "Customer Support", description: "Private support questions, known issues, help resources, requests, and product updates." },
  { id: "classroom", title: "Classroom Room", shortTitle: "Classroom", description: "Private class prompts, resources, assignments, moderated discussion, and events." },
];

const roomPlans: RoomPlan[] = [
  { id: "free", name: "Free Room", price: "$0", members: "10 members", detail: "Small private starter space" },
  { id: "starter", name: "Room Starter", price: "$19/mo", members: "50 members", detail: "One private room" },
  { id: "pro", name: "Room Pro", price: "$49/mo", members: "250 members", detail: "Larger private room" },
  { id: "organization", name: "Organization", price: "$99/mo", members: "Up to 3 rooms · 500 members", detail: "Organization controls and setup support" },
  { id: "organization-plus", name: "Organization Plus", price: "$149/mo", members: "Up to 10 rooms · 2,000 members", detail: "More rooms, larger membership, and advanced setup" },
  { id: "enterprise", name: "Organization Enterprise", price: "$199/mo", members: "Custom rooms · Large membership", detail: "Dedicated support and custom organization structure" },
];

const privateDefaults = [
  "Not posted to public Discussions",
  "Owner added automatically",
  "Starter welcome post prepared",
  "Invite-only member access",
];

export default function NewRoomPage() {
  const [selectedTypeId, setSelectedTypeId] = useState("business-team");
  const [selectedPlanId, setSelectedPlanId] = useState("free");
  const [roomName, setRoomName] = useState("Business Team");
  const [description, setDescription] = useState(roomTypes[0].description);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const selectedType = roomTypes.find((roomType) => roomType.id === selectedTypeId) ?? roomTypes[0];
  const selectedPlan = roomPlans.find((plan) => plan.id === selectedPlanId) ?? roomPlans[0];
  const trimmedName = roomName.trim();
  const trimmedDescription = description.trim();
  const nameIsValid = trimmedName.length >= 3;
  const descriptionIsValid = trimmedDescription.length >= 10;
  const formIsValid = nameIsValid && descriptionIsValid;

  function selectRoomType(roomType: RoomType) {
    setSelectedTypeId(roomType.id);
    setRoomName(roomType.shortTitle);
    setDescription(roomType.description);
    setShowErrors(false);
  }

  function continueToReview() {
    if (!formIsValid) {
      setShowErrors(true);
      return;
    }

    setShowErrors(false);
    setIsReviewing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (isReviewing) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => setIsReviewing(false)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Edit room setup
          </button>

          <header className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700 dark:text-amber-500">Review room</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Confirm your room setup</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">
              Review the details carried forward from the builder. Nothing is created or charged in this step.
            </p>
          </header>

          <section className="mt-8 grid gap-5 md:grid-cols-2">
            <article className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 md:col-span-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Room identity</p>
              <h2 className="mt-3 text-3xl font-black">{trimmedName}</h2>
              <p className="mt-4 leading-7 text-[var(--loombus-text-muted)]">{trimmedDescription}</p>
            </article>

            <article className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Room type</p>
              <h2 className="mt-3 text-xl font-black">{selectedType.title}</h2>
            </article>

            <article className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Plan</p>
              <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{selectedPlan.name}</h2>
                  <p className="mt-2 text-sm font-bold text-[var(--loombus-text-muted)]">{selectedPlan.members}</p>
                </div>
                <span className="font-black">{selectedPlan.price}</span>
              </div>
            </article>
          </section>

          <section className="mt-5 rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-amber-700 dark:text-amber-500" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Private by default</h2>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {privateDefaults.map((item) => (
                <p key={item} className="flex items-start gap-3 text-sm font-bold text-[var(--loombus-text-muted)]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  {item}
                </p>
              ))}
            </div>
          </section>

          <button
            type="button"
            disabled
            className="mt-6 inline-flex w-full cursor-not-allowed items-center justify-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-5 py-4 text-sm font-black text-[var(--loombus-text-subtle)]"
          >
            Room creation coming next
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-[var(--loombus-text-subtle)]">
            No room, subscription, checkout, or database record is created in this PR.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <Link href="/rooms" className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Rooms
        </Link>

        <header className="mt-6">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700 dark:text-amber-500">Room subscriptions</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Create a private room</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">
            Choose the room purpose, select a plan, define the room identity, and continue to review.
          </p>
        </header>

        <section className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">1. Choose room type</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {roomTypes.map((roomType) => {
                  const selected = roomType.id === selectedTypeId;
                  return (
                    <button key={roomType.id} type="button" onClick={() => selectRoomType(roomType)} aria-pressed={selected} className={`rounded-[1.5rem] border p-5 text-left shadow-xl shadow-black/5 transition ${selected ? "border-amber-600 bg-amber-50/70 dark:bg-amber-500/10" : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] hover:bg-[var(--loombus-surface-muted)]"}`}>
                      <span className="block text-base font-black">{roomType.title}</span>
                      <span className="mt-2 block text-sm leading-6 text-[var(--loombus-text-muted)]">{roomType.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">2. Pick room plan</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {roomPlans.map((plan) => {
                  const selected = plan.id === selectedPlanId;
                  return (
                    <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} aria-pressed={selected} className={`rounded-[1.5rem] border p-5 text-left shadow-xl shadow-black/5 transition ${selected ? "border-amber-600 bg-amber-50/70 dark:bg-amber-500/10" : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] hover:bg-[var(--loombus-surface-muted)]"}`}>
                      <span className="flex items-start justify-between gap-4">
                        <span>
                          <span className="block text-base font-black">{plan.name}</span>
                          <span className="mt-2 block text-sm font-bold text-[var(--loombus-text-muted)]">{plan.members}</span>
                          <span className="mt-2 block text-sm leading-6 text-[var(--loombus-text-muted)]">{plan.detail}</span>
                        </span>
                        <span className="shrink-0 text-base font-black">{plan.price}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">3. Name the room</h2>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="sr-only">Room name</span>
                  <input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Room name" aria-invalid={showErrors && !nameIsValid} className="w-full rounded-[1.25rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-5 py-4 text-base font-bold outline-none shadow-xl shadow-black/5" />
                  {showErrors && !nameIsValid && <span className="mt-2 block text-sm font-bold text-red-600">Enter a room name with at least 3 characters.</span>}
                </label>
                <label className="block">
                  <span className="sr-only">Room description</span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="What is this room for?" aria-invalid={showErrors && !descriptionIsValid} className="w-full resize-none rounded-[1.25rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-5 py-4 text-base leading-7 outline-none shadow-xl shadow-black/5" />
                  {showErrors && !descriptionIsValid && <span className="mt-2 block text-sm font-bold text-red-600">Enter a description with at least 10 characters.</span>}
                </label>
              </div>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-amber-700 dark:text-amber-500" aria-hidden="true" />
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Private by default</h2>
              </div>
              <div className="mt-5 space-y-4">
                {privateDefaults.map((item) => (
                  <p key={item} className="flex items-start gap-3 text-sm font-bold text-[var(--loombus-text-muted)]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    {item}
                  </p>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Selected</p>
              <h2 className="mt-3 text-2xl font-black">{roomName || selectedType.shortTitle}</h2>
              <p className="mt-3 text-base text-[var(--loombus-text-muted)]">{selectedType.title} · {selectedPlan.name}</p>
              <p className="mt-2 text-sm font-black text-[var(--loombus-text-muted)]">{selectedPlan.members}</p>
              <button type="button" onClick={continueToReview} className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--loombus-primary-bg)] px-5 py-4 text-sm font-black text-[var(--loombus-primary-text)] transition hover:opacity-90">
                Continue to review
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-[var(--loombus-text-subtle)]">This only opens a review step. No room or checkout is created.</p>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
