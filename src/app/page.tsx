import type { Metadata } from "next";
import Link from "next/link";
import "./root-editorial-preview.css";

export const metadata: Metadata = {
  title: { absolute: "Loombus | Signal over noise" },
  description:
    "Loombus turns ideas into structured conversations, stronger understanding, meaningful connections, and real opportunities in one signal-first platform.",
  alternates: {
    canonical: "https://loombus.com/",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://loombus.com/#organization",
      name: "Loombus",
      url: "https://loombus.com/",
      logo: "https://loombus.com/icon.png",
      slogan: "Signal over noise",
      description:
        "Loombus is a signal-first platform where ideas become structured conversations, stronger understanding, meaningful connections, and real opportunities.",
    },
    {
      "@type": "WebSite",
      "@id": "https://loombus.com/#website",
      url: "https://loombus.com/",
      name: "Loombus",
      description:
        "Loombus turns ideas into structured conversations, stronger understanding, meaningful connections, and real opportunities.",
      publisher: { "@id": "https://loombus.com/#organization" },
    },
  ],
};

const pillars = [
  {
    index: "01",
    title: "Ideas",
    description:
      "Start with a question, claim, problem, possibility, passage, or observation worth examining.",
  },
  {
    index: "02",
    title: "Discussion",
    description:
      "Move beyond reaction with structured conversations designed to make disagreement and context easier to follow.",
  },
  {
    index: "03",
    title: "Evidence",
    description:
      "Bring sources, attachments, research, and lived context into the conversation instead of separating them from it.",
  },
  {
    index: "04",
    title: "Knowledge",
    description:
      "Turn useful conversations into something people can return to, understand, and build on later.",
  },
];

const destinations = [
  {
    title: "Structured discussions",
    description:
      "Open discussions, debates, research questions, and problem solving with clearer context and durable replies.",
    href: "/create",
    label: "Explore discussions",
  },
  {
    title: "Library",
    description:
      "Read publications, keep your place, save notes and highlights, and move from a passage into a larger conversation.",
    href: "/create",
    label: "Open Library",
  },
  {
    title: "Rooms",
    description:
      "Private spaces for communities, organizations, classrooms, neighborhoods, teams, and shared work.",
    href: "/create",
    label: "Explore Rooms",
  },
];

export default function RootPage() {
  return (
    <main className="root-editorial-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <header className="root-editorial-header">
        <Link href="/" className="root-editorial-brand" aria-label="Loombus home">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" />
          <span>Loombus</span>
        </Link>
        <nav className="root-editorial-header-actions" aria-label="Primary">
          <Link href="/about">About</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/signup" className="root-editorial-primary-link">
            Join Loombus
          </Link>
        </nav>
      </header>

      <section className="root-editorial-hero" aria-labelledby="root-editorial-title">
        <div className="root-editorial-hero-copy">
          <p className="root-editorial-eyebrow">Signal over noise</p>
          <h1 id="root-editorial-title">You deserve better than the scroll.</h1>
          <p className="root-editorial-deck">
            Loombus is social media rebuilt around ideas, discussion, evidence, and
            knowledge — so time online can leave you with something worth keeping.
          </p>
          <div className="root-editorial-hero-actions">
            <Link href="/signup" className="root-editorial-primary-link">
              Get started
            </Link>
            <Link href="/create" className="root-editorial-text-link">
              See what people are discussing <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <aside className="root-editorial-manifesto" aria-label="Why Loombus">
          <p className="root-editorial-eyebrow">A different premise</p>
          <p>
            Most platforms optimize for another swipe. Loombus is organized around
            what happens after an idea catches your attention: understanding it,
            challenging it, supporting it, and turning it into something useful.
          </p>
        </aside>
      </section>

      <section className="root-editorial-sequence" aria-labelledby="root-editorial-sequence-title">
        <header className="root-editorial-section-heading">
          <p className="root-editorial-eyebrow">How Loombus works</p>
          <h2 id="root-editorial-sequence-title">From signal to something durable.</h2>
        </header>
        <div className="root-editorial-pillar-list">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="root-editorial-pillar">
              <span>{pillar.index}</span>
              <div>
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="root-editorial-destinations" aria-labelledby="root-editorial-destinations-title">
        <header className="root-editorial-section-heading">
          <p className="root-editorial-eyebrow">One platform, different ways in</p>
          <h2 id="root-editorial-destinations-title">Follow the idea wherever it needs to go.</h2>
        </header>
        <div className="root-editorial-destination-list">
          {destinations.map((destination) => (
            <article key={destination.title} className="root-editorial-destination">
              <div>
                <h3>{destination.title}</h3>
                <p>{destination.description}</p>
              </div>
              <Link href={destination.href}>
                {destination.label} <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="root-editorial-closing" aria-labelledby="root-editorial-closing-title">
        <p className="root-editorial-eyebrow">Loombus</p>
        <h2 id="root-editorial-closing-title">Make the time online give something back.</h2>
        <p>
          Join the conversation, follow ideas worth returning to, and build a signal-first
          space around what you actually care about.
        </p>
        <Link href="/signup" className="root-editorial-primary-link">
          Join Loombus
        </Link>
      </section>

      <footer className="root-editorial-footer">
        <span>Loombus · Signal over noise</span>
        <nav aria-label="Footer">
          <Link href="/about">About</Link>
          <Link href="/guidelines">Guidelines</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
