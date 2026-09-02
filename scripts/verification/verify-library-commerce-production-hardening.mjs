import fs from "node:fs";

const files = {
  commerceRoute: "src/app/api/library/commerce/route.ts",
  purchaseButton: "src/components/library/library-purchase-button.tsx",
  commerceCenter: "src/components/library/library-commerce-center.tsx",
  askRoute: "src/app/api/library/ask-loombus/route.ts",
  entitlementMigration: "supabase/migrations/20260902071500_harden_library_checkout_entitlements.sql",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library commerce hardening file: ${path}`);
}

const route = fs.readFileSync(files.commerceRoute, "utf8");
const button = fs.readFileSync(files.purchaseButton, "utf8");
const center = fs.readFileSync(files.commerceCenter, "utf8");
const ask = fs.readFileSync(files.askRoute, "utf8");
const migration = fs.readFileSync(files.entitlementMigration, "utf8");

for (const fragment of [
  'row.status === "paid"',
  'row.status === "disputed"',
  "disputed_sale_count",
  "disputed_gross_cents",
  "Unable to load or refresh Library payout state",
]) {
  if (!route.includes(fragment)) throw new Error(`Missing settled-accounting contract: ${fragment}`);
}

if (route.includes('row.status === "paid" || row.status === "disputed"')) {
  throw new Error("Disputed Library sales must not be included in settled earnings totals.");
}

for (const fragment of [
  'import { Capacitor } from "@capacitor/core"',
  "Capacitor.isNativePlatform()",
  "Buy ${formatted} on Loombus.com",
  "Library book purchases are currently available on Loombus.com",
]) {
  if (!button.includes(fragment)) throw new Error(`Missing native checkout guard contract: ${fragment}`);
}

for (const fragment of [
  "Settled sales",
  "Settled gross sales",
  "Settled author share",
  "excluded from settled earnings",
  "Reader entitlement remains active during the dispute",
]) {
  if (!center.includes(fragment)) throw new Error(`Missing commerce disclosure contract: ${fragment}`);
}

for (const fragment of [
  '.from("library_publication_sections")',
  'Authorization: `Bearer ${token}`',
]) {
  if (!ask.includes(fragment)) throw new Error(`Missing authenticated Ask Loombus full-text contract: ${fragment}`);
}

for (const fragment of [
  'library commerce requires publication access',
  'as restrictive',
  'library_current_user_can_access_publication',
]) {
  if (!migration.toLowerCase().includes(fragment.toLowerCase())) {
    throw new Error(`Missing database entitlement boundary: ${fragment}`);
  }
}

console.log("Library commerce production hardening verification passed.");
