import "server-only";

import { LibraryCommerceError } from "@/lib/library-commerce-server";

export type LibraryTaxMode = "external_acknowledged" | "platform_stripe_tax";

export type LibraryTaxCheckoutConfig = {
  mode: LibraryTaxMode;
  productTaxCode: string | null;
};

export function getLibraryTaxMode(): LibraryTaxMode | null {
  const raw = process.env.LOOMBUS_LIBRARY_TAX_MODE;
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (value === "external_acknowledged" || value === "platform_stripe_tax") return value;
  return null;
}

export function isLibraryTaxLedgerReady() {
  return process.env.LOOMBUS_LIBRARY_TAX_LEDGER_READY?.trim().toLowerCase() === "true";
}

export function assertLibraryTaxCheckoutReady(): LibraryTaxCheckoutConfig {
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
    if (!isLibraryTaxLedgerReady()) {
      throw new LibraryCommerceError(
        "Paid Library checkout is temporarily unavailable while the tax ledger migration is completed.",
        503,
        "library_tax_ledger_not_ready"
      );
    }

    const productTaxCode = process.env.LOOMBUS_LIBRARY_STRIPE_TAX_CODE?.trim() || null;
    if (!productTaxCode) {
      throw new LibraryCommerceError(
        "Paid Library checkout is temporarily unavailable because the Library Stripe Tax product classification is not configured.",
        503,
        "library_tax_code_unconfigured"
      );
    }
    return { mode, productTaxCode };
  }

  return { mode, productTaxCode: null };
}
