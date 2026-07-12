"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { supabase } from "@/lib/supabase/client";

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
  "/onboarding",
  "/age-gate",
];

const BLOCKED_ACCOUNT_STATUSES = new Set([
  "suspended",
  "banned",
  "deactivated",
  "deletion_requested",
]);

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
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
  const [checking, setChecking] = useState(protectedPath);

  const validateSession = useCallback(async () => {
    if (!protectedPath) {
      setChecking(false);
      return true;
    }

    setChecking(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.replace(getLoginHref(pathname));
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
        .select("account_status")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const accountStatus = profile?.account_status || "active";

      if (BLOCKED_ACCOUNT_STATUSES.has(accountStatus)) {
        await supabase.auth.signOut({ scope: "local" });
        router.replace(getAccountAccessHref(accountStatus));
        return false;
      }

      setChecking(false);
      return true;
    } catch {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace(getLoginHref(pathname));
        return false;
      }

      setChecking(false);
      return true;
    }
  }, [pathname, protectedPath, router]);

  useEffect(() => {
    void validateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!protectedPath) {
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
      if (document.visibilityState === "visible" && protectedPath) {
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
  }, [pathname, protectedPath, router, validateSession]);

  if (!protectedPath || !checking) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-black">
      <LoombusLoadingScreen
        eyebrow="Loombus session"
        title="Checking your session..."
        message="Confirming your secure access before opening this page."
      />
    </div>
  );
}
