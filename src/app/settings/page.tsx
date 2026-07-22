import { DiscussionAudienceSettingsBridge } from "@/components/discussion-audience-settings-bridge";
import { SettingsWorkspaceController } from "@/components/settings-workspace-controller";
import "./settings-workspace.css";
import SettingsV2Client from "./settings-v2-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SettingsPage() {
  return (
    <>
      <SettingsWorkspaceController />
      <SettingsV2Client />
      <DiscussionAudienceSettingsBridge />
    </>
  );
}
