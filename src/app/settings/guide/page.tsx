import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageShell, Panel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Loombus Guide | Loombus",
  description:
    "A practical guide to Loombus discussions, Signal, profiles, saved knowledge, messages, settings, Premium tools, and safety controls.",
  alternates: { canonical: "https://loombus.com/settings/guide" },
};

const guideSections = [
  {
    id: "getting-started",
    eyebrow: "Start here",
    title: "Getting started",
    body: "Loombus is built for focused discussions, clearer thinking, and quieter community interaction. Start by completing your profile, choosing your appearance, reading discussions, saving useful threads, and creating one thoughtful post when you are ready.",
    bullets: [
      "Complete your profile so people know who they are reading.",
      "Use Home as your personal Signal hub.",
      "Use Discussions to read, filter, and join public conversations.",
      "Use Create when you have a clear question, claim, problem, or idea.",
    ],
  },
  {
    id: "home",
    eyebrow: "Home",
    title: "Home and Signal Hub",
    body: "Home is the fast entry point into your Loombus workspace. It brings together creating, reading, saved items, activity, Stickies, Labs, and account areas.",
    bullets: [
      "Create starts a new discussion.",
      "Saved returns you to threads worth keeping.",
      "Stickies keeps private working notes and pinned ideas.",
      "My Activity shows your own discussions, replies, saves, and alerts.",
    ],
  },
  {
    id: "discussions",
    eyebrow: "Discussions",
    title: "Reading discussions",
    body: "The discussion feed is where members read and join public conversations. Use All, Following, and Active views to control what kind of conversation you are seeing.",
    bullets: [
      "All shows the full public feed.",
      "Following narrows the feed to people you follow.",
      "Active highlights discussions with stronger recent engagement.",
      "Use topics, purpose lanes, search, and Signal sorting when you need a narrower view.",
    ],
  },
  {
    id: "signal",
    eyebrow: "Signal",
    title: "What Signal means",
    body: "Signal is Loombus’s shorthand for useful activity. It is not a popularity score. It helps surface discussions that have replies, saves, views, and meaningful interaction.",
    bullets: [
      "Replies show conversation activity.",
      "Saves show that members found a thread worth returning to.",
      "Views show reading attention.",
      "Signal combines activity into a simple visibility cue.",
    ],
  },
  {
    id: "create",
    eyebrow: "Create",
    title: "Creating a discussion",
    body: "Create is for starting a focused public discussion. A strong post has a clear title, enough context, and a reason for people to respond thoughtfully.",
    bullets: [
      "Choose a Topic first.",
      "Use Reality Lens when the issue is rooted in lived experience or real-world conditions.",
      "Use Purpose Lane when the discussion has a direction, such as learning, contribution, mastery, or community.",
      "Use tags sparingly to make the discussion easier to find.",
    ],
  },
  {
    id: "replies",
    eyebrow: "Replies",
    title: "Replying well",
    body: "Replies should add context, ask better questions, clarify disagreement, or bring useful experience. Loombus works best when replies move the conversation forward.",
    bullets: [
      "Reply to the strongest part of the discussion.",
      "Add context instead of noise.",
      "Disagree by naming the assumption or tradeoff.",
      "Avoid replies that only react without adding Signal.",
    ],
  },
  {
    id: "stickies",
    eyebrow: "Stickies",
    title: "Stickies",
    body: "Stickies are private notes and working memory. Use them to hold ideas, reminders, useful threads, or thoughts you may return to later.",
    bullets: [
      "Pin a discussion to Stickies when it may become useful later.",
      "Use Stickies for private thinking, not public posting.",
      "Return to Stickies when you are collecting ideas across the platform.",
    ],
  },
  {
    id: "saved",
    eyebrow: "Saved",
    title: "Saved discussions",
    body: "Saved is your library of useful threads. Save discussions that contain strong framing, useful replies, research value, or ideas you may build on later.",
    bullets: [
      "Save threads you want to revisit.",
      "Use collections or notes when available.",
      "Treat Saved as a working shelf for ideas, research, and future replies.",
    ],
  },
  {
    id: "messages",
    eyebrow: "Messages",
    title: "Messages",
    body: "Messages are for private conversations with people connected to your Loombus activity. Use the floating message button to open conversations without leaving the current page.",
    bullets: [
      "Use messages for direct follow-up.",
      "Keep private conversations respectful and relevant.",
      "Report or mute conversations when needed.",
    ],
  },
  {
    id: "people",
    eyebrow: "People",
    title: "People and following",
    body: "People helps you find contributors. Following lets you build a smaller reading circle around people whose discussions and replies add value.",
    bullets: [
      "Follow people who consistently add context.",
      "Use Following to reduce feed noise.",
      "Profile details help others understand your perspective.",
    ],
  },
  {
    id: "alerts",
    eyebrow: "Signal Inbox",
    title: "Notifications and alerts",
    body: "The Signal Inbox helps you return to meaningful activity such as replies, mentions, follows, messages, and discussion updates.",
    bullets: [
      "Use alerts to return to conversations.",
      "Filter alert types when the inbox gets busy.",
      "Adjust delivery preferences from Settings.",
    ],
  },
  {
    id: "appearance",
    eyebrow: "Appearance",
    title: "Light, System, and Dark",
    body: "Appearance controls the visual mode of Loombus. Use Settings to switch between Light, System, and Dark without changing your account data.",
    bullets: [
      "Light uses the Loombus Cream workspace.",
      "Dark uses the low-light workspace.",
      "System follows your device setting.",
    ],
  },
  {
    id: "premium",
    eyebrow: "Premium",
    title: "Premium and AI tools",
    body: "Premium features support deeper reading, better organization, and AI-assisted understanding. AI tools are designed to summarize, clarify, map, and improve discussions without replacing the member’s judgment.",
    bullets: [
      "Use AI summaries to understand long discussions faster.",
      "Use quality checks before posting.",
      "Review AI Usage to understand metered and cached actions.",
    ],
  },
  {
    id: "safety",
    eyebrow: "Safety",
    title: "Safety, blocking, and reporting",
    body: "Loombus includes reporting, blocking, moderation, and account protections to keep discussions useful and accountable.",
    bullets: [
      "Report discussions, replies, profiles, or messages when they violate expectations.",
      "Block people when you need to limit interaction.",
      "Use Guidelines and Safety pages for policy details.",
    ],
  },
];

const referenceLinks = [
  ["/support", "Support", "Search help or submit a structured request."],
  ["/guidelines", "Guidelines", "Community standards and enforcement expectations."],
  ["/safety", "Safety", "Reporting, blocking, and member protections."],
  ["/ai-usage", "AI Usage", "Review account-level AI limits and activity."],
  ["/about", "About Loombus", "Purpose, values, and Signal-first direction."],
  ["/accessibility", "Accessibility", "Accessibility approach and support contact."],
] as const;

export default function LoombusGuidePage() {
  return (
    <PageShell width="xl">
      <Link href="/settings" className="loombus-reference-back">
        ← Back to Settings
      </Link>

      <PageHeader
        eyebrow="Loombus Guide"
        title="Understand the platform without guessing."
        description="A central guide to the main workspaces, Signal concepts, account controls, and safety tools across Loombus. Use the section index to jump directly to the area you need."
      />

      <div className="loombus-reference-grid" aria-label="Related Loombus references">
        {referenceLinks.map(([href, title, description]) => (
          <Link key={href} href={href} className="loombus-reference-link">
            <strong>{title}</strong>
            <span>{description}</span>
          </Link>
        ))}
      </div>

      <nav className="loombus-guide-v2-nav" aria-label="Loombus guide sections">
        <div>
          {guideSections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
        </div>
      </nav>

      <div className="loombus-guide-v2-sections">
        {guideSections.map((section) => (
          <Panel key={section.id} className="loombus-guide-v2-section">
            <section id={section.id}>
              <p className="loombus-page-header-eyebrow">{section.eyebrow}</p>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </section>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
