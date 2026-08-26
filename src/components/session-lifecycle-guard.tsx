"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { signOutCurrentDevice } from "@/lib/auth-sign-out";
import {
  restorePersistedSupabaseSession,
  supabase,
} from "@/lib/supabase/client";

const AUTHENTICATED_ROOT_DESTINATION = "/discussions";
const BACKGROUND_REVALIDATION_INTERVAL_MS = 5 * 60 * 1000;

const SESSION_AWARE_PUBLIC_PATH_PREFIXES = [
  "/discussions",
];

const PROTECTED_PATH_PREFIXES = [
  "/home",
  "/dashboard",
  "/create",
  "/saved",
  "/notifications",
  "/messages",
  "/profile",
  "/my-activity",
  "/my-discussions",
  "/my-replies",
  "/reading-history",
  "/stickies",
  "/following",
  "/settings",
  "/privacy-security",
  "/ai-usage",
  "/blocked-users",
  "/admin",
  "/rooms",
  "/local/manage",
  "/onboarding",
  "/age-gate",
];

type SessionValidationOptions = {
  showBlockingScreen?: boolean;
  force?: boolean;
};

function matchesPathPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isProtectedPath(pathname: string) {
  return matchesPathPrefix(pathname, PROTECTED_PATH_PREFIXES);
}

function isSessionAwarePublicPath(pathname: string) {
  return matchesPathPrefix(pathname, SESSION_AWARE_PUBLIC_PATH_PREFIXES);
}

function isAccountBootstrapPath(pathname: string) {
  return pathname === "/age-gate";
}

function getCurrentDestination(pathname: string) {
  if (typeof window === "undefined") return pathname;
  return `${pathname}${window.location.search}${window.location.hash}`;
}

function getLoginHref(pathname: string) {
  return `/login?next=${encodeURIComponent(getCurrentDestination(pathname))}`;
}

function getAccountAccessHref(status: string) {
  return `/account-access?status=${encodeURIComponent(status)}`;
}

function isConfirmedInvalidSessionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; status?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";

  return (
    candidate.status === 401 ||
    code === "bad_jwt" ||
    code === "invalid_jwt" ||
    code === "refresh_token_not_found" ||
    code === "refresh_token_already_used" ||
    code === "session_not_found"
  );
}

export function SessionLifecycleGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const protectedPath = isProtectedPath(pathname);
  const sessionAwarePublicPath = isSessionAwarePublicPath(pathname);
  const rootPath = pathname === "/";
  const shouldResolveSession = protectedPath || sessionAwarePublicPath || rootPath;
  const [checking, setChecking] = useState(shouldResolveSession);
  const validationInFlightRef = useRef<Promise<boolean> | null>(null);
  const lastSuccessfulValidationAtRef = useRef(0);

  const validateSession = useCallback(
    (options: SessionValidationOptions = {}) => {
      const { showBlockingScreen = false, force = false } = options;

      if (!shouldResolveSession) {
        setChecking(false);
        return Promise.resolve(true);
      }

      if (
        !force &&
        lastSuccessfulValidationAtRef.current > 0 &&
        Date.now() - lastSuccessfulValidationAtRef.current <
          BACKGROUND_REVALIDATION_INTERVAL_MS
      ) {
        return Promise.resolve(true);
      }

      if (validationInFlightRef.current) {
        if (showBlockingScreen) setChecking(true);
        return validationInFlightRef.current;
      }

      if (showBlockingScreen) setChecking(true);

      const validationPromise = (async () => {
        try {
          await restorePersistedSupabaseSession();
          const { data: sessionData } = await supabase.auth.getSession();

          if (!sessionData.session) {
            if (rootPath || sessionAwarePublicPath) {
              lastSuccessfulValidationAtRef.current = Date.now();
              setChecking(false);
              return true;
            }

            router.replace(getLoginHref(pathname));
            return false;
          }

          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError && !isConfirmedInvalidSessionError(userError)) {
            router.replace(getAccountAccessHref("verification_unavailable"));
            return false;
          }

          if (userError || !userData.user) {
            await signOutCurrentDevice({ scope: "local" });
            router.replace(rootPath ? "/login" : getLoginHref(pathname));
            return false;
          }

          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("account_status, enforcement_reason, suspended_until")
            .eq("id", userData.user.id)
            .maybeSingle();

          if (profileError) {
            router.replace(getAccountAccessHref("verification_unavailable"));
            return false;
          }

          if (!profile) {
            if (isAccountBootstrapPath(pathname)) {
              lastSuccessfulValidationAtRef.current = Date.now();
              setChecking(false);
              return true;
            }

            router.replace(getAccountAccessHref("profile_unavailable"));
            return false;
          }

          const enforcement = getAccountEnforcementResult(profile);
          if (!enforcement.allowed) {
            // Keep the authenticated session so a restricted member can open the
            // dedicated decision-history and appeal route. Ordinary protected APIs
            // continue to deny the account through their server-side access checks.
            router.replace(
              getAccountAccessHref(
                enforcement.code === "account_access_unverified"
                  ? "account_access_unverified"
                  : enforcement.status
              )
            );
            return false;
          }

          if (rootPath) {
            lastSuccessfulValidationAtRef.current = Date.now();
            router.replace(AUTHENTICATED_ROOT_DESTINATION);
            return false;
          }

          lastSuccessfulValidationAtRef.current = Date.now();
          setChecking(false);
          return true;
        } catch {
          if (rootPath) {
            router.replace(getAccountAccessHref("verification_unavailable"));
            return false;
          }

          router.replace(getAccountAccessHref("verification_unavailable"));
          return false;
        }
      })();

      validationInFlightRef.current = validationPromise;
      void validationPromise.finally(() => {
        if (validationInFlightRef.current === validationPromise) {
          validationInFlightRef.current = null;
        }
      });

      return validationPromise;
    },
    [pathname, rootPath, router, sessionAwarePublicPath, shouldResolveSession]
  );

  useEffect(() => {
    void validateSession({ showBlockingScreen: true, force: true });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!shouldResolveSession) return;

      if (event === "SIGNED_OUT" || !session) {
        if (rootPath || sessionAwarePublicPath) {
          setChecking(false);
        } else {
          router.replace(getLoginHref(pathname));
        }
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void validateSession({ showBlockingScreen: false, force: true });
      }
    });

    function handleWindowFocus() {
      if (shouldResolveSession) {
        void validateSession({ showBlockingScreen: false, force: false });
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && shouldResolveSession) {
        void validateSession({ showBlockingScreen: false, force: false });
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    pathname,
    rootPath,
    router,
    sessionAwarePublicPath,
    shouldResolveSession,
    validateSession,
  ]);

  if (!shouldResolveSession || !checking) return null;

  return (
    <div className="fixed inset-0 z-[9998] bg-black">
      <LoombusLoadingScreen
        eyebrow="Loombus session"
        title={rootPath ? "Restoring your Loombus..." : "Checking your session..."}
        message={
          rootPath
            ? "Opening your signed-in Discussions when a saved session is available."
            : "Confirming your secure access before opening this page."
        }
      />
    </div>
  );
}
