type AuthErrorContext = "login" | "signup" | "oauth" | "recovery" | "reset" | "callback";

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function getAuthErrorMessage(
  error: unknown,
  context: AuthErrorContext
) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const message = rawMessage.trim().toLowerCase();

  if (
    typeof navigator !== "undefined" &&
    navigator.onLine === false
  ) {
    return "You appear to be offline. Reconnect to the internet and try again.";
  }

  if (
    includesAny(message, [
      "failed to fetch",
      "network request failed",
      "networkerror",
      "load failed",
      "fetch failed",
    ])
  ) {
    return "Loombus could not reach the sign-in service. Check your connection and try again.";
  }

  if (includesAny(message, ["rate limit", "too many requests", "email rate limit"])) {
    return "Too many attempts were made. Wait a few minutes, then try again.";
  }

  if (
    context === "login" &&
    includesAny(message, ["invalid login credentials", "invalid credentials"])
  ) {
    return "The email or password is incorrect. Check both fields or reset your password.";
  }

  if (
    context === "login" &&
    includesAny(message, ["email not confirmed", "email_not_confirmed"])
  ) {
    return "Confirm your email address before signing in. Check your inbox and spam folder.";
  }

  if (
    context === "signup" &&
    includesAny(message, ["user already registered", "already been registered"])
  ) {
    return "An account already exists for this email. Sign in or reset your password.";
  }

  if (
    context === "signup" &&
    includesAny(message, ["sending confirmation email", "confirmation email"])
  ) {
    return "Loombus could not send the confirmation email. Try again later or use Google signup on the web.";
  }

  if (
    includesAny(message, [
      "otp expired",
      "token has expired",
      "invalid token",
      "invalid recovery",
      "expired",
    ])
  ) {
    return context === "reset" || context === "recovery"
      ? "This password-reset link is invalid or expired. Request a new reset email and use the newest link."
      : "This sign-in link is invalid or expired. Return to login and try again.";
  }

  if (
    context === "oauth" &&
    includesAny(message, ["cancel", "access_denied", "user denied"])
  ) {
    return "The provider sign-in was canceled. You can try again or use email and password.";
  }

  if (context === "callback") {
    return "Loombus could not finish the secure sign-in session. Return to login and try again.";
  }

  if (context === "recovery") {
    return "Loombus could not send the reset email right now. Check your connection and try again shortly.";
  }

  if (context === "reset") {
    return "Loombus could not update the password. Request a new reset link and try again.";
  }

  if (context === "oauth") {
    return "Loombus could not start provider sign-in. Try again or use email and password.";
  }

  if (context === "signup") {
    return "Loombus could not create the account. Review the information and try again.";
  }

  return "Loombus could not sign you in. Check your details and try again.";
}
