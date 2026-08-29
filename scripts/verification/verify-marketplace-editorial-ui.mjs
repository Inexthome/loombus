import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const check = (value, message) => {
  if (!value) throw new Error(message);
};

const directoryPage = read("src/app/marketplace/page.tsx");
const detailPage = read("src/app/marketplace/[slug]/page.tsx");
const idRedirectPage = read("src/app/marketplace/listing/[id]/page.tsx");
const manageRoute = read("src/app/marketplace/manage/page.tsx");
const savedRoute = read("src/app/marketplace/saved/page.tsx");
const safetyRoute = read("src/app/marketplace/safety/page.tsx");
const manager = read("src/components/marketplace-manager-page.tsx");
const listingEditor = read("src/components/marketplace-listing-editor.tsx");
const adminMetrics = read("src/components/marketplace-admin-metrics.tsx");
const listingDetail = read("src/components/marketplace-listing-page.tsx");
const saved = read("src/components/marketplace-saved-page.tsx");
const editorial = read("src/app/marketplace/marketplace-editorial.css");

for (const [name, source] of [
  ["directory", directoryPage],
  ["detail", detailPage],
  ["manage", manageRoute],
  ["saved", savedRoute],
  ["safety", safetyRoute],
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
    editorial.includes("box-shadow: none") &&
    editorial.includes("prefers-reduced-motion") &&
    editorial.includes(":focus-visible"),
  "Marketplace Editorial UI Gold accent, focus, or reduced-motion treatment is incomplete."
);

check(
  detailPage.includes('listing.status === "reserved"') &&
    detailPage.includes('listing.status === "published"') &&
    detailPage.includes("MarketplacePickupScheduler") &&
    detailPage.includes("MarketplaceTrustActions") &&
    listingDetail.includes("MarketplaceSellerContactActions") &&
    editorial.includes('data-marketplace-editorial="detail"') &&
    editorial.includes('xl:grid-cols-[minmax(0,1fr)_22rem]'),
  "Marketplace detail Editorial UI or Reserved/pickup/trust behavior is incomplete."
);

check(
  idRedirectPage.includes("findPublicMarketplaceListingById") &&
    idRedirectPage.includes("/marketplace/${listing.slug}") &&
    idRedirectPage.includes("compatibility entry point"),
  "Marketplace ID route must hand off to the canonical Editorial listing detail surface."
);

check(
  saved.includes('marketplaceAuthorizedFetch(') &&
    saved.includes('"/api/marketplace/watchlist"') &&
    saved.includes('listing.status === "reserved"') &&
    saved.includes('aria-label="Saved Marketplace views"') &&
    !saved.includes('xl:grid-cols-[minmax(0,1fr)_20rem]'),
  "Saved Marketplace Editorial UI or watchlist behavior is incomplete."
);

check(
  manager.includes('marketplaceApiAction') &&
    manager.includes('MarketplaceSellerListings') &&
    manager.includes('MarketplaceListingEditor') &&
    manager.includes('MarketplaceAdminReview') &&
    manager.includes('const reservedCount = statusCounts.get("reserved")') &&
    manager.includes('aria-label="Marketplace management workspace"') &&
    !manager.includes('xl:grid-cols-[minmax(0,1fr)_20rem]'),
  "Marketplace management Editorial UI or lifecycle behavior is incomplete."
);

check(
  listingEditor.includes('const editorialInputClass =') &&
    listingEditor.includes('border-b border-[color:var(--loombus-border)] bg-transparent') &&
    listingEditor.includes('aria-expanded={formOpen}') &&
    listingEditor.includes('uploadPhotos') &&
    listingEditor.includes('removePhoto') &&
    listingEditor.includes('saveDraft') &&
    listingEditor.includes('submitListing') &&
    !listingEditor.includes('shadow-xl shadow-black/10') &&
    !listingEditor.includes('rounded-[1.75rem]'),
  "Marketplace create/edit listing form has not been fully migrated to the Editorial UI."
);

check(
  adminMetrics.includes('if (state === "unavailable") return null') &&
    adminMetrics.includes('aria-labelledby="marketplace-diagnostics-heading"') &&
    !adminMetrics.includes("AdminMetricCard") &&
    !adminMetrics.includes("AdminQueueSection"),
  "Marketplace diagnostics still use the legacy admin-card presentation or expose unavailable metrics to sellers."
);

check(
  safetyRoute.includes("Transactions remain between buyer and seller") &&
    safetyRoute.includes("Loombus does not process Marketplace payments") &&
    safetyRoute.includes("/marketplace/manage") &&
    safetyRoute.includes("/guidelines") &&
    !safetyRoute.includes("CommerceSafetyPage"),
  "Marketplace Safety Editorial UI or transaction-boundary guidance is incomplete."
);

console.log("Marketplace Editorial UI verification passed for all Marketplace routes.");
