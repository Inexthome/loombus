"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { supabase } from "@/lib/supabase/client";

const AUTHENTICATED_ROOT_DESTINATION = "/home";
const BACKGROUND_REVALIDATION_INTERVAL_MS = 5 * 60 * 1000;

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

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAccountBootstrapPath(pathname: string) {
  return pathname === "/age-gate";
}

function getCurrentDestination(pathname: string) {
  if (typeof window === "undefined") {
    return pathname;
  }

  return `${pathname}${window.location.search}${window.location.hash}`;
}

function getLoginHref(pathname: string) {
  return `/login?next=${encodeURIComponent(getCurrentDestination(pathname))}`;
}

function getAccountAccessHref(status: string) {
  return `/account-access?status=${encodeURIComponent(status)}`;
}

export function SessionLifecycleGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const protectedPath = isProtectedPath(pathname);
  const rootPath = pathname === "/";
  const shouldResolveSession = protectedPath || rootPath;
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
        if (showBlockingScreen) {
          setChecking(true);
        }

        return validationInFlightRef.current;
      }

      if (showBlockingScreen) {
        setChecking(true);
      }

      const validationPromise = (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();

          if (!sessionData.session) {
            if (rootPath) {
              lastSuccessfulValidationAtRef.current = Date.now();
              setChecking(false);
              return true;
            }

            router.replace(getLoginHref(pathname));
            return false;
          }

          if (rootPath) {
            lastSuccessfulValidationAtRef.current = Date.now();
            router.replace(AUTHENTICATED_ROOT_DESTINATION);
            return false;
          }

          const { data: userData, error: userError } =
            await supabase.auth.getUser();

          if (userError || !userData.user) {
            await supabase.auth.signOut({ scope: "local" });
            router.replace(getLoginHref(pathname));
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
            const unverified =
              enforcement.code === "account_access_unverified";

            if (!unverified) {
              await supabase.auth.signOut({ scope: "local" });
            }

            router.replace(
              getAccountAccessHref(
                unverified ? "account_access_unverified" : enforcement.status
              )
            );
            return false;
          }

          lastSuccessfulValidationAtRef.current = Date.now();
          setChecking(false);
          return true;
        } catch {
          if (rootPath) {
            lastSuccessfulValidationAtRef.current = Date.now();
            setChecking(false);
            return true;
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
    [pathname, rootPath, router, shouldResolveSession]
  );

  useEffect(() => {
    void validateSession({ showBlockingScreen: true, force: true });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!shouldResolveSession) {
        return;
      }

      if (rootPath) {
        if (session) {
          router.replace(AUTHENTICATED_ROOT_DESTINATION);
        } else {
          setChecking(false);
        }
        return;
      }

      if (event === "SIGNED_OUT" || !session) {
        router.replace(getLoginHref(pathname));
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
  }, [pathname, rootPath, router, shouldResolveSession, validateSession]);

  if (!shouldResolveSession || !checking) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-black">
      <LoombusLoadingScreen
        eyebrow="Loombus session"
        title={rootPath ? "Restoring your Loombus..." : "Checking your session..."}
        message={
          rootPath
            ? "Opening your signed-in Home when a saved session is available."
            : "Confirming your secure access before opening this page."
        }
      />
    </div>
  );
}
