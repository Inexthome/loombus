import { DiscussionAudienceSettingsBridge } from "@/components/discussion-audience-settings-bridge";
import { SettingsWorkspaceController } from "@/components/settings-workspace-controller";
import SettingsV2Client from "./settings-v2-client";
import "./settings-workspace.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SettingsPage() {
  return (
    <>
      <SettingsV2Client />
      <SettingsWorkspaceController />
      <DiscussionAudienceSettingsBridge />
    </>
  );
}
