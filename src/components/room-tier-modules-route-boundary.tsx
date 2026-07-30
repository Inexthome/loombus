"use client";

import { RoomTierModulesWorkspace } from "@/components/room-tier-modules-workspace";

/**
 * The capability-driven left rail launches the authorized tier workspace from every
 * active Room route, including the default Discussions screen.
 */
export function RoomTierModulesRouteBoundary() {
  return <RoomTierModulesWorkspace />;
}
