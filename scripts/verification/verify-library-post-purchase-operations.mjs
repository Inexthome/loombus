import fs from "node:fs";

const files = {
  receiptRoute: "src/app/api/library/commerce/receipt/route.ts",
  commerceCenter: "src/components/library/library-commerce-center.tsx",
  commerceEvents: "src/lib/library-commerce-events-server.ts",
  entitlementMigration: "supabase/migrations/20260902071500_harden_library_checkout_entitlements.sql",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library post-purchase file: ${path}`);
}

const receiptRoute = fs.readFileSync(files.receiptRoute, "utf8");
const commerceCenter = fs.readFileSync(files.commerceCenter, "utf8");
const commerceEvents = fs.readFileSync(files.commerceEvents, "utf8");
const entitlementMigration = fs.readFileSync(files.entitlementMigration, "utf8");

for (const fragment of [
  "requireMemberUser(request)",
  '.from("library_book_purchases")',
  '.eq("buyer_id", user.id)',
  "stripe_payment_intent_id",
  '{ expand: ["latest_charge"] }',
  "charge.receipt_url",
  '"Cache-Control": "private, no-store"',
]) {
  if (!receiptRoute.includes(fragment)) {
    throw new Error(`Missing buyer-owned receipt contract: ${fragment}`);
  }
}

const purchaseQuery = receiptRoute.slice(
  receiptRoute.indexOf('.from("library_book_purchases")'),
  receiptRoute.indexOf("if (error)")
);
if (purchaseQuery.includes('.eq("seller_id"')) {
  throw new Error("Library receipt retrieval must authorize against buyer ownership, not seller ownership.");
}

for (const fragment of [
  'fetch("/api/library/commerce/receipt"',
  'body: JSON.stringify({ purchaseId })',
  "View Stripe receipt",
  "Payment disputed. Library access remains active",
  "Refunded. Paid full-text access is no longer active.",
  "Chargeback completed. Paid full-text access is no longer active.",
  'href="/support"',
]) {
  if (!commerceCenter.includes(fragment)) {
    throw new Error(`Missing post-purchase recovery UX contract: ${fragment}`);
  }
}

for (const fragment of [
  "library commerce requires publication access",
  "library_current_user_can_access_publication",
  "purchase.status in ('paid', 'disputed')",
]) {
  if (!entitlementMigration.toLowerCase().includes(fragment.toLowerCase())) {
    throw new Error(`Missing active-entitlement contract: ${fragment}`);
  }
}

for (const fragment of [
  'status: "refunded"',
  'status: "chargeback"',
  'status: "disputed"',
]) {
  if (!commerceEvents.includes(fragment)) {
    throw new Error(`Missing payment-lifecycle contract: ${fragment}`);
  }
}

console.log("Library post-purchase operations verification passed.");
