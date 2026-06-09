import Link from "next/link";

const guideSections = [
  {
    id: "getting-started",
    eyebrow: "Start here",
    title: "Getting started",
    body: "Loombus is built for focused discussions, clearer thinking, and quieter community interaction. Start by completing your profile, choosing your appearance, reading discussions, saving useful threads, and creating one thoughtful post when you are ready.",
    bullets: [
      "Complete your profile so people know who they are reading.",
      "Use Home as your personal signal hub.",
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
      "Avoid replies that only react without adding signal.",
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
    eyebrow: "Alerts",
    title: "Notifications and alerts",
    body: "Alerts help you return to meaningful activity such as replies, mentions, follows, messages, and discussion updates.",
    bullets: [
      "Use alerts to return to conversations.",
      "Filter alert types when the inbox gets busy.",
      "Adjust notification preferences from Profile or Settings when needed.",
    ],
  },
  {
    id: "appearance",
    eyebrow: "Appearance",
    title: "Light, System, and Dark",
    body: "Appearance controls the visual mode of Loombus. Use the floating Appearance button or Settings to switch between Light, System, and Dark without changing your account data.",
    bullets: [
      "Light uses a brighter interface.",
      "Dark uses the original Loombus dark style.",
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
      "Use folders, notes, and Stickies to organize saved knowledge.",
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

export default function LoombusGuidePage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6 lg:py-14">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/settings"
          className="mb-8 inline-flex rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
        >
          ← Back to Settings
        </Link>

        <section className="mb-8 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
            Loombus Guide
          </p>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            How to use Loombus.
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            A central guide for what each area does, where to go, and how the main Loombus concepts work. Page Help buttons can link directly to the matching section here.
          </p>
        </section>

        <nav
          aria-label="Loombus guide sections"
          className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20"
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {guideSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
              >
                {section.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="grid gap-5">
          {guideSections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20 sm:p-7"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-600">
                {section.eyebrow}
              </p>

              <h2 className="text-2xl font-semibold tracking-tight text-white">
                {section.title}
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                {section.body}
              </p>

              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="rounded-2xl border border-zinc-800 bg-black/40 p-4 text-sm leading-relaxed text-zinc-400"
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
