export type RoomPlanKey =
  | "free"
  | "starter"
  | "pro"
  | "organization"
  | "organization-plus"
  | "enterprise";

export type RoomModuleKey =
  | "overview"
  | "discussions"
  | "calendar"
  | "announcements"
  | "members"
  | "requests"
  | "resources"
  | "settings"
  | "tasks"
  | "polls"
  | "directory"
  | "knowledge"
  | "files"
  | "forms"
  | "services"
  | "invites"
  | "activity"
  | "advanced-controls"
  | "admin-tools"
  | "operations"
  | "member-workflows"
  | "enterprise-controls"
  | "high-capacity"
  | "community-operations";

export type RoomModuleDefinition = {
  id: RoomModuleKey;
  label: string;
  description: string;
  minimumRole: "member" | "manager" | "owner";
  dataModule?:
    | "resource"
    | "request"
    | "task"
    | "poll"
    | "directory"
    | "knowledge"
    | "form"
    | "service"
    | "workflow";
};

export const ROOM_MODULE_DEFINITIONS: Record<
  RoomModuleKey,
  RoomModuleDefinition
> = {
  overview: {
    id: "overview",
    label: "Overview",
    description: "Room activity, upcoming dates, announcements, and operating status.",
    minimumRole: "member",
  },
  discussions: {
    id: "discussions",
    label: "Discussions",
    description: "Private Room conversations separated from the public discussion feed.",
    minimumRole: "member",
  },
  calendar: {
    id: "calendar",
    label: "Calendar",
    description: "Shared events, deadlines, meetings, and Room dates.",
    minimumRole: "member",
  },
  announcements: {
    id: "announcements",
    label: "Announcements",
    description: "Leadership updates and important notices.",
    minimumRole: "member",
  },
  members: {
    id: "members",
    label: "Members / Roles",
    description: "Verified Room members and explicit role assignments.",
    minimumRole: "member",
  },
  requests: {
    id: "requests",
    label: "Requests",
    description:
      "Operational requests submitted by Room members, with assignment, priority, status, and manager decisions.",
    minimumRole: "member",
    dataModule: "request",
  },
  resources: {
    id: "resources",
    label: "Resources",
    description: "Curated links, references, policies, and external portals.",
    minimumRole: "member",
    dataModule: "resource",
  },
  settings: {
    id: "settings",
    label: "Settings",
    description: "Room identity and core private-workspace settings.",
    minimumRole: "manager",
  },
  tasks: {
    id: "tasks",
    label: "Tasks / Action Items",
    description: "Assigned work, due dates, priorities, and completion state.",
    minimumRole: "member",
    dataModule: "task",
  },
  polls: {
    id: "polls",
    label: "Polls / Decisions",
    description: "Private Room voting with one verified response per member.",
    minimumRole: "member",
    dataModule: "poll",
  },
  directory: {
    id: "directory",
    label: "Directory / Contacts",
    description: "A private directory of Room contacts and organizations.",
    minimumRole: "member",
    dataModule: "directory",
  },
  knowledge: {
    id: "knowledge",
    label: "Knowledge Base / FAQ",
    description: "Reusable answers, guidance, policies, and institutional knowledge.",
    minimumRole: "member",
    dataModule: "knowledge",
  },
  files: {
    id: "files",
    label: "Files / Documents",
    description: "Private documents, images, and included inline video.",
    minimumRole: "member",
  },
  forms: {
    id: "forms",
    label: "Forms / Submissions",
    description: "Structured private forms with member submissions.",
    minimumRole: "member",
    dataModule: "form",
  },
  services: {
    id: "services",
    label: "Services / Store",
    description: "A private catalog of services, offerings, and external request links.",
    minimumRole: "member",
    dataModule: "service",
  },
  invites: {
    id: "invites",
    label: "Invites / Join Requests",
    description: "Basic invitation links and Room admission. Advanced controls remain plan-gated.",
    minimumRole: "manager",
  },
  activity: {
    id: "activity",
    label: "Activity / Audit Log",
    description: "Privileged Room operations recorded in the Loombus audit trail.",
    minimumRole: "manager",
  },
  "advanced-controls": {
    id: "advanced-controls",
    label: "Advanced Room Controls",
    description: "Enforced participation, invitation, and directory controls.",
    minimumRole: "manager",
  },
  "admin-tools": {
    id: "admin-tools",
    label: "More Admin Tools",
    description: "A management dashboard for requests, roles, content, and resources.",
    minimumRole: "manager",
  },
  operations: {
    id: "operations",
    label: "Larger Room Operations",
    description: "Cross-module operational totals and workload visibility.",
    minimumRole: "manager",
  },
  "member-workflows": {
    id: "member-workflows",
    label: "Advanced Member Workflows",
    description: "Private member stages, assignments, notes, and follow-up status.",
    minimumRole: "manager",
    dataModule: "workflow",
  },
  "enterprise-controls": {
    id: "enterprise-controls",
    label: "Enterprise Controls",
    description: "Owner-governed domain, approval, role, and participation rules.",
    minimumRole: "owner",
  },
  "high-capacity": {
    id: "high-capacity",
    label: "High-Capacity Rooms",
    description: "Searchable, paginated membership operations for large Rooms.",
    minimumRole: "manager",
  },
  "community-operations": {
    id: "community-operations",
    label: "Full Private Community Operations",
    description: "A consolidated operating view across the complete private community.",
    minimumRole: "manager",
  },
};

const FREE_MODULES: RoomModuleKey[] = [
  "overview",
  "discussions",
  "calendar",
  "members",
  "settings",
  "invites",
];

const STARTER_MODULES: RoomModuleKey[] = [
  ...FREE_MODULES,
  "announcements",
  "requests",
  "resources",
];

const PRO_MODULES: RoomModuleKey[] = [
  ...STARTER_MODULES,
  "tasks",
  "polls",
  "directory",
  "knowledge",
  "files",
  "forms",
];

const ORGANIZATION_MODULES: RoomModuleKey[] = [
  ...PRO_MODULES,
  "services",
  "activity",
  "advanced-controls",
];

const ORGANIZATION_PLUS_MODULES: RoomModuleKey[] = [
  ...ORGANIZATION_MODULES,
  "admin-tools",
  "operations",
  "member-workflows",
];

const ENTERPRISE_MODULES: RoomModuleKey[] = [
  ...ORGANIZATION_PLUS_MODULES,
  "enterprise-controls",
  "high-capacity",
  "community-operations",
];

export type RoomPlanEntitlements = {
  id: RoomPlanKey;
  label: string;
  roomLimit: number | null;
  memberLimit: number | null;
  fileUploads: boolean;
  inlineVideo: boolean;
  maxFileBytes: number;
  storageBytes: number;
  modules: RoomModuleKey[];
  features: string[];
};

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

export const ROOM_PLAN_ENTITLEMENTS: Record<
  RoomPlanKey,
  RoomPlanEntitlements
> = {
  free: {
    id: "free",
    label: "Free Room",
    roomLimit: 1,
    memberLimit: 10,
    fileUploads: false,
    inlineVideo: false,
    maxFileBytes: 0,
    storageBytes: 0,
    modules: FREE_MODULES,
    features: [
      "One private Room",
      "Up to 10 members",
      "Overview and private discussions",
      "Shared Room calendar",
      "Members and basic roles",
      "Basic invitations and access approvals",
      "Room identity and basic settings",
    ],
  },
  starter: {
    id: "starter",
    label: "Room Starter",
    roomLimit: 1,
    memberLimit: 50,
    fileUploads: false,
    inlineVideo: false,
    maxFileBytes: 0,
    storageBytes: 0,
    modules: STARTER_MODULES,
    features: [
      "Everything in Free",
      "Up to 50 members",
      "Announcements",
      "Structured Room requests",
      "Curated Room resources",
    ],
  },
  pro: {
    id: "pro",
    label: "Room Pro",
    roomLimit: 1,
    memberLimit: 250,
    fileUploads: true,
    inlineVideo: true,
    maxFileBytes: 100 * MIB,
    storageBytes: 10 * GIB,
    modules: PRO_MODULES,
    features: [
      "Everything in Room Starter",
      "Up to 250 members",
      "Tasks, polls, directory, knowledge base, files, and forms",
      "Private documents, images, and inline video",
      "100 MB maximum per upload",
      "10 GB Room resource storage",
      "Priority and pinned announcements",
    ],
  },
  organization: {
    id: "organization",
    label: "Organization",
    roomLimit: 3,
    memberLimit: 500,
    fileUploads: true,
    inlineVideo: true,
    maxFileBytes: 250 * MIB,
    storageBytes: 50 * GIB,
    modules: ORGANIZATION_MODULES,
    features: [
      "Everything in Room Pro",
      "Up to 3 Rooms under one subscription",
      "Up to 500 members per Room",
      "Services, audit log, and advanced invitation controls",
      "250 MB maximum per upload",
      "50 GB resource storage per Room",
      "Organization setup support",
    ],
  },
  "organization-plus": {
    id: "organization-plus",
    label: "Organization Plus",
    roomLimit: 10,
    memberLimit: 2000,
    fileUploads: true,
    inlineVideo: true,
    maxFileBytes: 500 * MIB,
    storageBytes: 250 * GIB,
    modules: ORGANIZATION_PLUS_MODULES,
    features: [
      "Everything in Organization",
      "Up to 10 Rooms under one subscription",
      "Up to 2,000 members per Room",
      "Expanded admin tools and Room operations",
      "Advanced member workflows",
      "500 MB maximum per upload",
      "250 GB resource storage per Room",
      "Priority support",
    ],
  },
  enterprise: {
    id: "enterprise",
    label: "Organization Enterprise",
    roomLimit: null,
    memberLimit: null,
    fileUploads: true,
    inlineVideo: true,
    maxFileBytes: 1024 * MIB,
    storageBytes: 1024 * GIB,
    modules: ENTERPRISE_MODULES,
    features: [
      "Everything in Organization Plus",
      "Custom Room and membership limits",
      "Enterprise controls and high-capacity operations",
      "Full private community operations",
      "1 GB maximum per upload",
      "1 TB resource storage per Room",
      "Dedicated support and custom onboarding",
    ],
  },
};

const hasOwn = (record: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(record, key);

function normalizeRoomSubscriptionStatus(status: unknown) {
  return typeof status === "string" ? status.trim().toLowerCase() : "active";
}

export function isRoomPlanKey(value: unknown): value is RoomPlanKey {
  return (
    typeof value === "string" && hasOwn(ROOM_PLAN_ENTITLEMENTS, value)
  );
}

export function isRoomModuleKey(value: unknown): value is RoomModuleKey {
  return typeof value === "string" && hasOwn(ROOM_MODULE_DEFINITIONS, value);
}

export function normalizeRoomPlanKey(value: unknown): RoomPlanKey {
  return isRoomPlanKey(value) ? value : "free";
}

export function roomSubscriptionIsActive(status: unknown) {
  return ["active", "trialing"].includes(
    normalizeRoomSubscriptionStatus(status)
  );
}

export function roomSubscriptionIsInGrace(status: unknown) {
  return normalizeRoomSubscriptionStatus(status) === "past_due";
}

export function roomSubscriptionHasPaidAccess(status: unknown) {
  return roomSubscriptionIsActive(status) || roomSubscriptionIsInGrace(status);
}

export function getRoomPlanEntitlements(
  plan: unknown,
  subscriptionStatus: unknown = "active"
) {
  const normalizedPlan = normalizeRoomPlanKey(plan);
  if (
    normalizedPlan !== "free" &&
    !roomSubscriptionHasPaidAccess(subscriptionStatus)
  ) {
    return ROOM_PLAN_ENTITLEMENTS.free;
  }
  return ROOM_PLAN_ENTITLEMENTS[normalizedPlan];
}

export function getRoomPlanMemberLimit(plan: unknown) {
  return ROOM_PLAN_ENTITLEMENTS[normalizeRoomPlanKey(plan)].memberLimit;
}

export function roomPlanIncludesModule(
  plan: unknown,
  subscriptionStatus: unknown,
  moduleKey: RoomModuleKey
) {
  return getRoomPlanEntitlements(plan, subscriptionStatus).modules.includes(
    moduleKey
  );
}

export function formatRoomBytes(bytes: number) {
  if (bytes <= 0) return "0 MB";
  if (bytes >= GIB) {
    const value = bytes / GIB;
    return `${Number.isInteger(value) ? value : value.toFixed(1)} GB`;
  }
  const value = bytes / MIB;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} MB`;
}
