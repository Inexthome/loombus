import Link from "next/link";
import type { ReactNode } from "react";
import { ProfileMessagePromptBridge } from "@/components/profile-message-prompt-bridge";
import "./profile-v2-shell.css";
import "./profile-editorial-ui.css";

type ProfileLayoutProps = {
  children: ReactNode;
};

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  return (
    <div className="profile-v2-route">
      <ProfileMessagePromptBridge />
      <div className="profile-v2-shell">
        <header className="profile-v2-hero">
          <div className="profile-v2-hero-copy">
            <p className="profile-v2-eyebrow">Identity studio</p>
            <h1>Shape your public Loombus identity.</h1>
            <p>
              Manage how your name, perspective, creator links, and public presence
              appear across Loombus. Account, privacy, message, and notification
              preferences remain in Settings.
            </p>
          </div>

          <div className="profile-v2-hero-actions">
            <Link href="/settings?section=profile" className="profile-v2-secondary-action">
              Back to settings
            </Link>
            <Link href="/people" className="profile-v2-primary-action">
              Explore people
            </Link>
          </div>
        </header>

        <section className="profile-v2-guide" aria-label="Profile editor overview">
          <article>
            <span>01</span>
            <div>
              <strong>Public identity</strong>
              <p>Name, username, avatar, bio, and perspective.</p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <strong>Creator presence</strong>
              <p>Website and supporter links for eligible accounts.</p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <strong>Viewers &amp; sharing</strong>
              <p>Profile viewers, preview, and public sharing.</p>
            </div>
          </article>
        </section>

        <div className="profile-v2-content">{children}</div>
      </div>
    </div>
  );
}
