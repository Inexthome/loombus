import fs from "node:fs";

const source = fs.readFileSync("src/components/request-detail-page.tsx", "utf8");

function requireText(text, message) {
  if (!source.includes(text)) throw new Error(message);
}

function forbidText(text, message) {
  if (source.includes(text)) throw new Error(message);
}

requireText("var(--loombus-page-bg)", "Request detail must preserve the Loombus page background.");
requireText("border-b border-[color:var(--loombus-border)]", "Request detail divider-led structure missing.");
requireText("requestTypeLabel(item.requestType)", "Request type context missing.");
requireText("requestUrgencyLabel(item.urgency)", "Request urgency context missing.");
requireText("formatRequestBudget(item)", "Request budget context missing.");
requireText("requestLocationLabel(item)", "Request location context missing.");
requireText('action: "respond"', "Request response mutation contract missing.");
requireText('action: "report"', "Request report mutation contract missing.");
requireText('action: item.viewerSaved ? "unsave" : "save"', "Request save/unsave contract missing.");
requireText('href="/requests/manage"', "Request management destination missing.");
requireText('href="/requests/safety"', "Request safety destination missing.");
requireText('href="/services"', "Services destination missing.");
requireText("serviceRequestsAuthorizedFetch", "Authorized Request mutation client missing.");
requireText("serviceRequestsAccessToken", "Authenticated Request loading path missing.");
requireText("item.attachmentUrls", "Request attachments missing.");
requireText("item.viewerCanManage", "Requester management boundary missing.");
requireText("item.viewerHasResponded", "Responder state boundary missing.");
requireText("var(--loombus-gold)", "Restrained Loombus Gold accent missing.");

forbidText("shadow-xl", "Request detail still contains legacy shadow-xl dashboard styling.");
forbidText("shadow-2xl", "Request detail still contains legacy shadow-2xl dashboard styling.");
forbidText("rounded-[1.75rem]", "Request detail still contains legacy large rounded cards.");
forbidText("xl:sticky", "Request detail still contains the legacy sticky action rail.");
forbidText("xl:grid-cols-[minmax(0,1fr)_21rem]", "Request detail still contains the legacy 21rem dashboard rail layout.");
forbidText("focus:ring-4", "Request detail form controls still use legacy rounded-dashboard focus chrome.");
forbidText("radial-gradient", "Request detail must not introduce a radial gradient.");

console.log("Request Detail Editorial UI verification passed.");
