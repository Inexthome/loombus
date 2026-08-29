import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const check = (value, message) => {
  if (!value) throw new Error(message);
};

const listing = read("src/components/marketplace-listing-page.tsx");
const actions = read("src/components/marketplace-seller-contact-actions.tsx");
const trust = read("src/components/marketplace-trust-actions.tsx");
const contact = read("src/app/api/marketplace/contact/route.ts");
const send = read("src/app/api/messages/send/route.ts");
const conversations = read("src/app/api/messages/conversations/route.ts");
const model = read("src/app/messages/messages-v2-model.ts");
const client = read("src/app/messages/messages-v2-client.tsx");
const attachments = read("src/app/api/messages/attachments/route.ts");

check(listing.includes("MarketplaceSellerContactActions"), "Buyer actions missing from listing.");
check(listing.includes('label="Listing active through"'), "Listing expiry label missing.");
check(listing.includes("View seller profile") && !listing.includes("Contact through profile"), "Seller profile ownership is incorrect.");
check(actions.includes("Ask if available") && actions.includes("Message seller"), "Buyer inquiry actions missing.");
check(actions.includes("inquiryType: type") && actions.includes("Open conversation"), "Buyer inquiry routing missing.");
check(contact.includes('"general" | "availability"') && contact.includes("Is this still available?"), "Availability inquiry endpoint support missing.");
check(contact.includes("existingContact?.conversation_id"), "Existing listing conversation reuse missing.");
check(!trust.includes("Message seller") && !trust.includes("/api/marketplace/contact"), "Fixed action bar duplicates seller contact.");
check(send.includes("hasMarketplaceContactThread") && send.includes("if (!marketplaceConversation)"), "Marketplace message continuation rule missing.");
check(conversations.includes("marketplace_contact_threads") && conversations.includes("marketplaceContexts"), "Marketplace conversation context missing.");
check(model.includes("MarketplaceConversationContext") && model.includes("getConversationConnectionLabel"), "Marketplace message model missing.");
check(client.includes("Marketplace inquiry") && client.includes("View Marketplace listing"), "Marketplace message presentation missing.");
check(attachments.includes('from("private_conversation_members")'), "Attachment membership authorization missing.");

console.log("Marketplace buyer inquiry verification passed.");
