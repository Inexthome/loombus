import {
  ROOM_PLAN_ENTITLEMENTS,
  type RoomPlanKey,
} from "@/lib/room-plan-entitlements";

export type RoomModelId =
  | "business-team"
  | "residents"
  | "classroom"
  | "customer-support"
  | "community";

export type RoomCategory =
  | "Business"
  | "Residents"
  | "Classroom"
  | "Customer"
  | "Community";

export type RoomModel = {
  id: RoomModelId;
  category: RoomCategory;
  title: string;
  shortTitle: string;
  description: string;
  audience: string;
  examples: string[];
  calendarUse: string;
};

export type RoomPlanId = RoomPlanKey;

export type RoomPlan = {
  id: RoomPlanId;
  name: string;
  price: string;
  members: string;
  detail: string;
  features: string[];
  paid: boolean;
};

export const ROOM_MODELS: RoomModel[] = [
  {
    id: "business-team",
    category: "Business",
    title: "Business Team Room",
    shortTitle: "Business Team",
    description:
      "A private operating space for team decisions, announcements, shared resources, tasks, and focused discussion.",
    audience: "Companies, departments, project teams, and professional groups",
    examples: ["Decision threads", "Team announcements", "Shared operating files"],
    calendarUse: "Milestones, meetings, deadlines, launches, and internal events",
  },
  {
    id: "residents",
    category: "Residents",
    title: "Resident / HOA Room",
    shortTitle: "Resident Community",
    description:
      "A private resident space for notices, maintenance updates, documents, questions, neighborhood decisions, and events.",
    audience: "HOAs, condominiums, apartment communities, and neighborhood groups",
    examples: ["Maintenance notices", "Board updates", "Resident questions"],
    calendarUse: "Meetings, inspections, maintenance windows, and community events",
  },
  {
    id: "classroom",
    category: "Classroom",
    title: "Classroom Room",
    shortTitle: "Classroom",
    description:
      "A private learning space for prompts, assignments, resources, moderated discussion, announcements, and class events.",
    audience: "Teachers, students, cohorts, workshops, and training programs",
    examples: ["Class prompts", "Assignment resources", "Moderated discussion"],
    calendarUse: "Due dates, class sessions, office hours, and presentations",
  },
  {
    id: "customer-support",
    category: "Customer",
    title: "Customer Community Room",
    shortTitle: "Customer Community",
    description:
      "A shared customer community for known issues, help resources, product questions, requests, and updates. Active Room members can see shared discussions.",
    audience: "Businesses, service providers, product teams, and customer communities",
    examples: ["Known issues", "Shared product questions", "Product updates"],
    calendarUse: "Maintenance windows, onboarding sessions, releases, and training",
  },
  {
    id: "community",
    category: "Community",
    title: "Private Community Room",
    shortTitle: "Private Community",
    description:
      "A focused private space for an association, nonprofit, club, family network, or shared-interest community.",
    audience: "Associations, nonprofits, clubs, family groups, and local communities",
    examples: ["Member discussions", "Community resources", "Group announcements"],
    calendarUse: "Gatherings, volunteer dates, meetings, and shared milestones",
  },
];

export const ROOM_PLANS: RoomPlan[] = [
  {
    id: "free",
    name: "Free Room",
    price: "$0",
    members: "Up to 10 members",
    detail: "Core private workspace with basic invitations and Room settings",
    features: [...ROOM_PLAN_ENTITLEMENTS.free.features],
    paid: false,
  },
  {
    id: "starter",
    name: "Room Starter",
    price: "$19/mo",
    members: "Up to 50 members",
    detail: "Adds announcements, structured requests, and curated resources",
    features: [...ROOM_PLAN_ENTITLEMENTS.starter.features],
    paid: true,
  },
  {
    id: "pro",
    name: "Room Pro",
    price: "$49/mo",
    members: "Up to 250 members",
    detail: "Adds inline video, larger uploads, and expanded Room management",
    features: [...ROOM_PLAN_ENTITLEMENTS.pro.features],
    paid: true,
  },
  {
    id: "organization",
    name: "Organization",
    price: "$99/mo",
    members: "Up to 3 rooms · 500 members",
    detail: "Multi-Room organization capacity, larger resources, and setup support",
    features: [...ROOM_PLAN_ENTITLEMENTS.organization.features],
    paid: true,
  },
  {
    id: "organization-plus",
    name: "Organization Plus",
    price: "$149/mo",
    members: "Up to 10 rooms · 2,000 members",
    detail: "More Rooms, substantially larger storage, and priority support",
    features: [...ROOM_PLAN_ENTITLEMENTS["organization-plus"].features],
    paid: true,
  },
  {
    id: "enterprise",
    name: "Organization Enterprise",
    price: "$199/mo",
    members: "Custom rooms · Large membership",
    detail: "Custom limits, enterprise storage, dedicated support, and onboarding",
    features: [...ROOM_PLAN_ENTITLEMENTS.enterprise.features],
    paid: true,
  },
];

export const ROOM_WORKSPACE_BLUEPRINT = [
  {
    id: "discussions",
    title: "Discussions",
    description: "Focused private threads that remain inside the room boundary.",
  },
  {
    id: "announcements",
    title: "Announcements",
    description: "High-visibility updates from owners, administrators, or authorized staff.",
  },
  {
    id: "calendar",
    title: "Room calendar",
    description: "Events, deadlines, meetings, maintenance windows, and shared dates.",
  },
  {
    id: "library",
    title: "Files and resources",
    description:
      "Private file and inline video resources unlocked according to the Room subscription tier.",
  },
  {
    id: "members",
    title: "Members and roles",
    description: "Owner, administrator, moderator, and member access with clear boundaries.",
  },
] as const;

export function getRoomModel(modelId: RoomModelId) {
  return ROOM_MODELS.find((model) => model.id === modelId) ?? ROOM_MODELS[0];
}

export function getRoomPlan(planId: RoomPlanId) {
  return ROOM_PLANS.find((plan) => plan.id === planId) ?? ROOM_PLANS[0];
}

export function buildRoomSetupSummary(input: {
  model: RoomModel;
  plan: RoomPlan;
  roomName: string;
  description: string;
}) {
  const lines = [
    `Room name: ${input.roomName.trim()}`,
    `Room model: ${input.model.title}`,
    `Monthly tier: ${input.plan.name} (${input.plan.price})`,
    `Member capacity: ${input.plan.members}`,
    `Purpose: ${input.description.trim()}`,
    "Included features:",
    ...input.plan.features.map((feature) => `- ${feature}`),
    "Workspace blueprint: Discussions, Announcements, Room calendar, Files and resources, Members and roles",
    "Privacy boundary: Private by default; no public Discussions publishing unless a Room workflow explicitly allows it.",
  ];

  return lines.join("\n");
}
