import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CalendarDays,
  DoorOpen,
  GitBranch,
  HandHeart,
  MapPin,
  Search,
  ShoppingBag,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type PlatformModuleKey =
  | "marketplace"
  | "businesses"
  | "jobs"
  | "events"
  | "requests"
  | "services"
  | "rooms"
  | "appointments"
  | "local"
  | "matches"
  | "search";

export type PlatformRoute = "overview" | PlatformModuleKey;

export type AdminModuleDefinition = {
  key: PlatformModuleKey;
  title: string;
  shortTitle: string;
  description: string;
  publicHref: string;
  manageHref: string;
  publicLabel: string;
  manageLabel: string;
  metricLabel: string;
  includeInQueueTotal: boolean;
  Icon: LucideIcon;
};

export const ADMIN_PLATFORM_MODULES: AdminModuleDefinition[] = [
  {
    key: "marketplace",
    title: "Marketplace",
    shortTitle: "Marketplace",
    description:
      "Moderation for submitted listings, listing lifecycle exceptions, and member reports.",
    publicHref: "/marketplace",
    manageHref: "/marketplace/manage",
    publicLabel: "View Marketplace",
    manageLabel: "Open seller workspace",
    metricLabel: "queue items",
    includeInQueueTotal: true,
    Icon: ShoppingBag,
  },
  {
    key: "businesses",
    title: "Business Directory",
    shortTitle: "Businesses",
    description:
      "Review listing decisions, ownership claims, verification state, and directory reports.",
    publicHref: "/businesses",
    manageHref: "/businesses/manage",
    publicLabel: "View Businesses",
    manageLabel: "Open business workspace",
    metricLabel: "queue items",
    includeInQueueTotal: true,
    Icon: Building2,
  },
  {
    key: "jobs",
    title: "Jobs",
    shortTitle: "Jobs",
    description:
      "Review attributable job postings, employer publication requirements, and reports.",
    publicHref: "/jobs",
    manageHref: "/jobs/manage",
    publicLabel: "View Jobs",
    manageLabel: "Open employer workspace",
    metricLabel: "queue items",
    includeInQueueTotal: true,
    Icon: BriefcaseBusiness,
  },
  {
    key: "events",
    title: "Events",
    shortTitle: "Events",
    description:
      "Review public Event submissions, schedule requirements, organizers, and reports.",
    publicHref: "/events",
    manageHref: "/events/manage",
    publicLabel: "View Events",
    manageLabel: "Open Event workspace",
    metricLabel: "queue items",
    includeInQueueTotal: true,
    Icon: CalendarDays,
  },
  {
    key: "requests",
    title: "Requests",
    shortTitle: "Requests",
    description:
      "Review public needs, requester attribution, lifecycle exceptions, and reports.",
    publicHref: "/requests",
    manageHref: "/requests/manage",
    publicLabel: "View Requests",
    manageLabel: "Open Request workspace",
    metricLabel: "queue items",
    includeInQueueTotal: true,
    Icon: HandHeart,
  },
  {
    key: "services",
    title: "Services",
    shortTitle: "Services",
    description:
      "Review provider listings, business attribution, appointment connections, and reports.",
    publicHref: "/services",
    manageHref: "/services/manage",
    publicLabel: "View Services",
    manageLabel: "Open provider workspace",
    metricLabel: "queue items",
    includeInQueueTotal: true,
    Icon: Wrench,
  },
  {
    key: "rooms",
    title: "Rooms",
    shortTitle: "Rooms",
    description:
      "Review Room registry health, report snapshots, membership demand, and billing diagnostics without opening private content.",
    publicHref: "/rooms",
    manageHref: "/rooms",
    publicLabel: "Open Rooms",
    manageLabel: "Open Room workspace",
    metricLabel: "attention items",
    includeInQueueTotal: true,
    Icon: DoorOpen,
  },
  {
    key: "appointments",
    title: "Appointments",
    shortTitle: "Appointments",
    description:
      "Review appointment lifecycle diagnostics, participant attribution, and overdue accepted bookings.",
    publicHref: "/appointments",
    manageHref: "/appointments",
    publicLabel: "Open Appointments",
    manageLabel: "Open appointment workspace",
    metricLabel: "overdue accepted",
    includeInQueueTotal: true,
    Icon: CalendarClock,
  },
  {
    key: "local",
    title: "Local",
    shortTitle: "Local",
    description:
      "Inspect Local Discovery source coverage, privacy-safe location anchoring, and freshness exceptions.",
    publicHref: "/local",
    manageHref: "/local/manage",
    publicLabel: "Open Local",
    manageLabel: "Open location workspace",
    metricLabel: "attention records",
    includeInQueueTotal: true,
    Icon: MapPin,
  },
  {
    key: "matches",
    title: "Intelligent Matching",
    shortTitle: "Matches",
    description:
      "Inspect matching eligibility, feedback signals, delivery health, and stale candidates without changing scores.",
    publicHref: "/matches",
    manageHref: "/matches",
    publicLabel: "Open Matches",
    manageLabel: "Open matching workspace",
    metricLabel: "attention signals",
    includeInQueueTotal: true,
    Icon: GitBranch,
  },
  {
    key: "search",
    title: "Search Operations",
    shortTitle: "Search",
    description:
      "Monitor index integrity, rebuild registered source families, and repair derived records without changing public Search, visibility, or ranking rules.",
    publicHref: "/search",
    manageHref: "/search",
    publicLabel: "Open Search",
    manageLabel: "Open Search workspace",
    metricLabel: "indexed documents",
    includeInQueueTotal: false,
    Icon: Search,
  },
];

export function getAdminPlatformModule(key: PlatformModuleKey) {
  return ADMIN_PLATFORM_MODULES.find((module) => module.key === key) ?? null;
}
