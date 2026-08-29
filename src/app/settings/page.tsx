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
      <SettingsV2Client />
      <SettingsWorkspaceController />
      <DiscussionAudienceSettingsBridge />
      <MemberPrivacySettingsMount />
      <SubscriptionSettingsBridge />
    </>
  );
}
