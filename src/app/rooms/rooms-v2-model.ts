import {
  ROOM_PLAN_ENTITLEMENTS,
  type RoomPlanKey,
} from "@/lib/room-plan-entitlements";
import { getRoomModelProfile } from "@/lib/room-model-profiles";
import type { RoomRequiredBehavior } from "@/lib/room-required-behaviors";

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
  defaultAccessSummary: string;
  workflowSummary: string;
  workflowHighlights: readonly string[];
  requiredBehaviors: readonly RoomRequiredBehavior[];
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
  selfServe: boolean;
  contactSales?: boolean;
  segment: "single" | "organization";
};

const BUSINESS_MODEL = getRoomModelProfile("business");
const RESIDENTS_MODEL = getRoomModelProfile("residents");
const CLASSROOM_MODEL = getRoomModelProfile("classroom");
const CUSTOMER_SUPPORT_MODEL = getRoomModelProfile("customer_support");
const COMMUNITY_MODEL = getRoomModelProfile("community");

export const ROOM_MODELS: RoomModel[] = [
  {
    id: BUSINESS_MODEL.templateId,
    category: BUSINESS_MODEL.category,
    title: BUSINESS_MODEL.title,
    shortTitle: BUSINESS_MODEL.shortTitle,
    description: BUSINESS_MODEL.description,
    audience: BUSINESS_MODEL.audience,
    examples: [...BUSINESS_MODEL.workflowHighlights],
    calendarUse: BUSINESS_MODEL.calendarUse,
    defaultAccessSummary: BUSINESS_MODEL.defaultAccessSummary,
    workflowSummary: BUSINESS_MODEL.workflowSummary,
    workflowHighlights: BUSINESS_MODEL.workflowHighlights,
    requiredBehaviors: BUSINESS_MODEL.requiredBehaviors,
  },
  {
    id: RESIDENTS_MODEL.templateId,
    category: RESIDENTS_MODEL.category,
    title: RESIDENTS_MODEL.title,
    shortTitle: RESIDENTS_MODEL.shortTitle,
    description: RESIDENTS_MODEL.description,
    audience: RESIDENTS_MODEL.audience,
    examples: [...RESIDENTS_MODEL.workflowHighlights],
    calendarUse: RESIDENTS_MODEL.calendarUse,
    defaultAccessSummary: RESIDENTS_MODEL.defaultAccessSummary,
    workflowSummary: RESIDENTS_MODEL.workflowSummary,
    workflowHighlights: RESIDENTS_MODEL.workflowHighlights,
    requiredBehaviors: RESIDENTS_MODEL.requiredBehaviors,
  },
  {
    id: CLASSROOM_MODEL.templateId,
    category: CLASSROOM_MODEL.category,
    title: CLASSROOM_MODEL.title,
    shortTitle: CLASSROOM_MODEL.shortTitle,
    description: CLASSROOM_MODEL.description,
    audience: CLASSROOM_MODEL.audience,
    examples: [...CLASSROOM_MODEL.workflowHighlights],
    calendarUse: CLASSROOM_MODEL.calendarUse,
    defaultAccessSummary: CLASSROOM_MODEL.defaultAccessSummary,
    workflowSummary: CLASSROOM_MODEL.workflowSummary,
    workflowHighlights: CLASSROOM_MODEL.workflowHighlights,
    requiredBehaviors: CLASSROOM_MODEL.requiredBehaviors,
  },
  {
    id: CUSTOMER_SUPPORT_MODEL.templateId,
    category: CUSTOMER_SUPPORT_MODEL.category,
    title: CUSTOMER_SUPPORT_MODEL.title,
    shortTitle: CUSTOMER_SUPPORT_MODEL.shortTitle,
    description: CUSTOMER_SUPPORT_MODEL.description,
    audience: CUSTOMER_SUPPORT_MODEL.audience,
    examples: [...CUSTOMER_SUPPORT_MODEL.workflowHighlights],
    calendarUse: CUSTOMER_SUPPORT_MODEL.calendarUse,
    defaultAccessSummary: CUSTOMER_SUPPORT_MODEL.defaultAccessSummary,
    workflowSummary: CUSTOMER_SUPPORT_MODEL.workflowSummary,
    workflowHighlights: CUSTOMER_SUPPORT_MODEL.workflowHighlights,
    requiredBehaviors: CUSTOMER_SUPPORT_MODEL.requiredBehaviors,
  },
  {
    id: COMMUNITY_MODEL.templateId,
    category: COMMUNITY_MODEL.category,
    title: COMMUNITY_MODEL.title,
    shortTitle: COMMUNITY_MODEL.shortTitle,
    description: COMMUNITY_MODEL.description,
    audience: COMMUNITY_MODEL.audience,
    examples: [...COMMUNITY_MODEL.workflowHighlights],
    calendarUse: COMMUNITY_MODEL.calendarUse,
    defaultAccessSummary: COMMUNITY_MODEL.defaultAccessSummary,
    workflowSummary: COMMUNITY_MODEL.workflowSummary,
    workflowHighlights: COMMUNITY_MODEL.workflowHighlights,
    requiredBehaviors: COMMUNITY_MODEL.requiredBehaviors,
  },
];

export const ROOM_PLANS: RoomPlan[] = [
  {
    id: "free",
    name: "Free Room",
    price: "$0",
    members: "1 Room · Up to 10 members",
    detail: "Core private workspace with basic invitations and Room settings",
    features: [...ROOM_PLAN_ENTITLEMENTS.free.features],
    paid: false,
    selfServe: false,
    segment: "single",
  },
  {
    id: "starter",
    name: "Room Starter",
    price: "$19/mo",
    members: "1 Room · Up to 50 members",
    detail: "Adds announcements, structured requests, and curated resources",
    features: [...ROOM_PLAN_ENTITLEMENTS.starter.features],
    paid: true,
    selfServe: true,
    segment: "single",
  },
  {
    id: "pro",
    name: "Room Pro",
    price: "$49/mo",
    members: "1 Room · Up to 250 members",
    detail: "Adds inline video, larger uploads, and expanded Room management",
    features: [...ROOM_PLAN_ENTITLEMENTS.pro.features],
    paid: true,
    selfServe: true,
    segment: "single",
  },
  {
    id: "business",
    name: "Room Business",
    price: "$79/mo",
    members: "1 Room · Up to 750 members",
    detail: "High-capacity single Room with audit history, advanced controls, and larger resources",
    features: [...ROOM_PLAN_ENTITLEMENTS.business.features],
    paid: true,
    selfServe: true,
    segment: "single",
  },
  {
    id: "organization",
    name: "Organization",
    price: "$99/mo",
    members: "Up to 3 Rooms · 500 members per Room",
    detail: "Multi-Room organization capacity, larger resources, and setup support",
    features: [...ROOM_PLAN_ENTITLEMENTS.organization.features],
    paid: true,
    selfServe: true,
    segment: "organization",
  },
  {
    id: "organization-plus",
    name: "Organization Plus",
    price: "$199/mo",
    members: "Up to 10 Rooms · 2,000 members per Room",
    detail: "More Rooms, substantially larger storage, and priority support",
    features: [...ROOM_PLAN_ENTITLEMENTS["organization-plus"].features],
    paid: true,
    selfServe: true,
    segment: "organization",
  },
  {
    id: "enterprise",
    name: "Organization Enterprise",
    price: "Custom",
    members: "Custom Rooms · Custom member capacity",
    detail: "Custom limits, enterprise controls, dedicated support, and onboarding",
    features: [...ROOM_PLAN_ENTITLEMENTS.enterprise.features],
    paid: true,
    selfServe: false,
    contactSales: true,
    segment: "organization",
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
    `Room plan: ${input.plan.name} (${input.plan.price})`,
    `Member capacity: ${input.plan.members}`,
    `Purpose: ${input.description.trim()}`,
    `Default access: ${input.model.defaultAccessSummary}`,
    `Model workflow: ${input.model.workflowSummary}`,
    "Included features:",
    ...input.plan.features.map((feature) => `- ${feature}`),
    "Workspace blueprint: Discussions, Announcements, Room calendar, Files and resources, Members and roles",
    "Privacy boundary: Private by default; no public Discussions publishing unless a Room workflow explicitly allows it.",
  ];

  return lines.join("\n");
}
