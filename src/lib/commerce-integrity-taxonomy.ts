/**
 * Issue #670 application-only commerce and professional-integrity taxonomy.
 *
 * This registry is a structural contract only. Importing it must not create a
 * report resolution, moderation action, enforcement decision, Trust and Safety
 * case, legal preservation action, member notice, or external disclosure.
 */

export const COMMERCE_INTEGRITY_TAXONOMY_FAMILY = "commerce_integrity" as const;
export const COMMERCE_INTEGRITY_TAXONOMY_VERSION = "commerce_integrity.v1" as const;

export const COMMERCE_INTEGRITY_SOURCE_MODULES = [
  "marketplace",
  "businesses",
  "services",
  "requests",
  "jobs",
  "events",
  "appointments",
  "rooms",
  "local",
  "messages",
] as const;

export type CommerceIntegritySourceModule =
  (typeof COMMERCE_INTEGRITY_SOURCE_MODULES)[number];

export const COMMERCE_SOURCE_CLASSIFICATION_MODES = [
  "direct",
  "conditional",
  "restricted",
  "inherited_only",
] as const;

export type CommerceSourceClassificationMode =
  (typeof COMMERCE_SOURCE_CLASSIFICATION_MODES)[number];

export const COMMERCE_SOURCE_MODULE_CONTRACT: Record<
  CommerceIntegritySourceModule,
  {
    classificationMode: CommerceSourceClassificationMode;
    note: string;
  }
> = {
  marketplace: {
    classificationMode: "direct",
    note: "Classify the Marketplace listing or linked report without replacing the original report text.",
  },
  businesses: {
    classificationMode: "direct",
    note: "Keep ownership and verification workflow separate from confirmed commerce-integrity classification.",
  },
  services: {
    classificationMode: "direct",
    note: "Professional and service claims may be classified after review without implying an unreviewed legal conclusion.",
  },
  requests: {
    classificationMode: "direct",
    note: "Classify covered conduct separately from Request fulfillment and lifecycle state.",
  },
  jobs: {
    classificationMode: "direct",
    note: "Employment-integrity classification remains separate from employer publication and application lifecycle state.",
  },
  events: {
    classificationMode: "direct",
    note: "Classify covered Event conduct separately from Event publication and report resolution.",
  },
  appointments: {
    classificationMode: "conditional",
    note: "Routine cancellation and scheduling reasons are operational. Classify only reviewed covered conduct.",
  },
  rooms: {
    classificationMode: "restricted",
    note: "Do not weaken private Room evidence boundaries. Commerce classification applies only to covered conduct.",
  },
  local: {
    classificationMode: "inherited_only",
    note: "Local is an aggregation layer and must inherit the classification of the underlying source record.",
  },
  messages: {
    classificationMode: "restricted",
    note: "Private-message evidence remains behind its existing restricted authorization boundary and is not copied into this registry.",
  },
};

export const COMMERCE_CATEGORY_IDS = [
  "COM-01",
  "COM-02",
  "COM-03",
  "COM-04",
  "COM-05",
  "COM-06",
  "COM-07",
  "COM-08",
  "COM-09",
  "COM-10",
  "COM-11",
  "COM-12",
  "COM-13",
  "COM-14",
  "COM-15",
] as const;

export type CommerceCategoryId = (typeof COMMERCE_CATEGORY_IDS)[number];

export const COMMERCE_MODULE_APPLICABILITY = [
  "primary",
  "secondary",
  "not_applicable",
] as const;

export type CommerceModuleApplicability =
  (typeof COMMERCE_MODULE_APPLICABILITY)[number];

export const CANONICAL_COMMERCE_SAFETY_REASON_CODES = [
  "ABUSE.REPORT_MISUSE",
  "AI_MEDIA.FALSE_COMMERCIAL_REPRESENTATION",
  "CHILD.GROOMING",
  "CHILD.SEXTORTION",
  "CHILD.SEXUAL_EXPLOITATION_MATERIAL",
  "CHILD.SEXUAL_SOLICITATION",
  "FRAUD.EMPLOYMENT_SCAM",
  "FRAUD.FALSE_TESTIMONIAL_OR_ENDORSEMENT",
  "FRAUD.IMPERSONATION",
  "FRAUD.INVESTMENT_OR_FINANCIAL_SCHEME",
  "FRAUD.MONEY_MULE_OR_RESHIPPING",
  "FRAUD.PAYMENT_SCAM",
  "GOODS.AGE_RESTRICTED_PRODUCT",
  "GOODS.COUNTERFEIT_OR_FORGED",
  "GOODS.DRUG_OR_CONTROLLED_PRODUCT",
  "GOODS.GOVERNMENT_DOCUMENT_OR_BENEFIT",
  "GOODS.HAZARDOUS_MATERIAL",
  "GOODS.PERSONAL_DATA_OR_ACCOUNT_ACCESS",
  "GOODS.PRESCRIPTION_OR_REGULATED_MEDICAL",
  "GOODS.RECALLED_OR_UNSAFE_PRODUCT",
  "GOODS.STOLEN_PROPERTY",
  "GOODS.UNAPPROVED_LIVE_ANIMAL_OR_FOOD",
  "GOODS.WEAPON_OR_EXPLOSIVE",
  "GOODS.WILDLIFE_OR_ENVIRONMENTAL_CONTRABAND",
  "INTEGRITY.ACCOUNT_NETWORK",
  "INTEGRITY.BAN_OR_RESTRICTION_EVASION",
  "INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING",
  "INTEGRITY.FAKE_ENGAGEMENT",
  "INTEGRITY.SIGNAL_OR_RANKING_MANIPULATION",
  "INTIMATE.NONCONSENSUAL_DISTRIBUTION",
  "INTIMATE.SEXTORTION",
  "IP.COPYRIGHT",
  "IP.COUNTERFEIT",
  "IP.TRADEMARK",
  "JOBS.APPLICATION_FEE_OR_PAYMENT_SCAM",
  "JOBS.DISCRIMINATION",
  "JOBS.DUPLICATE_OR_STALE_POSTING",
  "JOBS.EXTERNAL_APPLICATION_DECEPTION",
  "JOBS.FAKE_EMPLOYER_OR_AUTHORITY",
  "JOBS.MISLEADING_COMPENSATION",
  "JOBS.MONEY_MULE_OR_RESHIPPING",
  "JOBS.NONEXISTENT_OR_MISREPRESENTED_ROLE",
  "JOBS.SENSITIVE_INFORMATION_ABUSE",
  "JOBS.UNSAFE_TEEN_OPPORTUNITY",
  "PRIVACY.AUTHENTICATION_SECRET",
  "PRIVACY.FINANCIAL_INFORMATION",
  "PRIVACY.GOVERNMENT_IDENTIFIER",
  "PRIVACY.MEDICAL_OR_VULNERABILITY_INFORMATION",
  "PRIVACY.UNAUTHORIZED_DIRECTORY_OR_EXPORT",
  "ROOM.ILLEGAL_OR_SEVERE_HARM_PURPOSE",
  "SECURITY.ACCOUNT_COMPROMISE",
  "SECURITY.CREDENTIAL_THEFT",
  "SECURITY.EXPLOIT_OR_BYPASS",
  "SECURITY.MALWARE",
  "SECURITY.PHISHING",
  "SECURITY.UNAUTHORIZED_SURVEILLANCE",
  "SERVICE.APPOINTMENT_OR_INQUIRY_MISUSE",
  "SERVICE.DECEPTIVE_LEGAL_OR_FINANCIAL_CLAIM",
  "SERVICE.DECEPTIVE_PRICE_OR_FEE",
  "SERVICE.FALSE_CREDENTIAL",
  "SERVICE.FALSE_RESULT_OR_PORTFOLIO",
  "SERVICE.ILLEGAL_OR_DANGEROUS_WORK",
  "SERVICE.PRIVACY_OR_INTAKE_ABUSE",
  "SERVICE.UNLICENSED_OR_OUT_OF_SCOPE",
  "VIOLENCE.OPERATIONAL_FACILITATION",
  "VIOLENCE.WEAPON_WRONGDOING",
] as const;

export type CanonicalCommerceSafetyReasonCode =
  (typeof CANONICAL_COMMERCE_SAFETY_REASON_CODES)[number];

export const POLICY_SEVERITY_CODES = [
  "POLICY.S0",
  "POLICY.S1",
  "POLICY.S2",
  "POLICY.S3",
  "POLICY.S4",
  "POLICY.S5",
] as const;

export type PolicySeverityCode = (typeof POLICY_SEVERITY_CODES)[number];

export const TRUST_SAFETY_TRIAGE_SEVERITY_CODES = [
  "TS.S1_CRITICAL",
  "TS.S2_HIGH",
  "TS.S3_ELEVATED",
  "TS.S4_STANDARD",
] as const;

export type TrustSafetyTriageSeverityCode =
  (typeof TRUST_SAFETY_TRIAGE_SEVERITY_CODES)[number];

type CategoryDefinition = {
  id: CommerceCategoryId;
  title: string;
  internalLabel: string;
  safetyReasonCodes: readonly CanonicalCommerceSafetyReasonCode[];
  moduleApplicability: Record<
    CommerceIntegritySourceModule,
    CommerceModuleApplicability
  >;
};

export const COMMERCE_INTEGRITY_CATEGORIES = {
  "COM-01": {
    id: "COM-01",
    title: "Weapons, ammunition, explosives, and dangerous items",
    internalLabel: "Weapons and dangerous items",
    safetyReasonCodes: [
      "GOODS.WEAPON_OR_EXPLOSIVE",
      "VIOLENCE.WEAPON_WRONGDOING",
      "VIOLENCE.OPERATIONAL_FACILITATION",
    ],
    moduleApplicability: {
      marketplace: "primary", businesses: "secondary", services: "primary", requests: "primary", jobs: "secondary",
      events: "secondary", appointments: "secondary", rooms: "secondary", local: "secondary", messages: "primary",
    },
  },
  "COM-02": {
    id: "COM-02",
    title: "Drugs, medicines, intoxicants, and age-restricted products",
    internalLabel: "Drugs, medicines, and age-restricted products",
    safetyReasonCodes: [
      "GOODS.DRUG_OR_CONTROLLED_PRODUCT",
      "GOODS.PRESCRIPTION_OR_REGULATED_MEDICAL",
      "GOODS.AGE_RESTRICTED_PRODUCT",
      "FRAUD.PAYMENT_SCAM",
    ],
    moduleApplicability: {
      marketplace: "primary", businesses: "secondary", services: "primary", requests: "primary", jobs: "secondary",
      events: "secondary", appointments: "secondary", rooms: "secondary", local: "secondary", messages: "primary",
    },
  },
  "COM-03": {
    id: "COM-03",
    title: "Stolen, counterfeit, forged, recalled, unsafe, and infringing goods",
    internalLabel: "Stolen, counterfeit, unsafe, or infringing goods",
    safetyReasonCodes: [
      "GOODS.STOLEN_PROPERTY",
      "GOODS.COUNTERFEIT_OR_FORGED",
      "GOODS.RECALLED_OR_UNSAFE_PRODUCT",
      "IP.COPYRIGHT",
      "IP.TRADEMARK",
      "IP.COUNTERFEIT",
      "FRAUD.IMPERSONATION",
    ],
    moduleApplicability: {
      marketplace: "primary", businesses: "secondary", services: "secondary", requests: "secondary", jobs: "secondary",
      events: "secondary", appointments: "not_applicable", rooms: "secondary", local: "secondary", messages: "primary",
    },
  },
  "COM-04": {
    id: "COM-04",
    title: "Hazardous, environmental, wildlife, and biological materials",
    internalLabel: "Hazardous, environmental, wildlife, or biological materials",
    safetyReasonCodes: [
      "GOODS.HAZARDOUS_MATERIAL",
      "GOODS.WILDLIFE_OR_ENVIRONMENTAL_CONTRABAND",
      "GOODS.RECALLED_OR_UNSAFE_PRODUCT",
    ],
    moduleApplicability: {
      marketplace: "primary", businesses: "secondary", services: "primary", requests: "primary", jobs: "secondary",
      events: "secondary", appointments: "secondary", rooms: "secondary", local: "secondary", messages: "primary",
    },
  },
  "COM-05": {
    id: "COM-05",
    title: "Sexual exploitation, sexual services, trafficking, and coercive labor",
    internalLabel: "Exploitation, trafficking, or coercive labor",
    safetyReasonCodes: [
      "CHILD.SEXUAL_EXPLOITATION_MATERIAL",
      "CHILD.GROOMING",
      "CHILD.SEXUAL_SOLICITATION",
      "CHILD.SEXTORTION",
      "INTIMATE.NONCONSENSUAL_DISTRIBUTION",
      "INTIMATE.SEXTORTION",
      "FRAUD.EMPLOYMENT_SCAM",
    ],
    moduleApplicability: {
      marketplace: "secondary", businesses: "secondary", services: "primary", requests: "primary", jobs: "primary",
      events: "secondary", appointments: "secondary", rooms: "primary", local: "secondary", messages: "primary",
    },
  },
  "COM-06": {
    id: "COM-06",
    title: "Security, account access, personal data, malware, hacking, and surveillance abuse",
    internalLabel: "Security, account-access, data, or surveillance abuse",
    safetyReasonCodes: [
      "SECURITY.PHISHING",
      "SECURITY.MALWARE",
      "SECURITY.CREDENTIAL_THEFT",
      "SECURITY.ACCOUNT_COMPROMISE",
      "SECURITY.UNAUTHORIZED_SURVEILLANCE",
      "SECURITY.EXPLOIT_OR_BYPASS",
      "GOODS.PERSONAL_DATA_OR_ACCOUNT_ACCESS",
      "PRIVACY.AUTHENTICATION_SECRET",
      "PRIVACY.UNAUTHORIZED_DIRECTORY_OR_EXPORT",
    ],
    moduleApplicability: {
      marketplace: "primary", businesses: "secondary", services: "primary", requests: "primary", jobs: "primary",
      events: "secondary", appointments: "secondary", rooms: "secondary", local: "secondary", messages: "primary",
    },
  },
  "COM-07": {
    id: "COM-07",
    title: "Gambling, financial schemes, investment promotions, and money-mule activity",
    internalLabel: "Gambling, financial schemes, or money-movement abuse",
    safetyReasonCodes: [
      "FRAUD.INVESTMENT_OR_FINANCIAL_SCHEME",
      "FRAUD.MONEY_MULE_OR_RESHIPPING",
      "FRAUD.PAYMENT_SCAM",
      "JOBS.MONEY_MULE_OR_RESHIPPING",
      "SERVICE.DECEPTIVE_LEGAL_OR_FINANCIAL_CLAIM",
    ],
    moduleApplicability: {
      marketplace: "primary", businesses: "secondary", services: "primary", requests: "primary", jobs: "primary",
      events: "primary", appointments: "secondary", rooms: "secondary", local: "secondary", messages: "primary",
    },
  },
  "COM-08": {
    id: "COM-08",
    title: "Government documents, public benefits, permits, licenses, and credentials",
    internalLabel: "Government documents, benefits, permits, or credentials",
    safetyReasonCodes: [
      "GOODS.GOVERNMENT_DOCUMENT_OR_BENEFIT",
      "SERVICE.FALSE_CREDENTIAL",
      "FRAUD.IMPERSONATION",
      "PRIVACY.GOVERNMENT_IDENTIFIER",
    ],
    moduleApplicability: {
      marketplace: "primary", businesses: "secondary", services: "primary", requests: "primary", jobs: "primary",
      events: "not_applicable", appointments: "not_applicable", rooms: "secondary", local: "secondary", messages: "primary",
    },
  },
  "COM-09": {
    id: "COM-09",
    title: "Live animals, food, cosmetics, medical devices, and conditionally allowed categories",
    internalLabel: "Conditionally allowed high-risk products",
    safetyReasonCodes: [
      "GOODS.UNAPPROVED_LIVE_ANIMAL_OR_FOOD",
      "GOODS.RECALLED_OR_UNSAFE_PRODUCT",
      "GOODS.PRESCRIPTION_OR_REGULATED_MEDICAL",
      "FRAUD.PAYMENT_SCAM",
    ],
    moduleApplicability: {
      marketplace: "primary", businesses: "primary", services: "secondary", requests: "secondary", jobs: "not_applicable",
      events: "secondary", appointments: "not_applicable", rooms: "secondary", local: "primary", messages: "secondary",
    },
  },
  "COM-10": {
    id: "COM-10",
    title: "Illegal, dangerous, and unsafe services",
    internalLabel: "Illegal or dangerous services",
    safetyReasonCodes: [
      "SERVICE.ILLEGAL_OR_DANGEROUS_WORK",
      "VIOLENCE.OPERATIONAL_FACILITATION",
      "SECURITY.EXPLOIT_OR_BYPASS",
      "ROOM.ILLEGAL_OR_SEVERE_HARM_PURPOSE",
    ],
    moduleApplicability: {
      marketplace: "secondary", businesses: "secondary", services: "primary", requests: "primary", jobs: "primary",
      events: "secondary", appointments: "primary", rooms: "primary", local: "secondary", messages: "primary",
    },
  },
  "COM-11": {
    id: "COM-11",
    title: "Professional credentials, licensing, and scope-of-practice integrity",
    internalLabel: "Professional credential or scope-of-practice integrity",
    safetyReasonCodes: [
      "SERVICE.FALSE_CREDENTIAL",
      "SERVICE.UNLICENSED_OR_OUT_OF_SCOPE",
      "FRAUD.IMPERSONATION",
      "JOBS.FAKE_EMPLOYER_OR_AUTHORITY",
    ],
    moduleApplicability: {
      marketplace: "secondary", businesses: "primary", services: "primary", requests: "secondary", jobs: "primary",
      events: "secondary", appointments: "primary", rooms: "secondary", local: "primary", messages: "secondary",
    },
  },
  "COM-12": {
    id: "COM-12",
    title: "Employment integrity, discrimination, recruitment scams, and unsafe opportunities",
    internalLabel: "Employment integrity or recruiting abuse",
    safetyReasonCodes: [
      "JOBS.FAKE_EMPLOYER_OR_AUTHORITY",
      "JOBS.NONEXISTENT_OR_MISREPRESENTED_ROLE",
      "JOBS.APPLICATION_FEE_OR_PAYMENT_SCAM",
      "JOBS.MONEY_MULE_OR_RESHIPPING",
      "JOBS.DISCRIMINATION",
      "JOBS.MISLEADING_COMPENSATION",
      "JOBS.SENSITIVE_INFORMATION_ABUSE",
      "JOBS.UNSAFE_TEEN_OPPORTUNITY",
      "JOBS.EXTERNAL_APPLICATION_DECEPTION",
      "JOBS.DUPLICATE_OR_STALE_POSTING",
    ],
    moduleApplicability: {
      marketplace: "not_applicable", businesses: "secondary", services: "secondary", requests: "secondary", jobs: "primary",
      events: "secondary", appointments: "not_applicable", rooms: "secondary", local: "secondary", messages: "primary",
    },
  },
  "COM-13": {
    id: "COM-13",
    title: "Commercial claims, pricing, fees, endorsements, testimonials, and AI representations",
    internalLabel: "Commercial claims, pricing, testimonials, or AI representations",
    safetyReasonCodes: [
      "SERVICE.DECEPTIVE_PRICE_OR_FEE",
      "SERVICE.FALSE_RESULT_OR_PORTFOLIO",
      "FRAUD.FALSE_TESTIMONIAL_OR_ENDORSEMENT",
      "AI_MEDIA.FALSE_COMMERCIAL_REPRESENTATION",
      "JOBS.MISLEADING_COMPENSATION",
      "INTEGRITY.FAKE_ENGAGEMENT",
    ],
    moduleApplicability: {
      marketplace: "primary", businesses: "primary", services: "primary", requests: "primary", jobs: "primary",
      events: "primary", appointments: "primary", rooms: "secondary", local: "primary", messages: "primary",
    },
  },
  "COM-14": {
    id: "COM-14",
    title: "Duplicate, evasive, manipulative, and off-platform transaction abuse",
    internalLabel: "Duplicate, evasive, or manipulative commerce abuse",
    safetyReasonCodes: [
      "INTEGRITY.DUPLICATE_OR_EVASIVE_REPOSTING",
      "INTEGRITY.SIGNAL_OR_RANKING_MANIPULATION",
      "INTEGRITY.FAKE_ENGAGEMENT",
      "INTEGRITY.BAN_OR_RESTRICTION_EVASION",
      "INTEGRITY.ACCOUNT_NETWORK",
      "ABUSE.REPORT_MISUSE",
    ],
    moduleApplicability: {
      marketplace: "primary", businesses: "primary", services: "primary", requests: "primary", jobs: "primary",
      events: "primary", appointments: "secondary", rooms: "secondary", local: "primary", messages: "primary",
    },
  },
  "COM-15": {
    id: "COM-15",
    title: "Sensitive-data, inquiry, appointment, and professional-intake abuse",
    internalLabel: "Sensitive-data or professional-intake abuse",
    safetyReasonCodes: [
      "SERVICE.PRIVACY_OR_INTAKE_ABUSE",
      "SERVICE.APPOINTMENT_OR_INQUIRY_MISUSE",
      "JOBS.SENSITIVE_INFORMATION_ABUSE",
      "PRIVACY.GOVERNMENT_IDENTIFIER",
      "PRIVACY.FINANCIAL_INFORMATION",
      "PRIVACY.AUTHENTICATION_SECRET",
      "PRIVACY.MEDICAL_OR_VULNERABILITY_INFORMATION",
    ],
    moduleApplicability: {
      marketplace: "secondary", businesses: "secondary", services: "primary", requests: "primary", jobs: "primary",
      events: "secondary", appointments: "primary", rooms: "secondary", local: "secondary", messages: "primary",
    },
  },
} as const satisfies Record<CommerceCategoryId, CategoryDefinition>;

export type CommerceCategoryDefinition =
  (typeof COMMERCE_INTEGRITY_CATEGORIES)[CommerceCategoryId];

export type CommerceClassificationValidationInput = {
  taxonomyVersion: unknown;
  categoryId: unknown;
  sourceModule: unknown;
  primarySafetyReasonCode: unknown;
  secondarySafetyReasonCodes?: readonly unknown[];
  policySeverityCode?: unknown;
  triageSeverityCode?: unknown;
};

export type CommerceClassificationValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function isCommerceIntegrityTaxonomyVersion(
  value: unknown,
): value is typeof COMMERCE_INTEGRITY_TAXONOMY_VERSION {
  return value === COMMERCE_INTEGRITY_TAXONOMY_VERSION;
}

export function isCommerceCategoryId(value: unknown): value is CommerceCategoryId {
  return (
    typeof value === "string" &&
    (COMMERCE_CATEGORY_IDS as readonly string[]).includes(value)
  );
}

export function isCommerceIntegritySourceModule(
  value: unknown,
): value is CommerceIntegritySourceModule {
  return (
    typeof value === "string" &&
    (COMMERCE_INTEGRITY_SOURCE_MODULES as readonly string[]).includes(value)
  );
}

export function isCanonicalCommerceSafetyReasonCode(
  value: unknown,
): value is CanonicalCommerceSafetyReasonCode {
  return (
    typeof value === "string" &&
    (CANONICAL_COMMERCE_SAFETY_REASON_CODES as readonly string[]).includes(value)
  );
}

export function isPolicySeverityCode(value: unknown): value is PolicySeverityCode {
  return (
    typeof value === "string" &&
    (POLICY_SEVERITY_CODES as readonly string[]).includes(value)
  );
}

export function isTrustSafetyTriageSeverityCode(
  value: unknown,
): value is TrustSafetyTriageSeverityCode {
  return (
    typeof value === "string" &&
    (TRUST_SAFETY_TRIAGE_SEVERITY_CODES as readonly string[]).includes(value)
  );
}

export function isAmbiguousBareSeverityCode(value: unknown) {
  return typeof value === "string" && /^S[0-5]$/.test(value);
}

export function getCommerceCategory(categoryId: CommerceCategoryId) {
  return COMMERCE_INTEGRITY_CATEGORIES[categoryId];
}

export function getCommerceModuleApplicability(
  categoryId: CommerceCategoryId,
  sourceModule: CommerceIntegritySourceModule,
): CommerceModuleApplicability {
  return COMMERCE_INTEGRITY_CATEGORIES[categoryId].moduleApplicability[
    sourceModule
  ];
}

export function isCommerceCategoryAllowedForModule(
  categoryId: CommerceCategoryId,
  sourceModule: CommerceIntegritySourceModule,
) {
  return getCommerceModuleApplicability(categoryId, sourceModule) !== "not_applicable";
}

export function isDirectCommerceClassificationSourceModule(
  sourceModule: CommerceIntegritySourceModule,
) {
  return COMMERCE_SOURCE_MODULE_CONTRACT[sourceModule].classificationMode !== "inherited_only";
}

export function isSafetyReasonCompatibleWithCommerceCategory(
  categoryId: CommerceCategoryId,
  reasonCode: CanonicalCommerceSafetyReasonCode,
) {
  return (
    COMMERCE_INTEGRITY_CATEGORIES[categoryId].safetyReasonCodes as readonly string[]
  ).includes(reasonCode);
}

export function validateCommerceClassificationContract(
  input: CommerceClassificationValidationInput,
): CommerceClassificationValidationResult {
  const errors: string[] = [];

  if (!isCommerceIntegrityTaxonomyVersion(input.taxonomyVersion)) {
    errors.push("Unknown commerce taxonomy version.");
  }

  if (!isCommerceCategoryId(input.categoryId)) {
    errors.push("Unknown commerce category id.");
  }

  if (!isCommerceIntegritySourceModule(input.sourceModule)) {
    errors.push("Unsupported commerce source module.");
  }

  if (
    isCommerceIntegritySourceModule(input.sourceModule) &&
    !isDirectCommerceClassificationSourceModule(input.sourceModule)
  ) {
    errors.push(
      "Local records must inherit classification from the underlying source record.",
    );
  }

  if (!isCanonicalCommerceSafetyReasonCode(input.primarySafetyReasonCode)) {
    errors.push("Unknown primary canonical safety reason code.");
  }

  if (
    isCommerceCategoryId(input.categoryId) &&
    isCommerceIntegritySourceModule(input.sourceModule) &&
    !isCommerceCategoryAllowedForModule(input.categoryId, input.sourceModule)
  ) {
    errors.push("Commerce category is not applicable to the source module.");
  }

  if (
    isCommerceCategoryId(input.categoryId) &&
    isCanonicalCommerceSafetyReasonCode(input.primarySafetyReasonCode) &&
    !isSafetyReasonCompatibleWithCommerceCategory(
      input.categoryId,
      input.primarySafetyReasonCode,
    )
  ) {
    errors.push("Primary safety reason is not compatible with the commerce category.");
  }

  for (const reasonCode of input.secondarySafetyReasonCodes ?? []) {
    if (!isCanonicalCommerceSafetyReasonCode(reasonCode)) {
      errors.push("Unknown secondary canonical safety reason code.");
      continue;
    }

    if (
      isCommerceCategoryId(input.categoryId) &&
      !isSafetyReasonCompatibleWithCommerceCategory(input.categoryId, reasonCode)
    ) {
      errors.push(
        `Secondary safety reason ${reasonCode} is not compatible with the commerce category.`,
      );
    }
  }

  if (input.policySeverityCode !== undefined) {
    if (isAmbiguousBareSeverityCode(input.policySeverityCode)) {
      errors.push("Policy severity must use the POLICY.S# namespace.");
    } else if (!isPolicySeverityCode(input.policySeverityCode)) {
      errors.push("Unknown policy severity code.");
    }
  }

  if (input.triageSeverityCode !== undefined) {
    if (isAmbiguousBareSeverityCode(input.triageSeverityCode)) {
      errors.push("Trust and Safety triage severity must use the TS.S#_* namespace.");
    } else if (!isTrustSafetyTriageSeverityCode(input.triageSeverityCode)) {
      errors.push("Unknown Trust and Safety triage severity code.");
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
