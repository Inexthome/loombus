import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const check = (value, message) => {
  if (!value) throw new Error(message);
};

const marketplace = read("src/lib/marketplace.ts");
const normalize = read("src/lib/marketplace-server-normalize.ts");
const readServer = read("src/lib/marketplace-server-read.ts");
const publicServer = read("src/lib/marketplace-public-server.ts");
const lifecycle = read("src/lib/marketplace-server-lifecycle.ts");
const route = read("src/app/api/marketplace/route.ts");
const buyerActions = read("src/components/marketplace-seller-contact-actions.tsx");
const sellerListings = read("src/components/marketplace-seller-listings.tsx");
const migration = read(
  "supabase/migrations/20260829103000_add_marketplace_reserved_lifecycle.sql"
);

check(
  marketplace.includes('| "reserved"') &&
    marketplace.includes('status === "reserved"') &&
    marketplace.includes('return "Reserved"'),
  "Reserved Marketplace status type or label missing."
);
check(
  normalize.includes('"published",\n        "reserved",'),
  "Reserved Marketplace status normalization missing."
);
check(
  readServer.includes('.in("status", ["published", "reserved"])'),
  "Reserved listings are not readable through the public listing route."
);
check(
  publicServer.includes('new Set(["published", "reserved"])') &&
    publicServer.includes('listing.status === "reserved" ? null : listing') &&
    publicServer.includes('.in("status", ["published", "reserved"])'),
  "Reserved public visibility or new-inquiry gate missing."
);
check(
  lifecycle.includes("reserveMarketplaceListing") &&
    lifecycle.includes("releaseMarketplaceListing") &&
    lifecycle.includes('allowedStatuses: ["published"]') &&
    lifecycle.includes('allowedStatuses: ["published", "reserved"]') &&
    lifecycle.includes('allowedStatuses: ["sold", "expired", "removed"]') &&
    lifecycle.includes('.in("status", ["published", "reserved"])'),
  "Guarded Marketplace lifecycle transitions are incomplete."
);
check(
  route.includes('action === "reserve"') &&
    route.includes('action === "release"') &&
    route.includes("markMarketplaceListingSoldSafely") &&
    route.includes("reopenMarketplaceListingSafely") &&
    route.includes("reportMarketplaceListingWithReserved"),
  "Marketplace API is not routing the guarded Reserved lifecycle."
);
check(
  buyerActions.includes('listing.status === "reserved"') &&
    buyerActions.includes("New inquiries are paused"),
  "Reserved buyer-state copy or inquiry pause is missing."
);
check(
  sellerListings.includes("Mark reserved") &&
    sellerListings.includes("Release reservation") &&
    sellerListings.includes('["published", "reserved"].includes(listing.status)') &&
    sellerListings.includes('reservationAction("reserve"') &&
    sellerListings.includes('reservationAction("release"'),
  "Seller Reserved lifecycle controls are incomplete."
);
check(
  migration.includes("'reserved'") &&
    migration.includes("where status in ('published', 'reserved')") &&
    migration.includes("where listing.status in (''published'', ''reserved'')") &&
    migration.includes("listing_row.status not in (''published'', ''reserved'')") &&
    migration.includes("enforce_marketplace_listing_status_transition") &&
    migration.includes("new.status = 'reserved' and old.status <> 'published'") &&
    migration.includes("new.status = 'sold' and old.status not in ('published', 'reserved')"),
  "Marketplace Reserved database contract is incomplete."
);

console.log("Marketplace reserved lifecycle verification passed.");
