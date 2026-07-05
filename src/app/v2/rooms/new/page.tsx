"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, GraduationCap, Home, Lock, Send, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../v2-shell-components";

const ROOM_TEMPLATES = [
  { id: "business-team", title: "Business Team Room", type: "business", icon: Building2, description: "Private team planning, announcements, decisions, resources, tasks, and events." },
  { id: "residents", title: "Resident / Condo Room", type: "residents", icon: Home, description: "Private resident announcements, maintenance updates, questions, documents, and events." },
  { id: "customer-support", title: "Customer Support Room", type: "customer_support", icon: Store, description: "Private support questions, known issues, help articles, feature requests, and product updates." },
  { id: "classroom", title: "Classroom Room", type: "classroom", icon: GraduationCap, description: "Private class prompts, resources, assignments, moderated discussion, and events." },
];

const ROOM_PLANS = [
  { id: "free", name: "Free Room", price: "$0", status: "active", memberLimit: "10 members", selfServe: true },
  { id: "starter", name: "Room Starter", price: "$19/mo", status: "pending_checkout", memberLimit: "50 members", selfServe: true },
  { id: "pro", name: "Room Pro", price: "$49/mo", status: "pending_checkout", memberLimit: "250 members", selfServe: true },
  { id: "business", name: "Organization", price: "Custom", status: "pending_sales", memberLimit: "Multiple rooms", selfServe: false },
];

function getDefaultRoomName(templateTitle: string) {
  return templateTitle.replace(/ Room$/, "");
}

function parseInitialValue(paramName: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = new URLSearchParams(window.location.search).get(paramName);
  return value || fallback;
}

function isPaidRoomPlan(planId: string) {
  return planId === "starter" || planId === "pro";
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

export default function V2CreateRoomPage() {
  const router = useRouter();
  const initializedFromUrl = useRef(false);
  const [payload, setPayload] = useState<ShellPayload | null>(null);
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
    if (initializedFromUrl.current) return;
    initializedFromUrl.current = true;
    const initialTemplateId = parseInitialValue("template", ROOM_TEMPLATES[0].id);
    const initialPlanId = parseInitialValue("plan", ROOM_PLANS[0].id);
    const initialTemplate = ROOM_TEMPLATES.find((template) => template.id === initialTemplateId) ?? ROOM_TEMPLATES[0];
    const initialPlan = ROOM_PLANS.find((plan) => plan.id === initialPlanId) ?? ROOM_PLANS[0];
    setSelectedTemplateId(initialTemplate.id);
    setSelectedPlanId(initialPlan.selfServe ? initialPlan.id : ROOM_PLANS[0].id);
    setRoomName(getDefaultRoomName(initialTemplate.title));
    setRoomDescription(initialTemplate.description);
    if (!initialPlan.selfServe) {
      setMessage("Organization rooms require support-assisted setup. Continue with a self-serve plan here or contact support for organization setup.");
    }
  }, []);

  async function loadShell() {
    setLoading(true);
    setMessage((current) => current);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      setUserId(data.session?.user.id ?? null);
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 Rooms access. Current Loombus remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadShell();
    });
    return () => data.subscription.unsubscribe();
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

    const result = await response.json().catch(() => ({
      error: "Checkout returned an unreadable response.",
    }));

    if (!response.ok || !result.url) {
      setMessage(
        result.detail
          ? `${result.error ?? "Room created, but checkout could not start."} ${result.detail}`
          : result.error ?? "Room created, but checkout could not start."
      );
      router.push(`/rooms/${encodeURIComponent(roomId)}?room_checkout=pending`);
      return;
    }

    window.location.href = result.url;
  }

  async function handleCreateRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !roomName.trim()) return;
    if (!selectedPlan.selfServe) {
      router.push("/support?topic=organization-room");
      return;
    }
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

      const membershipResult = await supabase.from("room_members").insert({ room_id: roomId, user_id: userId, role: "owner" });
      if (membershipResult.error) throw membershipResult.error;

      const welcomePostResult = await supabase.from("room_posts").insert({
        room_id: roomId,
        author_id: userId,
        title: "Welcome to your private Loombus Room",
        body: "This room discussion is private to approved room members and does not appear on the public Loombus discussion page.",
      });
      if (welcomePostResult.error) throw welcomePostResult.error;

      if (isPaidRoomPlan(selectedPlan.id)) {
        await startRoomCheckout(roomId, selectedPlan.id);
        return;
      }

      router.push(`/rooms/${encodeURIComponent(roomId)}`);
    } catch {
      setMessage("Loombus could not create this room yet. Confirm the rooms, room_members, and room_posts tables/policies are active in Supabase.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <V2ShellGateCard title="Checking room creation access" message="Loombus is preparing the private room creation flow." loading />;
  if (message && !payload) return <V2ShellGateCard title="Room creation check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can create a private room owned by your account." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-6xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-3">
          <Link href="/create-room" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
            <ArrowLeft className="size-4" />
            Back to Create Room
          </Link>
          <Link href="/rooms" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
            Back to Rooms
          </Link>
        </div>

        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-800 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Self-serve private room</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Create a room and start privately.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">Choose a template and plan. Loombus creates a private room, adds you as owner, and opens the room discussion without posting anything to public Loombus Discussions.</p>
          </div>

          <form onSubmit={handleCreateRoom} className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">1. Choose room type</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {ROOM_TEMPLATES.map((template) => {
                    const Icon = template.icon;
                    const selected = selectedTemplateId === template.id;
                    return (
                      <button key={template.id} type="button" onClick={() => handleTemplateSelect(template)} className={`rounded-[1.25rem] border p-4 text-left transition ${selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"}`}>
                        <div className="flex items-start gap-3">
                          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-white/10 text-amber-200" : "bg-slate-100 text-slate-700"}`}><Icon className="size-5" /></span>
                          <span>
                            <span className="block text-sm font-black">{template.title}</span>
                            <span className={`mt-1 block text-xs leading-5 ${selected ? "text-slate-200" : "text-slate-500"}`}>{template.description}</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">2. Pick room plan</h2>
                <p className="mt-2 text-xs font-semibold text-slate-500">Starter and Pro open Stripe checkout after the private room is created. Free rooms open immediately. Organization rooms remain support-assisted.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {ROOM_PLANS.map((plan) => {
                    const selected = selectedPlanId === plan.id;
                    return (
                      <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} className={`rounded-[1.25rem] border p-4 text-left transition ${selected ? "border-amber-700 bg-amber-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                        <span className="flex items-start justify-between gap-3">
                          <span>
                            <span className="block text-sm font-black text-slate-950">{plan.name}</span>
                            <span className="mt-1 block text-xs font-bold text-slate-500">{plan.memberLimit}</span>
                            {isPaidRoomPlan(plan.id) && <span className="mt-2 block text-xs font-black text-emerald-700">Checkout required</span>}
                            {!plan.selfServe && <span className="mt-2 block text-xs font-black text-amber-800">Support-assisted setup</span>}
                          </span>
                          <span className="text-sm font-black text-slate-950">{plan.price}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">3. Name the room</h2>
                <div className="mt-4 space-y-3">
                  <input
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    placeholder="Room name"
                    autoComplete="off"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                  />
                  <textarea
                    value={roomDescription}
                    onChange={(event) => setRoomDescription(event.target.value)}
                    placeholder="Room description"
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <Lock className="size-5 text-amber-700" />
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Private by default</h2>
                </div>
                <ul className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />Not posted to public /discussions</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />Owner added automatically</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />Starter welcome post created</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />Invite-only member access</li>
                </ul>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Selected</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{roomName || selectedTemplate.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTemplate.title} · {selectedPlan.name}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">{selectedPlan.memberLimit}</p>
                <button type="submit" disabled={saving || !roomName.trim()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <Send className="size-4" />
                  {saving ? "Creating room..." : isPaidRoomPlan(selectedPlan.id) ? "Create room and checkout" : selectedPlan.selfServe ? "Create private room" : "Contact support"}
                </button>
              </section>
            </aside>
          </form>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
