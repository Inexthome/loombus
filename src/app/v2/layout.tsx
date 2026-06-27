import type { ReactNode } from "react";
import { V2ShellLinkRouter } from "./v2-shell-link-router";
import { V2UserAvatarMenu } from "./v2-user-avatar-menu";
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
        header a[href="/v2"] span.text-xl {
          display: none !important;
        }

        header a[href="/v2"] {
          gap: 0 !important;
        }
      `}</style>
      {children}
      <V2UserAvatarMenu />
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
