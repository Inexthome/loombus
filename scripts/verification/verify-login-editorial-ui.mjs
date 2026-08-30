import fs from "node:fs";

const page = fs.readFileSync("src/app/login/page.tsx", "utf8");
const layout = fs.readFileSync("src/app/login/layout.tsx", "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Forbidden ${label}: ${needle}`);
}

for (const [needle, label] of [
  ['data-loombus-auth-shell', "auth shell marker"],
  ['data-loombus-login-editorial', "login Editorial marker"],
  ['bg-[color:var(--loombus-page-bg)]', "Loombus page background"],
  ['border-b border-[color:var(--loombus-border)]', "divider-led structure"],
  ['text-[color:var(--loombus-gold)]', "restrained Gold treatment"],
  ['min-h-11', "accessible control target"],
  ['lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]', "responsive Editorial layout"],
  ['focus-visible:outline-[color:var(--loombus-gold)]', "visible keyboard focus"],
  ['getSafeNext', "safe next-path handling"],
  ['value.startsWith("//")', "external redirect rejection"],
  ['restorePersistedSupabaseSession()', "persisted session restoration"],
  ['clearLegacyNativeBiometricLoginCredentials()', "legacy native credential cleanup"],
  ['supabase.auth.signInWithPassword', "email/password authentication"],
  ['saveLoginToSystemPasswordManager', "native password manager handoff"],
  ['supabase.auth.signInWithOAuth', "OAuth authentication"],
  ['provider: "google"', "Google OAuth capability"],
  ['provider: "apple"', "Apple OAuth capability"],
  ['loombus://auth/callback?next=', "iOS native OAuth callback"],
  ['window.location.origin}/auth/callback?next=', "web OAuth callback"],
  ['supabase.auth.resend', "verification resend"],
  ['type: "signup"', "verification resend type"],
  ['href="/forgot-password"', "forgot-password destination"],
  ['href="/signup"', "signup destination"],
  ['href="/terms"', "Terms destination"],
  ['href="/privacy"', "Privacy destination"],
  ['href="/cookies"', "Cookies destination"],
  ['href="/guidelines"', "Guidelines destination"],
  ['href="/safety"', "Safety destination"],
  ['href="/support"', "Support destination"],
]) requireText(page, needle, label);

requireText(layout, 'bg-[color:var(--loombus-page-bg)]', "theme-aware login layout");

for (const forbidden of [
  "bg-black",
  "bg-zinc-950",
  "rounded-3xl",
  "rounded-2xl",
  "rounded-xl",
  "rounded-full",
  "shadow-2xl",
  "linear-gradient",
  "radial-gradient",
]) forbidText(page, forbidden, "legacy card/pill/shadow treatment");

console.log("Login Editorial UI verification passed.");
