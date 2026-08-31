import fs from "node:fs";

const forgotPath = "src/app/forgot-password/page.tsx";
const forgotLayoutPath = "src/app/forgot-password/layout.tsx";
const forgotCssPath = "src/app/forgot-password/forgot-password-editorial.css";
const resetPath = "src/app/reset-password/page.tsx";

const forgot = fs.readFileSync(forgotPath, "utf8");
const forgotLayout = fs.readFileSync(forgotLayoutPath, "utf8");
const forgotCss = fs.readFileSync(forgotCssPath, "utf8");
const reset = fs.readFileSync(resetPath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

for (const [name, source] of [["forgot-password", forgot], ["reset-password", reset]]) {
  requireText(source, "bg-[var(--loombus-page-bg)]", `${name} must use the Loombus page background token.`);
  requireText(source, "border-[color:var(--loombus-border)]", `${name} must use divider-led Editorial structure.`);
  requireText(source, "text-[color:var(--loombus-gold)]", `${name} must use restrained Loombus Gold.`);
  requireText(source, "focus-visible:outline-[color:var(--loombus-gold)]", `${name} must preserve visible keyboard focus.`);
  requireText(source, "min-h-12", `${name} must retain practical primary control sizing.`);
  forbid(source, /rounded-(?:xl|2xl|3xl|full)/, `${name} still contains legacy rounded-card or pill styling.`);
  forbid(source, /shadow-(?:sm|md|lg|xl|2xl)/, `${name} still contains decorative shadows.`);
  forbid(source, /\bbg-black\b|\bbg-zinc-950\b/, `${name} still contains legacy hard-coded black panel styling.`);
}

requireText(forgotLayout, 'import "./forgot-password-editorial.css"', "Forgot-password must load its route-scoped Editorial completion layer.");
requireText(forgotCss, "[data-loombus-password-recovery-editorial]::before", "Forgot-password must suppress the legacy auth-shell decoration.");
requireText(forgotCss, "display: none !important", "Forgot-password legacy decorative pseudo-elements must stay removed.");
requireText(forgotCss, "background: #FEFBEC !important", "Forgot-password Light/System-light must use canonical Loombus Cream.");
requireText(forgotCss, "border-bottom: 1px solid var(--loombus-border) !important", "Forgot-password email input must remain a flat Editorial field.");
requireText(forgotCss, "background: transparent !important", "Forgot-password input/status surfaces must not be forced into legacy raised fields.");
requireText(forgotCss, 'button[type="submit"]', "Forgot-password primary action must have an explicit Editorial override.");
requireText(forgotCss, "background: #CBAB5B !important", "Forgot-password primary action must use canonical Loombus Gold.");
requireText(forgotCss, "box-shadow: none !important", "Forgot-password must neutralize legacy decorative shadows.");
requireText(forgotCss, "prefers-reduced-motion: reduce", "Forgot-password must preserve reduced-motion handling.");

requireText(forgot, "supabase.auth.resetPasswordForEmail(email.trim()", "Password recovery email contract changed unexpectedly.");
requireText(forgot, 'redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`', "Password recovery callback destination changed unexpectedly.");
requireText(forgot, 'getAuthErrorMessage(error, "recovery")', "Password recovery error mapping changed unexpectedly.");
requireText(forgot, 'href="/login"', "Password recovery login destination changed unexpectedly.");

requireText(reset, "supabase.auth.getSession()", "Reset-password secure-session check changed unexpectedly.");
requireText(reset, "if (password.length < 6)", "Reset-password minimum-length validation changed unexpectedly.");
requireText(reset, "if (password !== confirmPassword)", "Reset-password confirmation validation changed unexpectedly.");
requireText(reset, "supabase.auth.updateUser({", "Reset-password update contract changed unexpectedly.");
requireText(reset, "password,", "Reset-password update payload changed unexpectedly.");
requireText(reset, 'href="/forgot-password"', "Expired reset-link recovery destination changed unexpectedly.");
requireText(reset, 'href="/login"', "Reset-password login destination changed unexpectedly.");

console.log("Password recovery Editorial UI verification passed.");
