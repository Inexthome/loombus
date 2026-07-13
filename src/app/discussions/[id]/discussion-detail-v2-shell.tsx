import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bell,
  Bookmark,
  ChevronLeft,
  Home,
  MessageCircle,
  MessagesSquare,
  Plus,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import DiscussionDetailShare from "./discussion-detail-share";

const PRIMARY_LINKS = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/discussions", label: "Discussions", Icon: MessageCircle, active: true },
  { href: "/create", label: "Create", Icon: Plus },
  { href: "/rooms", label: "Rooms", Icon: UsersRound },
  { href: "/messages", label: "Messages", Icon: MessagesSquare },
];

const THREAD_LINKS = [
  { href: "#discussion-detail-content", label: "Discussion", Icon: MessageCircle },
  { href: "#intelligence-layer", label: "State of Discussion", Icon: Sparkles },
  { href: "#reply-form", label: "Add a Reply", Icon: Plus },
  { href: "#replies", label: "Replies", Icon: MessagesSquare },
  { href: "/saved", label: "Saved", Icon: Bookmark },
];

export default function DiscussionDetailV2Shell({ children }: { children: ReactNode }) {
  return (
    <div className="discussion-detail-v2-shell">
      <header className="discussion-detail-v2-topbar">
        <div className="discussion-detail-v2-topbar-inner">
          <Link href="/home" className="discussion-detail-v2-brand" aria-label="Loombus home">
            <span className="discussion-detail-v2-brand-mark">
              <img src="/assets/brand/loombus-mark-transparent.png" alt="" />
            </span>
            <span className="discussion-detail-v2-brand-copy">
              <strong>Loombus</strong>
              <small>Discussion workspace</small>
            </span>
          </Link>

          <nav className="discussion-detail-v2-primary-nav" aria-label="Discussion workspace primary navigation">
            {PRIMARY_LINKS.map(({ href, label, Icon, active }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={active ? "is-active" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <div className="discussion-detail-v2-tools">
            <Link href="/search" aria-label="Search Loombus" title="Search">
              <Search aria-hidden="true" />
            </Link>
            <Link href="/notifications" aria-label="Notifications" title="Notifications">
              <Bell aria-hidden="true" />
            </Link>
            <DiscussionDetailShare />
          </div>
        </div>
      </header>

      <div className="discussion-detail-v2-stage">
        <aside className="discussion-detail-v2-left-rail" aria-label="Discussion workspace navigation">
          <Link href="/discussions" className="discussion-detail-v2-back-link">
            <ChevronLeft aria-hidden="true" />
            <span>All Discussions</span>
          </Link>

          <section>
            <p>Thread workspace</p>
            <nav>
              {THREAD_LINKS.map(({ href, label, Icon }, index) => (
                <Link key={`${href}-${label}`} href={href} className={index === 0 ? "is-current" : undefined}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </section>

          <div className="discussion-detail-v2-left-note">
            <span>Signal over noise</span>
            <p>Read the discussion, inspect its state, then add a reply that moves the thread forward.</p>
          </div>
        </aside>

        <div id="discussion-detail-content" className="discussion-detail-v2-content">
          {children}
        </div>
      </div>
    </div>
  );
}
