"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, LockKeyhole, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type BillingLockState = {
  loaded: boolean;
  name: string;
  plan: string;
  status: string;
  isOwner: boolean;
};

const PAID_ROOM_PLANS = new Set(["starter", "pro", "organization", "organization_plus", "organization_enterprise"]);
const ACTIVE_ROOM_STATUSES = new Set(["active"]);

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlan(value: unknown) {
  return asString(value).toLowerCase() || "free";
}

function normalizeStatus(value: unknown) {
  return asString(value).toLowerCase() || "pending_checkout";
}

function getPlanName(planKey: string) {
  const labels: Record<string, string> = {
    free: "Free Room",
    starter: "Room Starter",
    pro: "Room Pro",
    organization: "Organization",
    organization_plus: "Organization Plus",
    organization_enterprise: "Organization Enterprise",
  };

  return labels[planKey] ?? planKey.replace(/_/g, " ");
}

function shouldLockRoom(plan: string, status: string) {
  return PAID_ROOM_PLANS.has(plan) && !ACTIVE_ROOM_STATUSES.has(status);
}

export function RoomBillingLockEnforcer({ roomId }: { roomId: string }) {
  const [billing, setBilling] = useState<BillingLockState>({ loaded: false, name: "", plan: "free", status: "active", isOwner: false });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [message, setMessage] = useState("");

  const locked = useMemo(() => shouldLockRoom(billing.plan, billing.status), [billing.plan, billing.status]);
  const planLabel = getPlanName(billing.plan);

  useEffect(() => {
    let cancelled = false;

    async function loadBillingState() {
      if (!roomId) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? "";

      if (!userId) {
        if (!cancelled) {
          setBilling((current) => ({ ...current, loaded: true }));
        }
        return;
      }

      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("name,subscription_plan,subscription_status,owner_id,created_by")
        .eq("id", roomId)
        .maybeSingle();

      if (roomError || !roomData) {
        if (!cancelled) {
          setBilling((current) => ({ ...current, loaded: true }));
        }
        return;
      }

      const room = roomData as Row;
      const { data: membershipData } = await supabase
        .from("room_members")
        .select("role")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle();

      const membership = (membershipData ?? {}) as Row;
      const isOwner = asString(room.owner_id) === userId || asString(room.created_by) === userId || asString(membership.role).toLowerCase() === "owner";

      if (!cancelled) {
        setBilling({
          loaded: true,
          name: asString(room.name) || "this room",
          plan: normalizePlan(room.subscription_plan),
          status: normalizeStatus(room.subscription_status),
          isOwner,
        });
      }
    }

    void loadBillingState();

    const channel = supabase
      .channel(`room-billing-lock-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, loadBillingState)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  async function resumeCheckout() {
    if (!billing.isOwner || !PAID_ROOM_PLANS.has(billing.plan)) return;

    setCheckoutLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setMessage("Sign in again to resume room checkout.");
        return;
      }

      const response = await fetch("/api/rooms/create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomId, planKey: billing.plan }),
      });

      const result = (await response.json().catch(() => ({}))) as { url?: string; error?: string; detail?: string };

      if (!response.ok || !result.url) {
        setMessage(result.error || result.detail || "Loombus could not restart room checkout yet.");
        return;
      }

      window.location.assign(result.url);
    } catch {
      setMessage("Loombus could not restart room checkout yet.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (!billing.loaded || !locked) return null;

  return (
    <div className="fixed inset-0 z-[140] grid min-h-screen place-items-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <section className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 text-center text-slate-950 shadow-2xl">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <LockKeyhole className="size-7" />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-amber-700">Room billing required</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight">Finish checkout to unlock this room</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          {billing.name} is on {planLabel}, but checkout is still marked as {billing.status.replace(/_/g, " ")}. Room posts, modules, members, and tools stay locked until payment is completed.
        </p>

        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-left text-sm font-bold leading-6 text-amber-900">
          Cancelled Stripe checkouts no longer leave paid rooms usable. When checkout succeeds, Loombus will set this room to active and the room will open normally.
        </div>

        {message && <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {billing.isOwner ? (
            <button
              type="button"
              onClick={resumeCheckout}
              disabled={checkoutLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checkoutLoading ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
              Resume checkout
            </button>
          ) : (
            <p className="rounded-2xl bg-slate-50 px-5 py-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200">Only the room owner can complete billing.</p>
          )}
          <Link href="/rooms" className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:text-amber-700">
            Back to Rooms
          </Link>
        </div>
      </section>
    </div>
  );
}
