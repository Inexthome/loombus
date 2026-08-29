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
const contact = read("src/app/api/marketplace/contact/route.ts");
const listingPage = read("src/app/marketplace/[slug]/page.tsx");
const buyerActions = read("src/components/marketplace-seller-contact-actions.tsx");
const sellerListings = read("src/components/marketplace-seller-listings.tsx");
const directory = read("src/components/marketplace-directory-page.tsx");
const saved = read("src/components/marketplace-saved-page.tsx");
const messagesModel = read("src/app/messages/messages-v2-model.ts");
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
    publicServer.includes('.in("status", ["published", "reserved"])') &&
    !publicServer.includes('listing.status === "reserved" ? null : listing'),
  "Reserved listings are not consistently public across Marketplace identity and contact lookups."
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
  contact.includes('listing.status === "reserved" && type === "availability"') &&
    contact.includes('"listing_reserved"') &&
    contact.includes("You can still message the seller"),
  "Reserved availability inquiries are not blocked server-side without blocking seller messaging."
);
check(
  buyerActions.includes('const reserved = listing.status === "reserved"') &&
    buyerActions.includes("You can still message the seller") &&
    buyerActions.includes("{!reserved ? (") &&
    buyerActions.includes("Ask if available") &&
    buyerActions.includes("Message seller"),
  "Reserved buyer actions do not preserve seller messaging while pausing availability questions."
);
check(
  sellerListings.includes("Mark reserved") &&
    sellerListings.includes("Release reservation") &&
    sellerListings.includes('["published", "reserved"].includes(listing.status)') &&
    sellerListings.includes('reservationAction("reserve"') &&
    sellerListings.includes('reservationAction("release"') &&
    sellerListings.includes("'sold', 'removed', 'reserved'") &&
    sellerListings.includes("buyers can still message you"),
  "Seller Reserved lifecycle controls are incomplete or permit editing before release."
);
check(
  listingPage.includes('listing.pickupAvailable && listing.status === "published"') &&
    listingPage.includes('listing.status === "reserved"') &&
    listingPage.includes("https://schema.org/LimitedAvailability"),
  "Reserved pickup or structured availability behavior is incomplete."
);
check(
  directory.includes('listing.status === "reserved"') &&
    directory.includes("Reserved"),
  "Marketplace discovery does not surface Reserved status."
);
check(
  saved.includes('const reserved = listing.status === "reserved"') &&
    saved.includes('? "Reserved"') &&
    saved.includes("Active or reserved"),
  "Saved Marketplace items do not preserve and label Reserved listings."
);
check(
  messagesModel.includes('context.status === "reserved"') &&
    messagesModel.includes("`Reserved · ${price}`"),
  "Marketplace message context does not surface Reserved status."
);
check(
  migration.includes("'reserved'") &&
    migration.includes("where status in ('published', 'reserved')") &&
    migration.includes("where listing.status in (''published'', ''reserved'')") &&
    migration.includes("listing_row.status not in (''published'', ''reserved'')") &&
    migration.includes("enforce_marketplace_listing_status_transition") &&
    migration.includes("new.status = 'reserved' and old.status <> 'published'") &&
    migration.includes("new.status = 'sold' and old.status not in ('published', 'reserved')") &&
    migration.includes("Release the Marketplace reservation before changing this listing state.") &&
    !migration.includes("'draft',\n      'pending',\n      'sold'"),
  "Marketplace Reserved database contract is incomplete or allows editing without release."
);

console.log("Marketplace reserved lifecycle verification passed.");
