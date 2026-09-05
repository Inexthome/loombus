import { DiscussionAudienceSettingsBridge } from "@/components/discussion-audience-settings-bridge";
import { MemberPrivacySettingsMount } from "@/components/member-privacy-settings-mount";
import { MobileNativeSettingsBridge } from "@/components/mobile-native-settings-bridge";
import { PhoneSecuritySettingsMount } from "@/components/phone-security-settings-mount";
import { SettingsAccountEditorialRefinement } from "@/components/settings-account-editorial-refinement";
import { SettingsEditorialExpansion } from "@/components/settings-editorial-expansion";
import { SettingsMobileSectionSelect } from "@/components/settings-mobile-section-select";
import { SettingsTotpMobileSetup } from "@/components/settings-totp-mobile-setup";
import { SettingsWorkspaceController } from "@/components/settings-workspace-controller";
import { SubscriptionSettingsBridge } from "@/components/subscription-settings-bridge";
import SettingsV2Client from "./settings-v2-client";
import "./settings-workspace.css";
import "./subscription-settings.css";
import "./member-privacy-settings.css";
import "./settings-editorial-ui.css";
import "./settings-editorial-mobile.css";
import "./settings-mobile-section-select.css";
import "./settings-loombus-background.css";
import "./settings-editorial-expansion.css";
import "./settings-copy-cleanup.css";
import "./settings-account-editorial-refinement.css";
import "./settings-remaining-editorial.css";
import "./settings-totp-mobile-setup.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SettingsPage() {
  return (
    <>
      <SettingsV2Client />
      <SettingsWorkspaceController />
      <SettingsMobileSectionSelect />
      <DiscussionAudienceSettingsBridge />
      <MemberPrivacySettingsMount />
      <PhoneSecuritySettingsMount />
      <SubscriptionSettingsBridge />
      <SettingsEditorialExpansion />
      <SettingsTotpMobileSetup />
      <SettingsAccountEditorialRefinement />
      <MobileNativeSettingsBridge />
    </>
  );
}
