import Link from "next/link";
import { DiscussionAudienceSettingsBridge } from "@/components/discussion-audience-settings-bridge";
import { MemberPrivacySettingsMount } from "@/components/member-privacy-settings-mount";
import { SettingsWorkspaceController } from "@/components/settings-workspace-controller";
import { SubscriptionSettingsBridge } from "@/components/subscription-settings-bridge";
import SettingsV2Client from "./settings-v2-client";
import "./settings-workspace.css";
import "./subscription-settings.css";
import "./member-privacy-settings.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SettingsPage() {
  return (
    <>
      <div className="mx-auto flex w-full max-w-[1480px] justify-end px-4 pt-4 sm:px-6">
        <Link
          href="/account/enforcement"
          className="inline-flex items-center justify-center rounded-full border border-[#CBAB5B]/55 px-4 py-2.5 text-sm font-semibold text-[#CBAB5B] transition hover:bg-[#CBAB5B]/10"
        >
          Account decisions &amp; appeals
        </Link>
      </div>
      <SettingsV2Client />
      <SettingsWorkspaceController />
      <DiscussionAudienceSettingsBridge />
      <MemberPrivacySettingsMount />
      <SubscriptionSettingsBridge />
    </>
  );
}
