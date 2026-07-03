import { V2UserAvatarMenuPortal } from "./v2-user-avatar-menu";

export function V2NavigationConsistencyStyle() {
  return (
    <>
      <style>{`
        /* One canonical V2 nav shape across old local navs and shared shell navs. */
        .loombus-v2-top-nav nav a:not([href="/discussions"]):not([href="/create"]):not([href="/rooms"]):not([href="/v2/discussions"]):not([href="/v2/create"]):not([href="/v2/rooms"]) {
          display: none !important;
        }

        .loombus-v2-bottom-nav a:not([href="/discussions"]):not([href="/create"]):not([href="/rooms"]):not([href="/v2/discussions"]):not([href="/v2/create"]):not([href="/v2/rooms"]) {
          display: none !important;
        }

        .loombus-v2-bottom-nav > div {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          max-width: 24rem !important;
        }

        /* Remove stale hardcoded dots/counts from old page-local navbars. */
        .loombus-v2-top-nav a[aria-label="Search"] > span,
        .loombus-v2-top-nav a[href="/search"] > span,
        .loombus-v2-top-nav a[href="/v2/search"] > span,
        .loombus-v2-top-nav a[aria-label="Notifications"] > span,
        .loombus-v2-top-nav a[href="/notifications"] > span,
        .loombus-v2-top-nav a[href="/v2/notifications"] > span,
        .loombus-v2-top-nav .v2-nav-badge {
          display: none !important;
        }

        /* The profile menu must live in the navbar, not as a separate floating slot. */
        .v2-global-avatar-slot {
          display: none !important;
        }

        .loombus-v2-top-nav .v2-avatar-menu-inline,
        .loombus-v2-top-nav .v2-avatar-portal-host {
          display: flex !important;
        }

        .loombus-v2-top-nav > div > div:last-child {
          padding-right: 0 !important;
        }
      `}</style>
      <V2UserAvatarMenuPortal />
    </>
  );
}
