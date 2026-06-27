import type { ReactNode } from "react";
import { V2ShellLinkRouter } from "./v2-shell-link-router";
import { V2UserAvatarMenu } from "./v2-user-avatar-menu";
import { V2SignalStickyPolish } from "./v2-signal-sticky-polish";
import { V2CreateReviewAction } from "./create/v2-create-review-action";
import { V2CreateServerCheck } from "./create/v2-create-server-check";
import { V2CreateFinalLockCheck } from "./create/v2-create-final-lock-check";
import { V2CreateShadowRecordCheck } from "./create/v2-create-shadow-record-check";
import { V2CreateDryRunCheck } from "./create/v2-create-dry-run-check";
import { V2CreatePreflightStatusCheck } from "./create/v2-create-preflight-status-check";

export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        header a[href="/v2"] img[src="/assets/brand/loombus-mark-transparent.png"],
        header a[href="/v2"] span.text-xl {
          visibility: hidden !important;
        }

        header a[href="/v2"] {
          width: 2.5rem !important;
          min-width: 2.5rem !important;
          gap: 0 !important;
        }

        .v2-avatar-menu {
          left: max(1rem, calc((100vw - 80rem) / 2 + 1rem));
        }

        @media (min-width: 640px) {
          .v2-avatar-menu {
            left: max(1.5rem, calc((100vw - 80rem) / 2 + 1.5rem));
          }
        }

        @media (min-width: 1024px) {
          .v2-avatar-menu {
            left: max(2rem, calc((100vw - 80rem) / 2 + 2rem));
          }
        }
      `}</style>
      {children}
      <V2UserAvatarMenu />
      <V2SignalStickyPolish />
      <V2ShellLinkRouter />
      <V2CreateReviewAction />
      <V2CreateServerCheck />
      <V2CreateFinalLockCheck />
      <V2CreateShadowRecordCheck />
      <V2CreateDryRunCheck />
      <V2CreatePreflightStatusCheck />
    </>
  );
}
