import fs from "node:fs";

const files = {
  taxGate: "src/lib/library-tax-readiness-server.ts",
  checkoutRoute: "src/app/api/library/checkout/route.ts",
  commerceServer: "src/lib/library-commerce-server.ts",
  commerceEvents: "src/lib/library-commerce-events-server.ts",
  commerceRoute: "src/app/api/library/commerce/route.ts",
  adminRefund: "src/app/api/admin/library/purchases/refund/route.ts",
  taxMigration: "supabase/migrations/20260902082000_add_library_tax_audit.sql",
  envExample: ".env.example",
  docs: "docs/library-tax-readiness.md",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library tax lifecycle file: ${path}`);
}

const taxGate = fs.readFileSync(files.taxGate, "utf8");
const checkoutRoute = fs.readFileSync(files.checkoutRoute, "utf8");
const commerceServer = fs.readFileSync(files.commerceServer, "utf8");
const commerceEvents = fs.readFileSync(files.commerceEvents, "utf8");
const commerceRoute = fs.readFileSync(files.commerceRoute, "utf8");
const adminRefund = fs.readFileSync(files.adminRefund, "utf8");
const taxMigration = fs.readFileSync(files.taxMigration, "utf8");
const envExample = fs.readFileSync(files.envExample, "utf8");
const docs = fs.readFileSync(files.docs, "utf8");

for (const fragment of [
  "LOOMBUS_LIBRARY_TAX_MODE",
  "LOOMBUS_LIBRARY_TAX_LEDGER_READY",
  "LOOMBUS_LIBRARY_STRIPE_TAX_CODE",
  '"external_acknowledged"',
  '"platform_stripe_tax"',
  "library_tax_posture_unconfigured",
  "library_tax_posture_invalid",
  "library_tax_ledger_not_ready",
  "library_tax_code_unconfigured",
]) {
  if (!taxGate.includes(fragment)) throw new Error(`Missing fail-closed tax contract: ${fragment}`);
}

for (const fragment of [
  "const tax = assertLibraryTaxCheckoutReady();",
  "taxMode: tax.mode",
  "productTaxCode: tax.productTaxCode",
]) {
  if (!checkoutRoute.includes(fragment)) throw new Error(`Missing checkout tax configuration contract: ${fragment}`);
}

for (const fragment of [
  'automatic_tax: { enabled: true, liability: { type: "self" as const } }',
  "tax_code: input.productTaxCode",
  "session.amount_subtotal !== reservation.amount_cents",
  "session.total_details?.amount_tax",
  "stripe().transfers.createReversal",
  "loombus-library-tax-${session.id}",
  "stripe_tax_transfer_reversal_id",
  "tax_withheld_at",
]) {
  if (!commerceServer.includes(fragment)) throw new Error(`Missing platform Stripe Tax lifecycle contract: ${fragment}`);
}

for (const fragment of [
  "reconcileFullDestinationChargeLoss",
  "transfer.amount - transfer.amount_reversed",
  "fee.amount - fee.amount_refunded",
  'reason: "refund" | "chargeback"',
  "full_${reason}_reconciliation",
]) {
  if (!commerceEvents.includes(fragment)) throw new Error(`Missing Library loss reconciliation contract: ${fragment}`);
}

for (const fragment of [
  "reverse_transfer: true",
  "refund_application_fee: true",
  "loombus-library-full-refund-${purchase.id}",
]) {
  if (!adminRefund.includes(fragment)) throw new Error(`Missing canonical Library refund contract: ${fragment}`);
}

for (const fragment of [
  "tax_mode",
  "tax_amount_cents",
  "stripe_tax_transfer_reversal_id",
  "tax_withheld_at",
]) {
  if (!taxMigration.includes(fragment)) throw new Error(`Missing Library tax audit migration contract: ${fragment}`);
}

for (const fragment of [
  "isLibraryTaxLedgerReady()",
  "baseLedgerColumns",
  "tax_mode,tax_amount_cents",
  "tax_amount_cents: Number(row.tax_amount_cents ?? 0)",
]) {
  if (!commerceRoute.includes(fragment)) throw new Error(`Missing pre-migration Library commerce compatibility: ${fragment}`);
}

for (const fragment of [
  "LOOMBUS_LIBRARY_TAX_MODE=",
  "LOOMBUS_LIBRARY_TAX_LEDGER_READY=false",
  "LOOMBUS_LIBRARY_STRIPE_TAX_CODE=",
  "platform_stripe_tax",
]) {
  if (!envExample.includes(fragment)) throw new Error(`Missing Library tax environment documentation: ${fragment}`);
}

for (const fragment of [
  "destination-charge",
  "transfer reversal",
  "chargeback",
  "partial refunds",
  "Stripe Dashboard requirements",
  "LOOMBUS_LIBRARY_TAX_LEDGER_READY=true",
]) {
  if (!docs.toLowerCase().includes(fragment.toLowerCase())) {
    throw new Error(`Missing Library tax lifecycle documentation: ${fragment}`);
  }
}

console.log("Library Stripe Tax lifecycle verification passed.");
