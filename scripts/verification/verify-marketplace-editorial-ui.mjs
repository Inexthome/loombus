import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const check = (value, message) => {
  if (!value) throw new Error(message);
};

const directoryPage = read("src/app/marketplace/page.tsx");
const detailPage = read("src/app/marketplace/[slug]/page.tsx");
const managePage = read("src/app/marketplace/manage/page.tsx");
const savedPage = read("src/app/marketplace/saved/page.tsx");
const editorial = read("src/app/marketplace/marketplace-editorial.css");

for (const [name, source] of [
  ["directory", directoryPage],
  ["detail", detailPage],
  ["manage", managePage],
  ["saved", savedPage],
]) {
  check(
    source.includes(`data-marketplace-editorial=\"${name}\"`),
    `Marketplace ${name} route is missing its Editorial UI scope.`
  );
  check(
    source.includes("marketplace-editorial.css"),
    `Marketplace ${name} route is missing the shared Editorial UI stylesheet.`
  );
}

check(
  editorial.includes("background: var(--loombus-page-bg)") &&
    !editorial.includes("background: #FEFBEC") &&
    !editorial.includes("background: #fefbec"),
  "Marketplace Editorial UI must preserve the existing page background instead of forcing Cream."
);

check(
  editorial.includes("--marketplace-editorial-accent: #cbab5b") &&
    editorial.includes("border-block") &&
    editorial.includes("box-shadow: none") &&
    editorial.includes("prefers-reduced-motion") &&
    editorial.includes(":focus-visible"),
  "Marketplace Editorial UI hierarchy, Gold accent, focus, or reduced-motion treatment is incomplete."
);

check(
  detailPage.includes('listing.status === "reserved"') &&
    detailPage.includes('listing.status === "published"') &&
    detailPage.includes("MarketplacePickupScheduler") &&
    detailPage.includes("MarketplaceTrustActions"),
  "Marketplace detail Reserved/pickup/trust behavior was not preserved."
);

console.log("Marketplace Editorial UI verification passed.");
