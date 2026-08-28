import type { ReactNode } from "react";
import { ProfileMessagePromptBridge } from "@/components/profile-message-prompt-bridge";
import "./profile-v2-shell.css";
import "./profile-editorial-ui.css";

type ProfileLayoutProps = {
  children: ReactNode;
};

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  return (
    <div className="profile-v2-route profile-editorial-route">
      <ProfileMessagePromptBridge />
      <div className="profile-v2-shell profile-editorial-shell">
        <div className="profile-v2-content">{children}</div>
      </div>
    </div>
  );
}
