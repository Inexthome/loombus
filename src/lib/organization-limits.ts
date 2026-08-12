import type { SubscriptionPlanId } from "@/lib/subscription-entitlements";

export type OrganizationLimits = {
  saves: number | null;
  folders: number | null;
  privateNotes: number | null;
  stickies: number | null;
};

/**
 * Free organization limits implement the public "Limited" subscription rows.
 * Paid plans intentionally use null to represent no product-level count cap.
 */
export const ORGANIZATION_LIMITS = {
  free: {
    saves: 25,
    folders: 3,
    privateNotes: 10,
    stickies: 10,
  },
  premium: {
    saves: null,
    folders: null,
    privateNotes: null,
    stickies: null,
  },
  pro: {
    saves: null,
    folders: null,
    privateNotes: null,
    stickies: null,
  },
} as const satisfies Record<SubscriptionPlanId, OrganizationLimits>;
