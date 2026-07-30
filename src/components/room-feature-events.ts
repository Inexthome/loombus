import type { RoomModuleKey } from "@/lib/room-plan-entitlements";

export const ROOM_OPEN_FEATURE_EVENT = "loombus:room-open-feature";
export const ROOM_FEATURE_CLOSED_EVENT = "loombus:room-feature-closed";

export type RoomFeatureLaunch =
  | {
      id: string;
      kind: "module";
      moduleKey: RoomModuleKey;
      label: string;
    }
  | {
      id: string;
      kind: "foundation";
      panel: "search" | "inbox";
      label: string;
    }
  | {
      id: string;
      kind: "studio" | "organization" | "operations";
      label: string;
    };

export function launchRoomFeature(detail: RoomFeatureLaunch) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RoomFeatureLaunch>(ROOM_OPEN_FEATURE_EVENT, { detail })
  );
}
