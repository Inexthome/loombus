import type { BusinessProfile } from "@/lib/business-directory";

export type UpdateBusinessDraft = <K extends keyof BusinessDraft>(
  key: K,
  value: BusinessDraft[K]
) => void;

export type ServiceDraft = {
  name: string;
  description: string;
  category: string;
  priceText: string;
  bookingUrl: string;
  serviceArea: string;
};

export type BusinessDraft = {
  name: string;
  description: string;
  category: string;
  phone: string;
  contactEmail: string;
  websiteUrl: string;
  bookingUrl: string;
  logoUrl: string;
  coverImageUrl: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  serviceAreaMode: string;
  serviceRadiusMiles: string;
  serviceAreas: string;
  showExactAddress: boolean;
  services: ServiceDraft[];
  unclaimed: boolean;
  publishNow: boolean;
  verified: boolean;
};

export const EMPTY_SERVICE: ServiceDraft = {
  name: "",
  description: "",
  category: "",
  priceText: "",
  bookingUrl: "",
  serviceArea: "",
};

export const EMPTY_DRAFT: BusinessDraft = {
  name: "",
  description: "",
  category: "",
  phone: "",
  contactEmail: "",
  websiteUrl: "",
  bookingUrl: "",
  logoUrl: "",
  coverImageUrl: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "US",
  serviceAreaMode: "storefront",
  serviceRadiusMiles: "",
  serviceAreas: "",
  showExactAddress: false,
  services: [{ ...EMPTY_SERVICE }],
  unclaimed: false,
  publishNow: false,
  verified: false,
};

export function draftFromBusiness(business: BusinessProfile): BusinessDraft {
  return {
    name: business.name,
    description: business.description,
    category: business.category,
    phone: business.phone,
    contactEmail: business.contactEmail,
    websiteUrl: business.websiteUrl,
    bookingUrl: business.bookingUrl,
    logoUrl: business.logoUrl,
    coverImageUrl: business.coverImageUrl,
    addressLine1: business.addressLine1,
    addressLine2: business.addressLine2,
    city: business.city,
    region: business.region,
    postalCode: business.postalCode,
    countryCode: business.countryCode || "US",
    serviceAreaMode: business.serviceAreaMode,
    serviceRadiusMiles: business.serviceRadiusMiles
      ? String(business.serviceRadiusMiles)
      : "",
    serviceAreas: business.serviceAreas.join(", "),
    showExactAddress: business.showExactAddress,
    services:
      business.services.length > 0
        ? business.services.map((service) => ({
            name: service.name,
            description: service.description,
            category: service.category,
            priceText: service.priceText,
            bookingUrl: service.bookingUrl,
            serviceArea: service.serviceArea,
          }))
        : [{ ...EMPTY_SERVICE }],
    unclaimed: business.ownerId === null,
    publishNow: business.status === "published",
    verified: business.verificationStatus === "verified",
  };
}

export function statusLabel(status: BusinessProfile["status"]) {
  if (status === "pending") return "Pending review";
  if (status === "published") return "Published";
  if (status === "rejected") return "Changes requested";
  if (status === "suspended") return "Suspended";
  return "Draft";
}
