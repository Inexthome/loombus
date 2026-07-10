"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, GraduationCap, Home, Lock, Send, Store } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const ROOM_TEMPLATES = [
  { id: "business-team", title: "Business Team Room", type: "business", icon: Building2, description: "Private team planning, announcements, decisions, resources, tasks, and events." },
  { id: "residents", title: "Resident / Condo Room", type: "residents", icon: Home, description: "Private resident announcements, maintenance updates, questions, documents, and events." },
  { id: "customer-support", title: "Customer Support Room", type: "customer_support", icon: Store, description: "Private customer questions, help articles, feature requests, and updates." },
  { id: "classroom", title: "Classroom Room", type: "classroom", icon: GraduationCap, description: "Private class prompts, resources, assignments, discussion, and events." },
];

const ROOM_PLANS = [
  { id: "free", name: "Free Room", price: "$0", status: "active", memberLimit: "10 members", detail: "Small starter room" },
  { id: "starter", name: "Room Starter", price: "$19/mo", status: "pending_checkout", memberLimit: "50 members", detail: "One private room" },
  { id: "pro", name: "Room Pro", price: "$49/mo", status: "pending_checkout", memberLimit: "250 members", detail: "Larger private room" },
  { id: "organization", name: "Organization", price: "$99/mo", status: "pending_checkout", memberLimit: "Up to 3 rooms, 500 members", detail: "Organization admin controls" },
  { id: "organization_plus", name: "Organization Plus", price: "$149/mo", status: "pending_checkout", memberLimit: "Up to 10 rooms, 2,000 members", detail: "More rooms and larger membership" },
  { id: "organization_enterprise", name: "Organization Enterprise", price: "$199/mo", status: "pending_checkout", memberLimit: "Unlimited/custom rooms", detail: "Large membership and custom structure" },
];

function getDefaultRoomName(templateTitle: string) {
  return templateTitle.replace(/ Room$/, "");
}

function isPaidRoomPlan(planId: string) {
  return planId !== "free";
}

async function insertRoomWithFallback(payload: Record<string, unknown>) {
  const attempts: Record<string, unknown>[] = [
    payload,
    {
      name: payload.name,
      description: payload.description,
      type: payload.type,
      room_type: payload.type,
      visibility: "private",
      is_private: true,
      invite_only: true,
      owner_id: payload.owner_id,
      created_by: payload.created_by,
      template_key: payload.template_key,
      subscription_plan: payload.subscription_plan,
      subscription_status: payload.subscription_status,
      member_limit_label: payload.member_limit_label,
    },
    {
      name: payload.name,
      description: payload.description,
      type: payload.type,
      visibility: "private",
      is_private: true,
      owner_id: payload.owner_id,
      created_by: payload.created_by,
    },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    const { data, error } = await supabase.from("rooms").insert(attempt).select("id").single();
    if (!error && data?.id) return String(data.id);
    lastError = error;
  }
  throw lastError;
}

export default function NewRoomPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(ROOM_TEMPLATES[0].id);
  const [selectedPlanId, setSelectedPlanId] = useState(ROOM_PLANS[0].id);
  const [roomName, setRoomName] = useState(getDefaultRoomName(ROOM_TEMPLATES[0].title));
  const [roomDescription, setRoomDescription] = useState(ROOM_TEMPLATES[0].description);

  const selectedTemplate = useMemo(() => ROOM_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? ROOM_TEMPLATES[0], [selectedTemplateId]);
  const selectedPlan = useMemo(() => ROOM_PLANS.find((plan) => plan.id === selectedPlanId) ?? ROOM_PLANS[0], [selectedPlanId]);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setUserId(data.session?.user.id ?? null);
      setLoading(false);
    }

    loadSession();
    const { data } = supabase.auth.onAuthStateChange(() => loadSession());

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  function handleTemplateSelect(template: (typeof ROOM_TEMPLATES)[number]) {
    setSelectedTemplateId(template.id);
    setRoomName((currentName) => {
      const oldDefault = getDefaultRoomName(selectedTemplate.title);
      return !currentName.trim() || currentName === oldDefault ? getDefaultRoomName(template.title) : currentName;
    });
    setRoomDescription((currentDescription) => {
      return !currentDescription.trim() || currentDescription === selectedTemplate.description ? template.description : currentDescription;
    });
  }

  async function startRoomCheckout(roomId: string, planKey: string) {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      router.push(`/rooms/${encodeURIComponent(roomId)}`);
      return;
    }

    const response = await fetch("/api/rooms/create-checkout-session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ roomId, planKey }),
    });

    const result = await response.json().catch(() => ({ error: "Checkout returned an unreadable response." }));

    if (!response.ok || !result.url) {
      setMessage(result.error ?? "Room created, but checkout could not start.");
      router.push(`/rooms/${encodeURIComponent(roomId)}?room_checkout=pending`);
      return;
    }

    window.location.href = result.url;
  }

  async function handleCreateRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !roomName.trim()) return;
    setSaving(true);
    setMessage("");

    try {
      const roomId = await insertRoomWithFallback({
        name: roomName.trim(),
        description: roomDescription.trim() || selectedTemplate.description,
        type: selectedTemplate.type,
        room_type: selectedTemplate.type,
        template_key: selectedTemplate.id,
        visibility: "private",
        is_private: true,
        invite_only: true,
        owner_id: userId,
        created_by: userId,
        subscription_plan: selectedPlan.id,
        subscription_status: selectedPlan.status,
        member_limit_label: selectedPlan.memberLimit,
      });

      await supabase.from("room_members").insert({ room_id: roomId, user_id: userId, role: "owner" });
      await supabase.from("room_posts").insert({
        room_id: roomId,
        author_id: userId,
        title: "Welcome to your private Loombus Room",
        body: "This room discussion is private to approved room members and does not appear on the public Loombus discussion page.",
      });

      if (isPaidRoomPlan(selectedPlan.id)) {
        await startRoomCheckout(roomId, selectedPlan.id);
        return;
      }

      router.push(`/rooms/${encodeURIComponent(roomId)}`);
    } catch {
      setMessage("Loombus could not create this room yet. Confirm the room tables and policies are active in Supabase.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[var(--loombus-page-bg)] p-6 text-[var(--loombus-text)]">Preparing room creation...</main>;
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">Private Rooms</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Log in to create a room.</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--loombus-text-muted)]">Rooms are owned by your account and stay separate from public discussions.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-black text-[var(--loombus-primary-text)]">Log in</Link>
            <Link href="/rooms" className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]">Back to Rooms</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap gap-3">
          <Link href="/rooms" className="inline-flex rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]">← Back to Rooms</Link>
        </div>

        {message && <p className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-700">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-xl shadow-black/5">
          <div className="grid gap-8 border-b border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">Private Loombus Rooms</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">Create a private room.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">Choose a room template, pick a plan, and start with a private discussion space separated from public Loombus Discussions.</p>
            </div>
            <aside className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <div className="flex items-center gap-3"><Lock className="h-5 w-5" /><h2 className="font-black">Privacy rule</h2></div>
              <p className="mt-4 text-sm leading-7 text-[var(--loombus-text-muted)]">Room discussions belong to the room only and are visible based on room membership.</p>
            </aside>
          </div>

          <form onSubmit={handleCreateRoom} className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">1. Choose room type</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {ROOM_TEMPLATES.map((template) => {
                    const Icon = template.icon;
                    const selected = selectedTemplateId === template.id;
                    return (
                      <button key={template.id} type="button" onClick={() => handleTemplateSelect(template)} className={`rounded-[1.25rem] border p-4 text-left transition ${selected ? "border-[var(--loombus-text)] bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]" : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] hover:bg-[var(--loombus-surface-muted)]"}`}>
                        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--loombus-surface-muted)] text-[var(--loombus-text)] ring-1 ring-[var(--loombus-border)]"><Icon className="h-5 w-5" /></span><span><span className="block text-sm font-black">{template.title}</span><span className="mt-1 block text-xs leading-5 opacity-80">{template.description}</span></span></div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">2. Pick room plan</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {ROOM_PLANS.map((plan) => {
                    const selected = selectedPlanId === plan.id;
                    return <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} className={`rounded-[1.25rem] border p-4 text-left transition ${selected ? "border-[var(--loombus-text)] bg-[var(--loombus-surface-muted)]" : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] hover:bg-[var(--loombus-surface-muted)]"}`}><span className="flex items-start justify-between gap-3"><span><span className="block text-sm font-black">{plan.name}</span><span className="mt-1 block text-xs font-bold text-[var(--loombus-text-muted)]">{plan.memberLimit}</span><span className="mt-1 block text-xs leading-5 text-[var(--loombus-text-muted)]">{plan.detail}</span>{isPaidRoomPlan(plan.id) && <span className="mt-2 block text-xs font-black text-emerald-600">Checkout required</span>}</span><span className="text-sm font-black">{plan.price}</span></span></button>;
                  })}
                </div>
              </section>

              <section>
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">3. Name the room</h2>
                <div className="mt-4 space-y-3">
                  <input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Room name" autoComplete="off" className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm font-bold text-[var(--loombus-text)] outline-none" />
                  <textarea value={roomDescription} onChange={(event) => setRoomDescription(event.target.value)} placeholder="Room description" rows={4} className="w-full resize-none rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm leading-6 text-[var(--loombus-text)] outline-none" />
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-5">
                <div className="flex items-center gap-3"><Lock className="h-5 w-5" /><h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Private by default</h2></div>
                <ul className="mt-4 space-y-3 text-sm font-semibold text-[var(--loombus-text-muted)]">
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Not posted to public /discussions</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Owner added automatically</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Starter welcome post created</li>
                </ul>
              </section>

              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Selected</p>
                <h3 className="mt-2 text-xl font-black">{roomName || selectedTemplate.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{selectedTemplate.title} · {selectedPlan.name}</p>
                <p className="mt-1 text-sm font-bold text-[var(--loombus-text-subtle)]">{selectedPlan.memberLimit}</p>
                <button type="submit" disabled={saving || !roomName.trim()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-black text-[var(--loombus-primary-text)] transition disabled:cursor-not-allowed disabled:opacity-50">
                  <Send className="h-4 w-4" />
                  {saving ? "Creating room..." : isPaidRoomPlan(selectedPlan.id) ? "Create room and checkout" : "Create private room"}
                </button>
              </section>
            </aside>
          </form>
        </section>
      </section>
    </main>
  );
}
