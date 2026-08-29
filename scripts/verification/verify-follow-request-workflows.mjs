import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function assertExcludes(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Unexpected ${label}: ${needle}`);
}

const requestsRoute = read("src/app/api/follows/requests/route.ts");
const people = read("src/app/people/people-editorial-client.tsx");
const peopleRequests = read("src/app/people/people-follow-requests-panel.tsx");
const notificationActions = read("src/app/notifications/follow-request-actions.tsx");
const privacySettings = read("src/components/member-privacy-settings-bridge.tsx");

assertIncludes(requestsRoute, 'get("scope") === "all"', "optional received/sent request scope");
assertIncludes(requestsRoute, "receivedRequests", "received request payload");
assertIncludes(requestsRoute, "sentRequests", "sent request payload");
assertIncludes(requestsRoute, '.eq("requester_id", user.id)', "sent request ownership query");
assertIncludes(requestsRoute, '.eq("target_id", user.id)', "received request ownership query");
assertIncludes(requestsRoute, '["accept", "decline"]', "received request decision contract");
assertIncludes(requestsRoute, "clearFollowRequestNotification", "notification cleanup after decision");

assertIncludes(people, '["requests", "Requests"]', "People Requests navigation label");
assertIncludes(people, "<PeopleFollowRequestsPanel />", "People Requests manager mount");
assertIncludes(people, 'get("view")', "People request deep-link support");
assertIncludes(people, 'url.searchParams.set("view", view)', "People view URL synchronization");
assertIncludes(peopleRequests, 'fetch("/api/follows/requests?scope=all"', "People authoritative request load");
assertIncludes(peopleRequests, 'role="tab"', "Received/Sent request tabs");
assertIncludes(peopleRequests, "Received", "received request management");
assertIncludes(peopleRequests, "Sent", "sent request management");
assertIncludes(peopleRequests, 'body: JSON.stringify({ requestId: request.id, action })', "People approve/decline request contract");
assertIncludes(peopleRequests, 'fetch("/api/follows/toggle"', "sent request cancellation contract");
assertIncludes(peopleRequests, "Cancel request", "sent request cancel action");
assertIncludes(peopleRequests, "Approve", "received request approve action");
assertIncludes(peopleRequests, "Decline", "received request decline action");

assertIncludes(notificationActions, "Approve or decline directly from Notifications.", "notification decision ownership");
assertIncludes(notificationActions, 'href="/people?view=requests&request=received"', "Notifications to People request manager link");
assertIncludes(notificationActions, 'fetch("/api/follows/requests"', "notification decision endpoint");
assertIncludes(notificationActions, "Approve", "notification approve action");
assertIncludes(notificationActions, "Decline", "notification decline action");

assertIncludes(privacySettings, "pendingRequestCount", "Settings pending request summary");
assertIncludes(privacySettings, 'href="/people?view=requests&request=received"', "Settings request manager link");
assertIncludes(privacySettings, "Settings only controls whether approval is required.", "Settings ownership boundary copy");
assertExcludes(privacySettings, "respondToRequest", "individual follow decisions inside Settings");
assertExcludes(privacySettings, "ProfileAvatar", "follow request people list inside Settings");

console.log("Follow request workflow verification passed.");
