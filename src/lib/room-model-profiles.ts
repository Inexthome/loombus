import type {
  RoomModuleDefinition,
  RoomModuleKey,
} from "@/lib/room-plan-entitlements";
import {
  getRoomRequiredBehaviors,
  type RoomRequiredBehavior,
} from "@/lib/room-required-behaviors";

export type RoomModelProfileKey =
  | "business"
  | "residents"
  | "classroom"
  | "customer_support"
  | "community";

export type RoomModelDefaultSettings = {
  allowMemberPosts: boolean;
  memberDirectoryVisible: boolean;
  inviteRequiresApproval: boolean;
  defaultInviteRole: "member" | "moderator";
};

export type RoomModelRequestProfile = {
  label: string;
  singularLabel: string;
  description: string;
  submitHeading: string;
  detailsLabel: string;
  categories: readonly string[];
  defaultCategory: string;
};

type ModuleOverride = Partial<
  Pick<RoomModuleDefinition, "label" | "description" | "minimumRole">
>;

export type RoomModelProfile = {
  key: RoomModelProfileKey;
  templateId:
    | "business-team"
    | "residents"
    | "classroom"
    | "customer-support"
    | "community";
  category: "Business" | "Residents" | "Classroom" | "Customer" | "Community";
  title: string;
  shortTitle: string;
  description: string;
  audience: string;
  calendarUse: string;
  defaultAccessSummary: string;
  workflowSummary: string;
  workflowHighlights: readonly string[];
  recommendedModules: readonly RoomModuleKey[];
  defaultSettings: RoomModelDefaultSettings;
  request: RoomModelRequestProfile;
  moduleOverrides: Partial<Record<RoomModuleKey, ModuleOverride>>;
  requiredBehaviors: readonly RoomRequiredBehavior[];
};

const BUSINESS_PROFILE: RoomModelProfile = {
  key: "business",
  templateId: "business-team",
  category: "Business",
  title: "Business Team Room",
  shortTitle: "Business Team",
  description:
    "A private operating space for team decisions, announcements, shared resources, tasks, and focused discussion.",
  audience: "Companies, departments, project teams, and professional groups",
  calendarUse: "Milestones, meetings, deadlines, launches, and internal events",
  defaultAccessSummary: "Manager approval is enabled for new members by default.",
  workflowSummary: "Coordinate decisions, work requests, action items, milestones, and team updates.",
  workflowHighlights: ["Decision records", "Work requests", "Tasks and milestones"],
  recommendedModules: [
    "discussions",
    "announcements",
    "calendar",
    "requests",
    "resources",
    "tasks",
    "files",
  ],
  defaultSettings: {
    allowMemberPosts: true,
    memberDirectoryVisible: true,
    inviteRequiresApproval: true,
    defaultInviteRole: "member",
  },
  request: {
    label: "Work Requests",
    singularLabel: "work request",
    description:
      "Team work requests with assignment, priority, target dates, and manager decisions.",
    submitHeading: "Submit a work request",
    detailsLabel: "Work request details",
    categories: [
      "Project",
      "Approval",
      "Purchase",
      "Access",
      "Scheduling",
      "Operations",
      "Other",
    ],
    defaultCategory: "Operations",
  },
  moduleOverrides: {
    discussions: {
      label: "Team Discussions",
      description: "Focused internal conversations, decisions, and operating context.",
    },
    announcements: {
      label: "Team Updates",
      description: "Leadership updates, policy changes, launches, and important notices.",
    },
    calendar: {
      label: "Milestones / Calendar",
      description: "Meetings, milestones, deadlines, launches, and internal events.",
    },
    requests: {
      label: "Work Requests",
      description:
        "Team work requests with assignment, priority, target dates, and manager decisions.",
    },
    resources: {
      label: "Policies / Resources",
      description: "Operating references, policies, portals, and team resources.",
    },
    tasks: {
      label: "Tasks / Deliverables",
      description: "Assigned work, owners, priorities, deadlines, and completion state.",
    },
    polls: {
      label: "Decisions / Votes",
      description: "Verified internal decisions and team voting.",
    },
    directory: {
      label: "Team Directory",
      description: "Private team contacts, roles, and organizations.",
    },
  },
  requiredBehaviors: getRoomRequiredBehaviors("business"),
};

const RESIDENTS_PROFILE: RoomModelProfile = {
  key: "residents",
  templateId: "residents",
  category: "Residents",
  title: "Resident / HOA Room",
  shortTitle: "Resident Community",
  description:
    "A private resident space for notices, maintenance updates, documents, questions, neighborhood decisions, and events.",
  audience: "HOAs, condominiums, apartment communities, and neighborhood groups",
  calendarUse: "Meetings, inspections, maintenance windows, and community events",
  defaultAccessSummary:
    "Manager approval is enabled and the resident directory is hidden by default.",
  workflowSummary:
    "Handle maintenance, safety, governance, resident notices, meetings, and community decisions.",
  workflowHighlights: ["Maintenance requests", "Official notices", "Resident decisions"],
  recommendedModules: [
    "discussions",
    "announcements",
    "calendar",
    "requests",
    "resources",
    "polls",
    "files",
    "directory",
  ],
  defaultSettings: {
    allowMemberPosts: true,
    memberDirectoryVisible: false,
    inviteRequiresApproval: true,
    defaultInviteRole: "member",
  },
  request: {
    label: "Maintenance Requests",
    singularLabel: "maintenance request",
    description:
      "Resident maintenance and community requests with priority, assignment, and status tracking.",
    submitHeading: "Submit a maintenance request",
    detailsLabel: "Maintenance or community request details",
    categories: [
      "Maintenance",
      "Safety",
      "Parking",
      "Landscaping",
      "Amenities",
      "Governance",
      "Other",
    ],
    defaultCategory: "Maintenance",
  },
  moduleOverrides: {
    discussions: {
      label: "Resident Discussions",
      description: "Private resident questions, neighborhood matters, and board discussion.",
    },
    announcements: {
      label: "Notices",
      description: "Board notices, maintenance updates, safety alerts, and official communications.",
    },
    calendar: {
      label: "Meetings / Maintenance",
      description: "Board meetings, inspections, maintenance windows, and community events.",
    },
    requests: {
      label: "Maintenance Requests",
      description:
        "Resident maintenance and community requests with priority, assignment, and status tracking.",
    },
    resources: {
      label: "Documents / Policies",
      description: "Rules, policies, forms, portals, and resident reference material.",
    },
    polls: {
      label: "Resident Votes",
      description: "Verified resident votes and private community decisions.",
    },
    directory: {
      label: "Resident Directory",
      description: "A private resident and property contact directory controlled by Room settings.",
    },
    files: {
      label: "Documents / Files",
      description: "Private governing documents, notices, forms, images, and included video.",
    },
  },
  requiredBehaviors: getRoomRequiredBehaviors("residents"),
};

const CLASSROOM_PROFILE: RoomModelProfile = {
  key: "classroom",
  templateId: "classroom",
  category: "Classroom",
  title: "Classroom Room",
  shortTitle: "Classroom",
  description:
    "A private learning space for prompts, assignments, resources, moderated discussion, announcements, and class events.",
  audience: "Teachers, students, cohorts, workshops, and training programs",
  calendarUse: "Due dates, class sessions, office hours, and presentations",
  defaultAccessSummary:
    "Instructor approval is enabled and the class directory is hidden by default.",
  workflowSummary:
    "Organize assignments, attendance needs, accommodations, course resources, and class schedules.",
  workflowHighlights: ["Assignments", "Student requests", "Course schedule"],
  recommendedModules: [
    "discussions",
    "announcements",
    "calendar",
    "requests",
    "resources",
    "tasks",
    "forms",
    "knowledge",
    "files",
  ],
  defaultSettings: {
    allowMemberPosts: true,
    memberDirectoryVisible: false,
    inviteRequiresApproval: true,
    defaultInviteRole: "member",
  },
  request: {
    label: "Student Requests",
    singularLabel: "student request",
    description:
      "Student requests for assignments, attendance, accommodations, materials, scheduling, or technical help.",
    submitHeading: "Submit a student request",
    detailsLabel: "Student request details",
    categories: [
      "Assignment",
      "Attendance",
      "Accommodation",
      "Materials",
      "Scheduling",
      "Technical",
      "Other",
    ],
    defaultCategory: "Assignment",
  },
  moduleOverrides: {
    discussions: {
      label: "Class Discussions",
      description: "Private prompts, questions, moderated discussion, and learning context.",
    },
    announcements: {
      label: "Class Announcements",
      description: "Instructor updates, schedule changes, reminders, and class notices.",
    },
    calendar: {
      label: "Class Schedule",
      description: "Due dates, class sessions, office hours, presentations, and exams.",
    },
    requests: {
      label: "Student Requests",
      description:
        "Student requests for assignments, attendance, accommodations, materials, scheduling, or technical help.",
    },
    resources: {
      label: "Course Resources",
      description: "Course references, reading links, portals, and learning resources.",
    },
    tasks: {
      label: "Assignments / Tasks",
      description: "Assignments, owners, due dates, priorities, and completion state.",
    },
    forms: {
      label: "Submissions / Forms",
      description: "Structured student submissions, check-ins, and private forms.",
    },
    knowledge: {
      label: "Course FAQ",
      description: "Reusable course answers, policies, instructions, and learning guidance.",
    },
    directory: {
      label: "Class Directory",
      description: "A private class roster controlled by instructor settings.",
    },
  },
  requiredBehaviors: getRoomRequiredBehaviors("classroom"),
};

const CUSTOMER_SUPPORT_PROFILE: RoomModelProfile = {
  key: "customer_support",
  templateId: "customer-support",
  category: "Customer",
  title: "Customer Support Room",
  shortTitle: "Customer Support",
  description:
    "A private support space where each customer case is visible only to its author, Room support staff, and explicitly added participants.",
  audience: "Businesses, service providers, product teams, and client support groups",
  calendarUse: "Maintenance windows, onboarding sessions, releases, and training",
  defaultAccessSummary:
    "Customer cases are isolated, the member directory is hidden, and internal requests are staff-only.",
  workflowSummary:
    "Manage private customer cases while staff coordinate internal escalations, known issues, and service operations.",
  workflowHighlights: ["Private support cases", "Staff escalations", "Known issues"],
  recommendedModules: [
    "discussions",
    "announcements",
    "calendar",
    "knowledge",
    "forms",
    "files",
    "requests",
  ],
  defaultSettings: {
    allowMemberPosts: true,
    memberDirectoryVisible: false,
    inviteRequiresApproval: false,
    defaultInviteRole: "member",
  },
  request: {
    label: "Support Operations",
    singularLabel: "support operation",
    description:
      "Staff-only internal escalations, incident coordination, account operations, and follow-up work.",
    submitHeading: "Create a staff support operation",
    detailsLabel: "Internal support operation details",
    categories: [
      "Escalation",
      "Incident",
      "Account",
      "Billing",
      "Bug",
      "Follow-up",
      "Other",
    ],
    defaultCategory: "Escalation",
  },
  moduleOverrides: {
    discussions: {
      label: "Support Cases",
      description:
        "Private customer cases visible only to the author, support staff, and explicit participants.",
    },
    announcements: {
      label: "Service Updates",
      description: "Known issues, maintenance notices, releases, and customer updates.",
    },
    calendar: {
      label: "Service Calendar",
      description: "Maintenance windows, onboarding sessions, releases, and training.",
    },
    requests: {
      label: "Support Operations",
      description:
        "Staff-only internal escalations, incident coordination, account operations, and follow-up work.",
      minimumRole: "manager",
    },
    knowledge: {
      label: "Help Center / FAQ",
      description: "Reusable answers, known issues, product guidance, and support policies.",
    },
    forms: {
      label: "Support Forms",
      description: "Structured intake, onboarding, feedback, and service forms.",
    },
  },
  requiredBehaviors: getRoomRequiredBehaviors("customer_support"),
};

const COMMUNITY_PROFILE: RoomModelProfile = {
  key: "community",
  templateId: "community",
  category: "Community",
  title: "Private Community Room",
  shortTitle: "Private Community",
  description:
    "A focused private space for an association, nonprofit, club, family network, or shared-interest community.",
  audience: "Associations, nonprofits, clubs, family groups, and local communities",
  calendarUse: "Gatherings, volunteer dates, meetings, and shared milestones",
  defaultAccessSummary:
    "Member participation and the private directory are enabled by default.",
  workflowSummary:
    "Coordinate events, volunteers, membership needs, shared resources, and community updates.",
  workflowHighlights: ["Community events", "Volunteer needs", "Member resources"],
  recommendedModules: [
    "discussions",
    "announcements",
    "calendar",
    "requests",
    "resources",
    "polls",
    "directory",
  ],
  defaultSettings: {
    allowMemberPosts: true,
    memberDirectoryVisible: true,
    inviteRequiresApproval: false,
    defaultInviteRole: "member",
  },
  request: {
    label: "Member Requests",
    singularLabel: "member request",
    description:
      "Community requests for events, volunteers, membership, resources, partnerships, and shared needs.",
    submitHeading: "Submit a member request",
    detailsLabel: "Member request details",
    categories: [
      "Event",
      "Volunteer",
      "Membership",
      "Resource",
      "Partnership",
      "Scheduling",
      "Other",
    ],
    defaultCategory: "Membership",
  },
  moduleOverrides: {
    discussions: {
      label: "Community Discussions",
      description: "Private member conversations, ideas, questions, and shared context.",
    },
    announcements: {
      label: "Community Updates",
      description: "Leadership notices, opportunities, reminders, and member updates.",
    },
    calendar: {
      label: "Events / Calendar",
      description: "Gatherings, volunteer dates, meetings, and shared milestones.",
    },
    requests: {
      label: "Member Requests",
      description:
        "Community requests for events, volunteers, membership, resources, partnerships, and shared needs.",
    },
    resources: {
      label: "Community Resources",
      description: "Shared references, portals, guides, opportunities, and member resources.",
    },
    polls: {
      label: "Community Polls",
      description: "Verified member feedback and private community decisions.",
    },
    directory: {
      label: "Member Directory",
      description: "A private member and organization directory controlled by Room settings.",
    },
  },
  requiredBehaviors: getRoomRequiredBehaviors("community"),
};

export const ROOM_MODEL_PROFILES: Record<RoomModelProfileKey, RoomModelProfile> = {
  business: BUSINESS_PROFILE,
  residents: RESIDENTS_PROFILE,
  classroom: CLASSROOM_PROFILE,
  customer_support: CUSTOMER_SUPPORT_PROFILE,
  community: COMMUNITY_PROFILE,
};

function normalizeModelValue(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    : "";
}

const MODEL_ALIASES: Record<string, RoomModelProfileKey> = {
  business: "business",
  business_team: "business",
  team: "business",
  residents: "residents",
  resident: "residents",
  resident_hoa: "residents",
  hoa: "residents",
  classroom: "classroom",
  class: "classroom",
  customer_support: "customer_support",
  customer: "customer_support",
  support: "customer_support",
  community: "community",
  private_community: "community",
};

export function getRoomModelProfile(value: unknown): RoomModelProfile {
  const normalized = normalizeModelValue(value);
  const key = MODEL_ALIASES[normalized] ?? "community";
  return ROOM_MODEL_PROFILES[key];
}

export function getRoomModelDefaultSettings(
  value: unknown
): RoomModelDefaultSettings {
  return { ...getRoomModelProfile(value).defaultSettings };
}

export function getRoomModelModuleDefinition(
  roomType: unknown,
  moduleKey: RoomModuleKey,
  base: RoomModuleDefinition
): RoomModuleDefinition & { recommended: boolean } {
  const profile = getRoomModelProfile(roomType);
  const override = profile.moduleOverrides[moduleKey] ?? {};
  return {
    ...base,
    ...override,
    recommended: profile.recommendedModules.includes(moduleKey),
  };
}

export function normalizeRoomRequestCategory(
  roomType: unknown,
  value: unknown
): string | null {
  const profile = getRoomModelProfile(roomType);
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return profile.request.defaultCategory;
  const match = profile.request.categories.find(
    (category) => category.toLowerCase() === raw.toLowerCase()
  );
  return match ?? null;
}
