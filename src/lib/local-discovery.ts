export type LocalDiscoveryEntityType =
  | "business"
  | "service"
  | "event"
  | "job"
  | "marketplace"
  | "request";

export type LocalDiscoveryResult = {
  id: string;
  entityType: LocalDiscoveryEntityType;
  sourceTable: string;
  title: string;
  summary: string;
  href: string;
  category: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  locationMode: string | null;
  remoteAvailable: boolean;
  distanceMiles: number | null;
  startsAt: string | null;
  endsAt: string | null;
  priceText: string | null;
  attribution: string | null;
  imageUrl: string | null;
  locationPrecision: string | null;
  updatedAt: string | null;
};

export type LocalDiscoveryResponse = {
  results: LocalDiscoveryResult[];
  total: number;
  page: number;
  pageSize: number;
  counts: Partial<Record<LocalDiscoveryEntityType, number>>;
  anchoredTotal: number;
};

export type LocalManageItem = {
  id: string;
  sourceTable: string;
  entityType: LocalDiscoveryEntityType;
  title: string;
  href: string;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  locationMode: string | null;
  directLocation: boolean;
  inheritedLocation: boolean;
  locationPrecision: string | null;
  locationLabel: string;
  canSetDirect: boolean;
};

export type LocalManageResponse = {
  items: LocalManageItem[];
  isAdmin: boolean;
};

export const LOCAL_DISCOVERY_TYPES: Array<{
  value: "all" | LocalDiscoveryEntityType;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "business", label: "Businesses" },
  { value: "service", label: "Services" },
  { value: "event", label: "Events" },
  { value: "job", label: "Jobs" },
  { value: "marketplace", label: "Marketplace" },
  { value: "request", label: "Requests" },
];

export function localDiscoveryTypeLabel(value: LocalDiscoveryEntityType) {
  return (
    LOCAL_DISCOVERY_TYPES.find((item) => item.value === value)?.label ??
    "Local result"
  );
}

export function localDiscoveryLocationLabel(
  result: Pick<
    LocalDiscoveryResult,
    "city" | "region" | "postalCode" | "remoteAvailable" | "locationMode"
  >,
) {
  const place = [result.city, result.region, result.postalCode]
    .filter(Boolean)
    .join(", ");
  if (place && result.remoteAvailable) return `${place} · Remote available`;
  if (place) return place;
  if (result.remoteAvailable) return "Remote or online";
  return result.locationMode
    ? result.locationMode.replaceAll("_", " ")
    : "Location stated on source";
}

export function formatLocalDiscoveryDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
