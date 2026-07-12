import SettingsV2Client from "./settings-v2-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SettingsPage() {
  return <SettingsV2Client />;
}
