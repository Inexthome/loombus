"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function RoomBillingSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? "", [rawRoomId]);
  const sessionId = searchParams.get("session_id") ?? "";
  const [message, setMessage] = useState("Confirming room checkout...");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function completeCheckout() {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        setMessage("Sign in to finish activating this room plan.");
        return;
      }

      if (!roomId || !sessionId) {
        setMessage("Room checkout return link is missing required details.");
        return;
      }

      const response = await fetch("/api/rooms/complete-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomId, sessionId }),
      });

      const result = await response.json().catch(() => ({}));

      if (cancelled) return;

      if (!response.ok) {
        setMessage(result.error ?? "Loombus could not activate this room plan yet.");
        return;
      }

      setDone(true);
      setMessage("Room plan activated. Opening your room...");
      window.setTimeout(() => {
        window.location.replace(`/rooms/${encodeURIComponent(roomId)}`);
      }, 900);
    }

    void completeCheckout();

    return () => {
      cancelled = true;
    };
  }, [roomId, sessionId]);

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-xl flex-col justify-center">
        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">Loombus Rooms</p>
          <h1 className="text-3xl font-semibold tracking-tight">Room checkout finished.</h1>
          <p className="mt-5 leading-relaxed text-zinc-400">{message}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            {roomId && (
              <Link href={`/rooms/${encodeURIComponent(roomId)}`} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200">
                Open room
              </Link>
            )}
            {!done && (
              <Link href="/rooms" className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white">
                Back to rooms
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
