import type { ReactNode } from "react";
import { ProfileMessagePromptBridge } from "@/components/profile-message-prompt-bridge";
import "./profile-editorial-ui.css";
import "./profile-editorial-accessibility.css";
import "./profile-loombus-background.css";

type ProfileLayoutProps = {
  children: ReactNode;
};

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  return (
    <div className="profile-editorial-route">
      <ProfileMessagePromptBridge />
      <p className="profile-editorial-boundary">
        Profile manages your public identity. Account, privacy, message, and notification preferences remain in Settings.
      </p>
      {children}
    </div>
  );
}
