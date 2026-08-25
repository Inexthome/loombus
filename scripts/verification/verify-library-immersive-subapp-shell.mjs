import fs from "node:fs";

const files = {
  boundary: "src/components/app-chrome-boundary.tsx",
  routeClientLayout: "src/app/route-client-layout.tsx",
  layout: "src/app/library/layout.tsx",
  shell: "src/components/library/library-immersive-subapp-shell.tsx",
  css: "src/app/library/library-immersive-shell.css",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing immersive Library shell file: ${path}`);
}

const boundary = fs.readFileSync(files.boundary, "utf8");
const routeClientLayout = fs.readFileSync(files.routeClientLayout, "utf8");
const layout = fs.readFileSync(files.layout, "utf8");
const shell = fs.readFileSync(files.shell, "utf8");
const css = fs.readFileSync(files.css, "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

requireText(boundary, 'pathname === "/library" || pathname.startsWith("/library/")', "Library namespace chrome boundary");
requireText(boundary, "isLibraryPath(pathname)", "Library shell suppression");
requireText(routeClientLayout, 'pathname === "/library" || pathname.startsWith("/library/")', "Library namespace ClientLayout boundary");
requireText(routeClientLayout, "isLibraryPath(pathname)", "legacy ClientLayout suppression");
requireText(routeClientLayout, 'className="library-route-client-boundary"', "Library route bypass wrapper");
requireText(layout, "LibraryImmersiveSubappShell", "Library immersive layout wrapper");
requireText(layout, 'import "./library-immersive-shell.css"', "Library immersive CSS wiring");

requireText(shell, 'pathname.startsWith("/library/read/")', "Reader exception");
requireText(shell, 'if (isReader) return <>{children}</>', "Reader preserved without Library overlay controls");
requireText(shell, 'href="/home"', "Back to Loombus destination");
requireText(shell, 'aria-label="Back to Loombus"', "Back to Loombus control");
requireText(shell, 'const APPEARANCE_KEY = "loombus:appearance"', "existing Loombus appearance preference");
requireText(shell, 'type AppearanceMode = "system" | "light" | "dark"', "System Light Dark appearance modes");
requireText(shell, 'document.documentElement.dataset.loombusTheme = mode', "appearance runtime application");
requireText(shell, 'aria-label="Library navigation"', "single floating Library navigation control");
for (const label of ["Home", "Library", "Discover", "Search", "More", "Want to Read", "Continue Reading", "Finished", "Collections", "Highlights & Notes", "Authors", "Research", "My Publications"]) {
  requireText(shell, label, `Library navigation item ${label}`);
}
requireText(shell, 'href="/library/ask-loombus"', "floating Ask Loombus destination");
requireText(shell, 'aria-label="Ask Loombus"', "floating Ask Loombus control");

requireText(shell, "SCROLL_HIDE_THRESHOLD", "Library auto-hide scroll threshold");
requireText(shell, 'window.addEventListener("scroll", handleScroll, { passive: true })', "Library scroll listener");
requireText(shell, "delta > 3", "hide chrome on downward scroll");
requireText(shell, "delta < -3", "restore chrome on upward scroll");
requireText(shell, "setChromeVisible(false)", "Library chrome hidden state");
requireText(shell, "setChromeVisible(true)", "Library chrome visible state");
requireText(shell, 'data-library-chrome-visible={chromeVisible ? "true" : "false"}', "Library chrome visibility state marker");

requireText(css, 'nav[aria-label="Library sections"]', "legacy mobile Library pills hidden");
requireText(css, 'data-library-search-open="true"', "on-demand Library search reveal");
requireText(css, "env(safe-area-inset-bottom)", "mobile safe-area protection");

for (const forbidden of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "dangerouslySetInnerHTML", "library-publication-originals"]) {
  if (shell.includes(forbidden) || boundary.includes(forbidden) || routeClientLayout.includes(forbidden)) throw new Error(`Forbidden immersive Library shell token: ${forbidden}`);
}

console.log("PASS: Library immersive sub-app shell suppresses both global AppChrome and legacy ClientLayout utilities across /library, preserves Reader controls, auto-hides Library chrome on downward scroll, restores it on upward scroll, exposes explicit exit/appearance/navigation/Ask controls, and adds no schema dependency.");
