import "server-only";

import { LibraryCommerceError } from "@/lib/library-commerce-server";

export type LibraryTaxMode = "external_acknowledged" | "platform_stripe_tax";

export function getLibraryTaxMode(): LibraryTaxMode | null {
  const raw = process.env.LOOMBUS_LIBRARY_TAX_MODE;
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (value === "external_acknowledged" || value === "platform_stripe_tax") return value;
  return null;
}

export function assertLibraryTaxCheckoutReady() {
  const raw = process.env.LOOMBUS_LIBRARY_TAX_MODE;
  const mode = getLibraryTaxMode();

  if (!raw?.trim()) {
    throw new LibraryCommerceError(
      "Paid Library checkout is temporarily unavailable while Loombus completes its tax configuration.",
      503,
      "library_tax_posture_unconfigured"
    );
  }

  if (!mode) {
    throw new LibraryCommerceError(
      "Paid Library checkout is temporarily unavailable because its tax configuration is invalid.",
      503,
      "library_tax_posture_invalid"
    );
  }

  if (mode === "platform_stripe_tax") {
    throw new LibraryCommerceError(
      "Paid Library checkout is temporarily unavailable while platform tax withholding and refund reversals are being finalized.",
      503,
      "library_platform_tax_flow_not_ready"
    );
  }

  return mode;
}
