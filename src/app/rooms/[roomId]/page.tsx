"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, LifeBuoy, Lock, ShieldAlert } from "lucide-react";

export default function RoomWorkspaceUnavailablePage() {
  return (
    <main className="rooms-v2-page rooms-v2-room-unavailable-page">
      <div className="rooms-v2-shell rooms-v2-unavailable-shell">
        <Link href="/rooms" className="rooms-v2-back-button">
          <ArrowLeft aria-hidden="true" size={16} />
          Back to Rooms
        </Link>

        <section className="rooms-v2-unavailable-card">
          <span className="rooms-v2-unavailable-icon">
            <ShieldAlert aria-hidden="true" size={25} />
          </span>
          <p className="rooms-v2-eyebrow">Room access unavailable</p>
          <h1>This private room cannot be verified.</h1>
          <p>
            The current production repository does not expose a connected room record, membership,
            invitation, or role contract for this route. Loombus therefore does not render sample
            discussions, members, files, announcements, or calendar events as though access were real.
          </p>

          <div className="rooms-v2-unavailable-boundary">
            <Lock aria-hidden="true" size={18} />
            <div>
              <strong>Privacy-first failure state</strong>
              <span>When membership cannot be verified, room content remains unavailable.</span>
            </div>
          </div>

          <div className="rooms-v2-review-actions">
            <Link href="/rooms" className="rooms-v2-button rooms-v2-button-primary">
              Return to Rooms
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link href="/rooms/new" className="rooms-v2-button rooms-v2-button-quiet">
              Plan a room
            </Link>
            <Link href="/support" className="rooms-v2-button rooms-v2-button-quiet">
              <LifeBuoy aria-hidden="true" size={16} />
              Contact support
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
