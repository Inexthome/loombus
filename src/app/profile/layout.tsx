import type { ReactNode } from "react";
import { ProfileMessagePromptBridge } from "@/components/profile-message-prompt-bridge";
import "./profile-editorial-ui.css";

type ProfileLayoutProps = {
  children: ReactNode;
};

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  return (
    <div className="profile-editorial-route">
      <ProfileMessagePromptBridge />
      {children}
    </div>
  );
}
