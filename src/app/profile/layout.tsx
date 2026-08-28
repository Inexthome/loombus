import type { ReactNode } from "react";
import { ProfileMessagePromptBridge } from "@/components/profile-message-prompt-bridge";

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
