import fs from "node:fs";

const paths = {
  directory: "src/components/business-directory-page.tsx",
  profile: "src/components/business-profile-page.tsx",
  overview: "src/components/business-profile-overview.tsx",
  services: "src/components/business-profile-services.tsx",
  accountability: "src/components/business-profile-accountability.tsx",
  manager: "src/components/business-manager-page.tsx",
  records: "src/components/business-listings-panel.tsx",
  editor: "src/components/business-listing-editor.tsx",
  fields: "src/components/business-listing-fields.tsx",
  location: "src/components/business-listing-location.tsx",
  serviceEditor: "src/components/business-listing-services.tsx",
  servicesManager: "src/components/services-manager-page.tsx",
  servicesManageRoute: "src/app/services/manage/page.tsx",
};

const files = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, fs.readFileSync(path, "utf8")]));

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Unexpected ${label}: ${needle}`);
}

requireText(files.directory, 'data-business-editorial="directory"', "directory Editorial scope");
requireText(files.profile, 'data-business-editorial="profile"', "profile Editorial scope");
requireText(files.manager, 'data-business-editorial="manage"', "manager Editorial scope");
requireText(files.servicesManager, 'data-services-editorial="manage"', "Services manager Editorial scope");
requireText(files.servicesManageRoute, 'ServicesManagerPage', "Services manager route");
requireText(files.directory, '/api/businesses?', "directory API");
requireText(files.profile, '/api/businesses?slug=', "profile API");
requireText(files.profile, 'action: "claim"', "claim action");
requireText(files.profile, 'action: "report"', "report action");
requireText(files.manager, '/api/businesses?manage=1', "management API");
requireText(files.manager, 'action: editingId ? "update" : "create"', "create/update action");
requireText(files.manager, 'BusinessModerationPanel', "admin moderation preservation");
requireText(files.servicesManager, 'providerServicesAuthorizedFetch', "Services authorized fetch");
requireText(files.servicesManager, '"/api/services?manage=1"', "Services management API");
requireText(files.servicesManager, '"/api/services/attachments"', "Services attachment API");
requireText(files.servicesManager, '"/api/requests"', "Services matching Request response API");
requireText(files.servicesManager, 'professional_matching', "professional matching entitlement");
requireText(files.servicesManager, 'professional_portfolio', "professional portfolio entitlement");
requireText(files.directory, 'bg-[color:var(--loombus-page-bg)]', "original Loombus background");
requireText(files.manager, 'border-b-2 border-[color:var(--loombus-gold)]', "Editorial active tab");
requireText(files.servicesManager, 'border-b-2 border-[color:var(--loombus-gold)]', "Services Editorial active tab");
requireText(files.fields, 'focus:border-[var(--loombus-gold)]', "Editorial field focus");
requireText(files.location, 'focus:border-[var(--loombus-gold)]', "Editorial location focus");
requireText(files.serviceEditor, 'divide-y divide-[var(--loombus-border)]', "divider-led service editor");
requireText(files.records, 'divide-y divide-[color:var(--loombus-border)]', "divider-led business records");
requireText(files.services, 'divide-y divide-[color:var(--loombus-border)]', "divider-led public services");
requireText(files.servicesManager, 'divide-y divide-[color:var(--loombus-border-muted)]', "divider-led Services records");

for (const [name, source] of Object.entries(files)) {
  forbidText(source, 'shadow-xl', `${name} dashboard shadow`);
  forbidText(source, 'shadow-2xl', `${name} dashboard shadow`);
  forbidText(source, 'rounded-[1.75rem]', `${name} legacy large card shell`);
  forbidText(source, 'xl:sticky', `${name} sticky dashboard rail`);
  forbidText(source, 'radial-gradient', `${name} decorative dashboard gradient`);
}

console.log("Businesses and Services management Editorial UI verification passed.");
