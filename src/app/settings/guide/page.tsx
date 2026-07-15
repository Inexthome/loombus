import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageShell, Panel } from "@/components/ui";
import styles from "@/components/ui/reference-v2.module.css";

export const metadata: Metadata = {
  title: "Loombus Guide | Loombus",
  description:
    "Learn how Loombus discussions, Signal, Rooms, saved knowledge, AI tools, settings, and safety controls work.",
  alternates: {
    canonical: "https://loombus.com/settings/guide",
  },
};

type GuideSection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  callout?: {
    title: string;
    body: string;
    href?: string;
    label?: string;
  };
};

const guideSections: GuideSection[] = [
  {
    id: "getting-started",
    eyebrow: "Start here",
    title: "Getting started",
    body: "Loombus is built for focused discussions, clearer thinking, and quieter community interaction. Begin by completing your profile, choosing your appearance, reading a few discussions, saving useful threads, and creating one thoughtful post when you are ready.",
    bullets: [
      "Complete your profile so people understand who they are reading.",
      "Use Home as the entry point to your personal Signal workspace.",
      "Use Discussions to read, filter, and join public conversations.",
      "Use Create when you have a clear question, claim, problem, or idea.",
    ],
  },
  {
    id: "home",
    eyebrow: "Home",
    title: "Home and your Signal hub",
    body: "Home brings the most useful Loombus workspaces together. It is designed to help you move between creating, reading, saved items, activity, Stickies, Rooms, Labs, and account tools without relying on an endless feed.",
    bullets: [
      "Create starts a new public discussion.",
      "Saved returns you to discussions worth keeping.",
      "Stickies holds private working notes and pinned ideas.",
      "My Activity collects your discussions, replies, saves, and alerts.",
    ],
  },
  {
    id: "discussions",
    eyebrow: "Discussions",
    title: "Reading public discussions",
    body: "The Discussions workspace is where members read and join public conversations. Search, topic filters, purpose lanes, Reality Lenses, and Signal sorting help narrow the page to the conversation you need.",
    bullets: [
      "All shows the broader public discussion directory.",
      "Following narrows activity to people you follow.",
      "Active emphasizes stronger recent discussion activity.",
      "Saved and reading history help you return without searching again.",
    ],
  },
  {
    id: "signal",
    eyebrow: "Signal",
    title: "What Signal means",
    body: "Signal is Loombus shorthand for useful activity. It is not a popularity score or a guarantee of quality. It helps organize discussions using observable activity such as replies, saves, views, and meaningful participation.",
    bullets: [
      "Replies show that a discussion is developing.",
      "Saves show that members found a discussion worth returning to.",
      "Views show reading attention, not agreement.",
      "Signal helps with discovery but does not replace judgment.",
    ],
  },
  {
    id: "create",
    eyebrow: "Create",
    title: "Creating a focused discussion",
    body: "A strong discussion gives readers a clear title, enough context, and a reason to respond thoughtfully. Use the available structure to explain what the discussion is about and what kind of contribution would move it forward.",
    bullets: [
      "Choose the closest Topic before publishing.",
      "Use a Reality Lens when lived conditions or real-world context matter.",
      "Use a Purpose Lane when the discussion has a clear direction.",
      "Use tags sparingly so they improve discovery instead of adding noise.",
    ],
  },
  {
    id: "replies",
    eyebrow: "Replies",
    title: "Replying well",
    body: "Replies should add context, ask a better question, clarify disagreement, contribute relevant experience, or identify a tradeoff. Loombus works best when replies move the discussion rather than merely react to it.",
    bullets: [
      "Reply to the strongest part of the discussion.",
      "Name the assumption or tradeoff when disagreeing.",
      "Add evidence or experience when it is relevant.",
      "Avoid replies that only repeat, provoke, or reward noise.",
    ],
  },
  {
    id: "rooms",
    eyebrow: "Private Rooms",
    title: "Working inside Live Rooms",
    body: "Rooms are private member workspaces for structured discussion and coordination. Room content is separate from the public Discussions feed and is returned only after ownership or active membership is verified.",
    bullets: [
      "Members can create private room discussion posts.",
      "Owners and administrators can publish announcements and calendar events.",
      "Owners and administrators review access requests and member roles.",
      "Moderators can remove room posts that require moderation.",
    ],
    callout: {
      title: "Current Rooms boundary",
      body: "Private file uploads, discussion attachments, forms, and inline video are not connected yet. The Resources area identifies that boundary instead of presenting unavailable storage as active.",
      href: "/rooms",
      label: "Open Rooms",
    },
  },
  {
    id: "stickies",
    eyebrow: "Stickies",
    title: "Private working memory",
    body: "Stickies are private notes and working memory. Use them to hold ideas, reminders, useful discussions, or thoughts that may become part of later research or writing.",
    bullets: [
      "Pin useful discussions when they may matter later.",
      "Use private notes for unfinished thinking.",
      "Return to Stickies when collecting ideas across Loombus.",
      "Do not treat Stickies as public posts or shared room resources.",
    ],
  },
  {
    id: "saved",
    eyebrow: "Saved",
    title: "Saved discussions and reading history",
    body: "Saved is your working library of useful discussions. Reading History records discussions you opened so you can return even when you did not save them.",
    bullets: [
      "Save discussions with strong framing, replies, or research value.",
      "Use Saved as an intentional shelf, not a second feed.",
      "Use Reading History to recover a discussion you recently opened.",
      "Your own discussions and replies remain available in My Activity.",
    ],
  },
  {
    id: "messages",
    eyebrow: "Messages",
    title: "Private messages",
    body: "Messages support direct conversations connected to Loombus activity. Use them for relevant follow-up that does not belong in a public discussion or shared Room.",
    bullets: [
      "Keep private conversations respectful and relevant.",
      "Do not send passwords, verification codes, or sensitive payment data.",
      "Use blocking when interaction needs to stop.",
      "Use reporting or Support when a message raises a safety concern.",
    ],
  },
  {
    id: "people",
    eyebrow: "People",
    title: "People and following",
    body: "People helps you find contributors. Following builds a smaller reading circle around members whose discussions and replies consistently add context or value.",
    bullets: [
      "Follow people for contribution, not popularity.",
      "Use Following to reduce feed noise.",
      "Profile details help readers understand perspective and experience.",
      "Blocking removes unwanted interaction from supported areas.",
    ],
  },
  {
    id: "alerts",
    eyebrow: "Signal Inbox",
    title: "Notifications and alerts",
    body: "The Signal Inbox helps you return to meaningful activity such as replies, mentions, follows, messages, discussion updates, and supported system notices.",
    bullets: [
      "Use the inbox to return to active conversations.",
      "Mark or filter notifications when the inbox becomes busy.",
      "Manage in-app, device, and supported email preferences in Settings.",
      "Premium topic alerts notify you when discussions enter selected topics.",
    ],
  },
  {
    id: "ai-usage",
    eyebrow: "AI-assisted layer",
    title: "AI tools and AI Usage",
    body: "Loombus AI tools can summarize, clarify, map, or improve discussion material. They are optional assistance and may be inaccurate. AI Usage shows the current plan, monthly metered activity, generated results, cached results, failures, usage buckets, and recent AI-assisted events.",
    bullets: [
      "Review AI output before relying on it or publishing it.",
      "Cached outputs may not count the same way as newly generated outputs.",
      "Monthly limits depend on the account entitlement and feature bucket.",
      "AI tools support member judgment rather than replacing it.",
    ],
    callout: {
      title: "See the account-level meter",
      body: "AI Usage is a signed-in workspace because it contains plan and activity information for the current account.",
      href: "/ai-usage",
      label: "Open AI Usage",
    },
  },
  {
    id: "appearance",
    eyebrow: "Appearance",
    title: "Light, Dark, and System",
    body: "Appearance changes the Loombus visual mode on the current device. It does not change account data, discussions, membership, or privacy settings.",
    bullets: [
      "Light uses the brighter Loombus workspace.",
      "Dark uses the low-light workspace.",
      "System follows the device appearance setting.",
      "Use Settings to change the saved appearance for this device.",
    ],
  },
  {
    id: "premium",
    eyebrow: "Premium",
    title: "Plans and paid features",
    body: "Premium and Premium Plus can provide additional AI-assisted usage and supported account tools. Available features, limits, billing intervals, and prices are controlled by the plan shown in Loombus and at checkout.",
    bullets: [
      "Review the plan page before starting a paid subscription.",
      "Use AI Usage to understand current metered activity.",
      "Use the billing portal when available for subscription management.",
      "Use the Refund Policy for cancellation and refund rules.",
    ],
  },
  {
    id: "safety",
    eyebrow: "Safety",
    title: "Blocking, reporting, and support",
    body: "Loombus includes blocking, reporting, moderation, account restrictions, and support workflows to protect members and platform integrity.",
    bullets: [
      "Use in-platform reporting for a specific discussion, reply, profile, or message when available.",
      "Block a member when interaction needs to stop.",
      "Review Community Guidelines and Safety for platform expectations.",
      "Use Support for account, billing, accessibility, rights, or unresolved safety concerns.",
    ],
    callout: {
      title: "Need a direct answer?",
      body: "The Support center searches Loombus guidance and accepts structured requests without requiring you to locate the correct internal team first.",
      href: "/support",
      label: "Open Support",
    },
  },
];

export default function LoombusGuidePage() {
  return (
    <PageShell width="xl">
      <PageHeader
        eyebrow="Loombus Guide"
        title="How the Loombus workspaces fit together."
        description={
          <>
            Use this guide to understand public discussions, Signal, private Rooms,
            saved knowledge, AI-assisted tools, account controls, and safety
            boundaries. Each section points to the current product behavior rather
            than a future feature concept.
          </>
        }
      >
        <Link href="/support" className={styles.footerAction}>
          Search Support
        </Link>
      </PageHeader>

      <nav className={styles.guideJumpPanel} aria-label="Loombus guide sections">
        <div className={styles.guideJumpHeading}>
          <strong>Jump to a workspace</strong>
          <span>{guideSections.length} guide sections</span>
        </div>
        <div className={styles.guideJumpGrid}>
          {guideSections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className={styles.guideJumpLink}>
              {section.title}
            </a>
          ))}
        </div>
      </nav>

      <div className={styles.guideSections}>
        {guideSections.map((section, index) => (
          <Panel key={section.id} className={styles.guideSection}>
            <div className={styles.guideSectionTopline}>
              <div>
                <p className={styles.guideSectionKicker}>{section.eyebrow}</p>
                <h2 id={section.id} className={styles.guideSectionTitle}>
                  {section.title}
                </h2>
              </div>
              <span className={styles.guideSectionNumber} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>

            <p className={styles.guideSectionBody}>{section.body}</p>

            <ul className={styles.guideBulletGrid}>
              {section.bullets.map((bullet) => (
                <li key={bullet} className={styles.guideBullet}>
                  {bullet}
                </li>
              ))}
            </ul>

            {section.callout ? (
              <div className={styles.guideCallout}>
                <div>
                  <strong>{section.callout.title}</strong>
                  <span>{section.callout.body}</span>
                  {section.callout.href && section.callout.label ? (
                    <Link href={section.callout.href} className={styles.footerAction}>
                      {section.callout.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
