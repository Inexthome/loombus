import fs from "node:fs";

const senderPolicy = fs.readFileSync("src/lib/email-senders.ts", "utf8");
const welcomeRoute = fs.readFileSync(
  "src/app/api/email/welcome/send/route.ts",
  "utf8"
);
const broadcastRoute = fs.readFileSync(
  "src/app/api/admin/member-email/route.ts",
  "utf8"
);
const digestDelivery = fs.readFileSync("src/lib/room-digest-delivery.ts", "utf8");
const agents = fs.readFileSync("AGENTS.md", "utf8");

const requiredSystemSenders = [
  "hello@mail.loombus.com",
  "notifications@mail.loombus.com",
  "billing@mail.loombus.com",
  "security@mail.loombus.com",
  "no-reply@mail.loombus.com",
];

for (const sender of requiredSystemSenders) {
  if (!senderPolicy.includes(sender)) {
    throw new Error(`Missing standardized Loombus system sender: ${sender}`);
  }
}

if (!senderPolicy.includes('endsWith("@mail.loombus.com")')) {
  throw new Error("Email sender overrides are not restricted to mail.loombus.com.");
}

if (!welcomeRoute.includes('getLoombusEmailIdentity("product")')) {
  throw new Error("Welcome email must use the centralized product sender identity.");
}

if (!welcomeRoute.includes("reply_to")) {
  throw new Error("Welcome email must preserve the monitored Reply-To destination.");
}

if (!broadcastRoute.includes("hello@mail.loombus.com")) {
  throw new Error("Member broadcast fallback must remain on mail.loombus.com.");
}

if (/DEFAULT_FROM\s*=\s*["'][^"']+@loombus\.com/i.test(broadcastRoute)) {
  throw new Error("Member broadcast cannot use a root @loombus.com From address.");
}

if (!digestDelivery.includes("DIGEST_FROM_EMAIL")) {
  throw new Error("Room digest delivery must use the standardized digest sender configuration.");
}

if (!agents.includes("All application-generated outbound email must use the verified `mail.loombus.com` sending domain")) {
  throw new Error("Repository agent guidance is missing the outbound email domain policy.");
}

console.log("Loombus outbound email sender policy verified.");
