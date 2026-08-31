import fs from "node:fs";

const layoutPath = "src/app/messages/layout.tsx";
const pagePath = "src/app/messages/page.tsx";
const clientPath = "src/app/messages/messages-v2-client.tsx";
const componentsPath = "src/app/messages/messages-v2-components.tsx";
const hookPath = "src/app/messages/use-messages-v2.ts";
const cssPath = "src/app/messages/messages-editorial.css";

const layout = fs.readFileSync(layoutPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const client = fs.readFileSync(clientPath, "utf8");
const components = fs.readFileSync(componentsPath, "utf8");
const hook = fs.readFileSync(hookPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(layout, 'import "./messages-v2.css"', "Messages must retain its base interaction styles.");
requireText(layout, 'import "./messages-editorial.css"', "Messages must load the Editorial UI layer.");
requireText(layout, "data-loombus-messages-editorial", "Messages must expose the Editorial route scope.");
requireText(page, "<MessagesV2Client />", "Messages route composition changed unexpectedly.");

requireText(css, "#FEFBEC", "Messages Light/System-light Editorial surface must use Loombus Cream.");
requireText(css, "#CBAB5B", "Messages Editorial accents must use canonical Loombus Gold.");
requireText(css, ".messages-v2-workspace", "Messages must preserve its integrated inbox/thread/details workspace.");
requireText(css, "border-bottom: 2px solid transparent", "Inbox filters must use text-led Editorial tabs.");
requireText(css, ".messages-v2-message-bubble", "Messages must retain discrete conversation bubbles.");
requireText(css, ".messages-v2-composer", "Messages must retain an integrated composer surface.");
requireText(css, "@media (prefers-reduced-motion: reduce)", "Messages must preserve reduced-motion behavior.");

requireText(client, "New message", "New-message entry point was removed unexpectedly.");
requireText(client, "AI message assist", "AI message-assist controls were removed unexpectedly.");
requireText(client, 'href={`/marketplace/${encodeURIComponent(marketplaceContext.slug)}`}', "Marketplace conversation context link changed unexpectedly.");
requireText(client, "MESSAGE_REPORT_REASONS.map", "Conversation reporting reasons were removed unexpectedly.");
requireText(components, "ConversationListItem", "Conversation list behavior changed unexpectedly.");
requireText(components, "MessageAttachmentCard", "Message attachment rendering changed unexpectedly.");
requireText(components, "PrivateMessagingNote", "Private-message policy guidance changed unexpectedly.");

requireText(hook, 'fetch("/api/messages/conversations"', "Conversation API contract changed unexpectedly.");
requireText(hook, 'fetch("/api/messages/mark-read"', "Read-state API contract changed unexpectedly.");
requireText(hook, 'fetch("/api/messages/send"', "Send-message API contract changed unexpectedly.");
requireText(hook, 'fetch("/api/messages/attachments"', "Attachment API contract changed unexpectedly.");
requireText(hook, 'fetch("/api/messages/mute"', "Mute API contract changed unexpectedly.");
requireText(hook, 'fetch(`/api/messages/${action}`', "Archive/report/delete action contract changed unexpectedly.");
requireText(hook, 'url.searchParams.set("conversation", conversationId)', "Conversation URL-state behavior changed unexpectedly.");
requireText(hook, 'supabase.channel(`private-message-typing:${selectedConversationId}`)', "Typing indicator channel changed unexpectedly.");

forbid(css, /radial-gradient/, "Messages Editorial UI must not restore the legacy decorative page gradient.");
forbid(css, /messages-v2-(?:inbox-panel|thread-panel|details-card)[\s\S]{0,220}box-shadow:\s*0\s+24px\s+75px/, "Messages Editorial primary workspace must remain flat.");

console.log("Messages Editorial UI verification passed.");
