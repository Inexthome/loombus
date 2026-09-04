export const LEGAL_ORIGIN = "https://legal.loombus.com";

export const LEGAL_LINKS = {
  center: LEGAL_ORIGIN,
  privacy: `${LEGAL_ORIGIN}/privacy`,
  terms: `${LEGAL_ORIGIN}/terms`,
  communityGuidelines: `${LEGAL_ORIGIN}/community-guidelines`,
  cookies: `${LEGAL_ORIGIN}/cookies`,
  refunds: `${LEGAL_ORIGIN}/refunds`,
  dmca: `${LEGAL_ORIGIN}/dmca`,
  accessibility: `${LEGAL_ORIGIN}/accessibility`,
} as const;

export type LegalLinkKey = keyof typeof LEGAL_LINKS;
