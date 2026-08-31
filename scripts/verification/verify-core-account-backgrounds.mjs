import fs from "node:fs";

const files = {
  profileLayout: fs.readFileSync("src/app/profile/layout.tsx", "utf8"),
  profileCss: fs.readFileSync("src/app/profile/profile-loombus-background.css", "utf8"),
  dashboardLayout: fs.readFileSync("src/app/dashboard/layout.tsx", "utf8"),
  dashboardCss: fs.readFileSync("src/app/dashboard/dashboard-loombus-background.css", "utf8"),
  settingsPage: fs.readFileSync("src/app/settings/page.tsx", "utf8"),
  settingsCss: fs.readFileSync("src/app/settings/settings-loombus-background.css", "utf8"),
};

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

requireText(files.profileLayout, 'import "./profile-loombus-background.css"', "/profile must load its Loombus background override.");
requireText(files.dashboardLayout, 'import "./dashboard-loombus-background.css"', "/dashboard must load its Loombus background override.");
requireText(files.settingsPage, 'import "./settings-loombus-background.css"', "/settings must load its Loombus background override.");

for (const [name, css] of [["profile", files.profileCss], ["dashboard", files.dashboardCss], ["settings", files.settingsCss]]) {
  requireText(css, "background: var(--loombus-page-bg) !important", `${name} must use the standard Loombus page background token.`);
  if (/#[fF][eE][fF][bB][eE][cC]/.test(css)) {
    throw new Error(`${name} background override must not force Loombus Cream.`);
  }
}

console.log("Core account background verification passed.");
