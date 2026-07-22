import { ProfileWorkspaceController } from "@/components/profile-workspace-controller";
import ProfileEditorClient from "./profile-editor-client";
import "./profile-workspace.css";

export default function ProfilePage() {
  return (
    <div className="profile-workspace-frame">
      <ProfileWorkspaceController />
      <ProfileEditorClient />
    </div>
  );
}
