"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { supabase } from "@/lib/supabase/client";

const AUTHENTICATED_ROOT_DESTINATION = "/home";

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

  const validateSession = useCallback(async () => {
    if (!shouldResolveSession) {
      setChecking(false);
      return true;
    }

    setChecking(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        if (rootPath) {
          setChecking(false);
          return true;
        }

        router.replace(getLoginHref(pathname));
        return false;
      }

      if (rootPath) {
        router.replace(AUTHENTICATED_ROOT_DESTINATION);
        return false;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();

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

      setChecking(false);
      return true;
    } catch {
      if (rootPath) {
        setChecking(false);
        return true;
      }

      router.replace(getAccountAccessHref("verification_unavailable"));
      return false;
    }
  }, [pathname, rootPath, router, shouldResolveSession]);

  useEffect(() => {
    void validateSession();

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
        void validateSession();
      }
    });

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && shouldResolveSession) {
        void validateSession();
      }
    }

    window.addEventListener("focus", validateSession);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("focus", validateSession);
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
