"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, LockKeyhole, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type JoinResult = {
  ok?: boolean;
  roomId?: string;
  alreadyMember?: boolean;
  pendingApproval?: boolean;
  error?: string;
};

export default function JoinRoomPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<"loading" | "success" | "pending" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("Verifying your private Room invitation…");
  const [roomId, setRoomId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function redeem() {
      if (!token) {
        setState("error");
        setMessage("This Room invitation link is incomplete.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        window.location.href = `/login?next=${encodeURIComponent(
          `/rooms/join?token=${token}`
        )}`;
        return;
      }

      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json().catch(() => ({}))) as JoinResult;
      if (cancelled) return;

      if (!response.ok || !result.roomId) {
        setState("error");
        setMessage(result.error ?? "This Room invitation could not be accepted.");
        return;
      }

      setRoomId(result.roomId);
      if (result.pendingApproval) {
        setState("pending");
        setMessage("Your join request was sent to the Room administrators.");
        return;
      }

      setState("success");
      setMessage(
        result.alreadyMember
          ? "You already have access to this private Room."
          : "Your private Room membership is active."
      );
      window.setTimeout(() => {
        window.location.assign(`/rooms/${encodeURIComponent(result.roomId ?? "")}`);
      }, 900);
    }

    void redeem();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const Icon =
    state === "loading"
      ? Loader2
      : state === "error"
        ? XCircle
        : state === "pending"
          ? LockKeyhole
          : CheckCircle2;

  return (
    <main className="rooms-live-page">
      <div className="rooms-live-shell rooms-live-access-shell">
        <section className="rooms-live-access-card">
          <span className="rooms-live-access-icon">
            <Icon aria-hidden="true" className={state === "loading" ? "is-spinning" : undefined} />
          </span>
          <p className="rooms-live-eyebrow">Private Room Invitation</p>
          <h1>
            {state === "loading"
              ? "Checking invitation"
              : state === "error"
                ? "Invitation unavailable"
                : state === "pending"
                  ? "Approval required"
                  : "Invitation accepted"}
          </h1>
          <p>{message}</p>
          {state === "success" && roomId ? (
            <Link href={`/rooms/${encodeURIComponent(roomId)}`} className="rooms-live-primary-action">
              Open Room
            </Link>
          ) : null}
          {state === "pending" || state === "error" ? (
            <Link href="/rooms" className="rooms-live-secondary-action">
              Back to Rooms
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
