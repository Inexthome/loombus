import fs from "node:fs";

const checks = [
  ["src/app/premium/page.tsx", ["PremiumV3Client", "premium-editorial.css", "data-premium-editorial"]],
  ["src/app/premium/premium-v3-client.tsx", ["/api/billing/subscription-status", "PremiumPlanCheckoutButton", "BillingPortalButton", "MASTER_SUBSCRIPTION_ENTITLEMENTS"]],
  ["src/app/premium/premium-editorial.css", ["var(--loombus-page-bg)", ".premium-v2-hero", ".premium-v2-plan-grid", ".premium-v2-comparison-card", ":focus-visible", "prefers-reduced-motion"]],
];

for (const [file, needles] of checks) {
  const text = fs.readFileSync(file, "utf8");
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${file} is missing required Editorial UI contract: ${needle}`);
    }
  }
}

const editorial = fs.readFileSync("src/app/premium/premium-editorial.css", "utf8");
if (/radial-gradient|linear-gradient/.test(editorial)) {
  throw new Error("Premium Editorial override must not introduce decorative gradients.");
}
if (editorial.includes("#FEFBEC") || editorial.includes("#fefbec")) {
  throw new Error("Premium page background must remain on the standard Loombus page token, not Cream.");
}

const page = fs.readFileSync("src/app/premium/page.tsx", "utf8");
const order = ["premium-v2.css", "premium-v3.css", "premium-editorial.css"].map((name) => page.indexOf(name));
if (order.some((index) => index < 0) || !(order[0] < order[1] && order[1] < order[2])) {
  throw new Error("Premium Editorial stylesheet must load after the existing Premium styles.");
}

console.log("Premium Editorial UI verification passed.");
