"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function RoomBillingSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const sessionId = searchParams.get("session_id") ?? "";
  const [message, setMessage] = useState("Confirming the Stripe subscription and creating your private Room.");
  const [errorMessage, setErrorMessage] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function finishCheckout() {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = `/login?next=${encodeURIComponent(
          `/rooms/${roomId}/billing/success?session_id=${sessionId}`
        )}`;
        return;
      }

      if (!roomId || !sessionId) {
        setErrorMessage("The Room checkout return link is missing required details.");
        return;
      }

      try {
        const response = await fetch("/api/rooms/complete-checkout-session", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roomId, sessionId }),
        });
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };

        if (cancelled) return;

        if (!response.ok) {
          setErrorMessage(
            result.error ?? "Loombus could not activate this Room subscription yet."
          );
          return;
        }

        setComplete(true);
        setMessage("Your Room subscription is active. Opening the private workspace now.");
        window.setTimeout(() => {
          window.location.replace(`/rooms/${encodeURIComponent(roomId)}`);
        }, 900);
      } catch {
        if (!cancelled) {
          setErrorMessage("The Room checkout confirmation request could not be completed.");
        }
      }
    }

    void finishCheckout();
    return () => {
      cancelled = true;
    };
  }, [roomId, sessionId]);

  return (
    <main className="rooms-v2-page rooms-v2-builder-page">
      <div className="rooms-v2-shell rooms-v2-review-shell">
        <section className="rooms-v2-builder-hero rooms-v2-review-hero">
          <div>
            <p className="rooms-v2-eyebrow">Room checkout</p>
            <h1>{complete ? "Your private Room is ready." : "Finishing Room activation."}</h1>
            <p>{errorMessage || message}</p>
          </div>
          <span className="rooms-v2-draft-badge">
            {complete ? (
              <CheckCircle2 aria-hidden="true" size={16} />
            ) : (
              <Loader2 aria-hidden="true" size={16} className="is-spinning" />
            )}
            {complete ? "Subscription active" : "Verifying securely"}
          </span>
        </section>

        <section className="rooms-v2-boundary-review">
          <div>
            <span><ShieldCheck aria-hidden="true" size={22} /></span>
            <div>
              <p className="rooms-v2-eyebrow">Private provisioning</p>
              <h2>Payment and ownership must match before the Room is created.</h2>
            </div>
          </div>
          <div className="rooms-v2-boundary-review-list">
            <p><CheckCircle2 aria-hidden="true" size={16} />Stripe session verified server-side</p>
            <p><CheckCircle2 aria-hidden="true" size={16} />Room owner matched to the signed-in account</p>
            <p><CheckCircle2 aria-hidden="true" size={16} />Private membership boundary preserved</p>
          </div>
        </section>

        <div className="rooms-v2-review-actions">
          {roomId ? (
            <Link href={`/rooms/${encodeURIComponent(roomId)}`} className="rooms-v2-button rooms-v2-button-primary">
              Open Room
            </Link>
          ) : null}
          <Link href="/rooms" className="rooms-v2-button rooms-v2-button-quiet">
            Back to Rooms
          </Link>
          {errorMessage ? (
            <Link href="/support" className="rooms-v2-button rooms-v2-button-quiet">
              Contact support
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
