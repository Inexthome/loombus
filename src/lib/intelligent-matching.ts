export type MatchingEntityType = "request" | "service";
export type MatchDirection = "request_to_service" | "service_to_request";
export type MatchFeedbackType =
  | "helpful"
  | "not_relevant"
  | "incorrect"
  | "unsafe";

export type MatchingPreferences = {
  activeSections: Array<"requests" | "services">;
  categories: string[];
  radiusMiles: number;
  includeRemote: boolean;
  minimumRelevance: number;
  notificationFrequency: "none" | "daily" | "weekly";
  matchingPaused: boolean;
};

export type MatchingRule = {
  id: string;
  name: string;
  sourceType: MatchingEntityType;
  targetType: MatchingEntityType;
  categories: string[];
  radiusMiles: number;
  includeRemote: boolean;
  minimumRelevance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MatchFactorScores = {
  category: number;
  specialty: number;
  serviceMode: number;
  location: number;
  budget: number;
  timing: number;
  distanceMiles: number | null;
  remoteCompatible: boolean;
  overlappingTerms: string[];
  matchedRules: string[];
};

export type IntelligentMatch = {
  id: string;
  direction: MatchDirection;
  confidence: number;
  confidenceLabel: "Strong" | "Good" | "Possible";
  explanation: string[];
  factors: MatchFactorScores;
  source: {
    type: MatchingEntityType;
    id: string;
    title: string;
    href: string;
    category: string;
    ownerLabel: string;
  };
  target: {
    type: MatchingEntityType;
    id: string;
    title: string;
    href: string;
    category: string;
    ownerLabel: string;
    summary: string;
    locationLabel: string;
    priceLabel: string;
  };
  saved: boolean;
  dismissed: boolean;
  viewed: boolean;
  actedOn: boolean;
  expiresAt: string | null;
  refreshedAt: string;
};

export type IntelligentMatchingResponse = {
  matches: IntelligentMatch[];
  dismissedMatches: IntelligentMatch[];
  preferences: MatchingPreferences;
  rules: MatchingRule[];
  counts: {
    active: number;
    saved: number;
    dismissed: number;
    requestToService: number;
    serviceToRequest: number;
  };
  generatedAt: string;
  matchingPaused: boolean;
  activeSections: Array<"requests" | "services">;
};

export const DEFAULT_MATCHING_PREFERENCES: MatchingPreferences = {
  activeSections: ["requests", "services"],
  categories: [],
  radiusMiles: 25,
  includeRemote: true,
  minimumRelevance: 55,
  notificationFrequency: "weekly",
  matchingPaused: false,
};

export function matchingConfidenceLabel(
  score: number,
): IntelligentMatch["confidenceLabel"] {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Good";
  return "Possible";
}
