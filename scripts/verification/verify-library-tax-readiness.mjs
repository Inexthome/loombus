import fs from "node:fs";

const files = {
  taxGate: "src/lib/library-tax-readiness-server.ts",
  checkoutRoute: "src/app/api/library/checkout/route.ts",
  envExample: ".env.example",
  docs: "docs/library-tax-readiness.md",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library tax readiness file: ${path}`);
}

const taxGate = fs.readFileSync(files.taxGate, "utf8");
const checkoutRoute = fs.readFileSync(files.checkoutRoute, "utf8");
const envExample = fs.readFileSync(files.envExample, "utf8");
const docs = fs.readFileSync(files.docs, "utf8");

for (const fragment of [
  "LOOMBUS_LIBRARY_TAX_MODE",
  '"external_acknowledged"',
  '"platform_stripe_tax"',
  "library_tax_posture_unconfigured",
  "library_tax_posture_invalid",
  "library_platform_tax_flow_not_ready",
]) {
  if (!taxGate.includes(fragment)) throw new Error(`Missing fail-closed tax contract: ${fragment}`);
}

if (!checkoutRoute.includes("assertLibraryTaxCheckoutReady();")) {
  throw new Error("Paid Library checkout must enforce the tax readiness gate before creating Stripe Checkout.");
}

const gateIndex = checkoutRoute.indexOf("assertLibraryTaxCheckoutReady();");
const checkoutIndex = checkoutRoute.indexOf("createLibraryCheckout({");
if (gateIndex < 0 || checkoutIndex < 0 || gateIndex > checkoutIndex) {
  throw new Error("Library tax readiness must be checked before Stripe checkout creation.");
}

for (const fragment of [
  "LOOMBUS_LIBRARY_TAX_MODE=",
  "external_acknowledged",
  "platform_stripe_tax",
]) {
  if (!envExample.includes(fragment)) throw new Error(`Missing Library tax environment documentation: ${fragment}`);
}

for (const fragment of [
  "destination charges",
  "transfer reversal",
  "refund",
  "fail-closed",
]) {
  if (!docs.toLowerCase().includes(fragment.toLowerCase())) {
    throw new Error(`Missing Library tax readiness documentation: ${fragment}`);
  }
}

if (checkoutRoute.includes("automatic_tax") || taxGate.includes("automatic_tax")) {
  throw new Error("Stripe automatic tax must not be enabled until destination-charge withholding and refund reversal are complete.");
}

console.log("Library tax readiness verification passed.");
