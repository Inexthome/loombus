"use client";

import Link from "next/link";
import {
  Accessibility,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Handshake,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Tags,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";

const SUPPORT_EMAIL = "support@loombus.com";

type SupportCategoryValue =
  | "general"
  | "account"
  | "billing"
  | "safety"
  | "accessibility"
  | "bug"
  | "feedback"
  | "legal";

type HelpArea = {
  id: string;
  title: string;
  description: string;
  eyebrow: string;
  href: string;
  keywords: string[];
  Icon: LucideIcon;
};

type HelpArticle = {
  title: string;
  description: string;
  category: string;
  href: string;
  keywords: string[];
  Icon: LucideIcon;
};

type SubmissionState = {
  tone: "success" | "error";
  message: string;
} | null;

const supportCategoryOptions: Array<{
  value: SupportCategoryValue;
  label: string;
}> = [
  { value: "general", label: "General support" },
  { value: "account", label: "Account access" },
  { value: "billing", label: "Billing or Premium" },
  { value: "safety", label: "Safety concern" },
  { value: "accessibility", label: "Accessibility issue" },
  { value: "bug", label: "Bug report" },
  { value: "feedback", label: "Platform feedback" },
  { value: "legal", label: "Legal / rights concern" },
];

const supportCategoryValues = new Set<SupportCategoryValue>(
  supportCategoryOptions.map((option) => option.value)
);

const helpAreas: HelpArea[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description:
      "Learn the Loombus workspaces, complete profile setup, and publish your first focused contribution.",
    eyebrow: "Start here",
    href: "/settings/guide#getting-started",
    keywords: ["start", "guide", "home", "profile", "new member", "onboarding"],
    Icon: Sparkles,
  },
  {
    id: "account-security",
    title: "Account & security",
    description:
      "Manage sign-in, passwords, device access, privacy, blocking, notifications, and account actions.",
    eyebrow: "Account help",
    href: "/settings",
    keywords: [
      "account",
      "login",
      "password",
      "email",
      "apple",
      "google",
      "security",
      "block",
      "settings",
      "face id",
    ],
    Icon: LockKeyhole,
  },
  {
    id: "signal-discussions",
    title: "Signal & discussions",
    description:
      "Create structured discussions, use Reality Lenses, reply well, and understand State of the Discussion.",
    eyebrow: "Knowledge help",
    href: "/settings/guide#signal",
    keywords: [
      "signal",
      "discussion",
      "reply",
      "create",
      "topic",
      "reality lens",
      "state of discussion",
      "video context",
    ],
    Icon: MessageCircle,
  },
  {
    id: "search-ai",
    title: "Search & Loombus AI",
    description:
      "Search authorized Loombus content and use grounded AI answers with source links and clear privacy boundaries.",
    eyebrow: "Find and understand",
    href: "/search",
    keywords: [
      "search",
      "search everything",
      "ask loombus ai",
      "ai answer",
      "source",
      "results",
      "private room",
      "saved notes",
    ],
    Icon: Search,
  },
  {
    id: "notifications-messages",
    title: "Notifications & messages",
    description:
      "Use the Signal Inbox, manage alerts and push settings, and work with private conversations.",
    eyebrow: "Communication",
    href: "/notifications",
    keywords: [
      "notification",
      "alert",
      "inbox",
      "message",
      "reply",
      "mention",
      "push",
      "private conversation",
    ],
    Icon: Bell,
  },
  {
    id: "rooms-community",
    title: "Rooms & community",
    description:
      "Manage private Rooms, membership, invitations, roles, calendars, files, forms, and shared tools.",
    eyebrow: "Room help",
    href: "/rooms",
    keywords: [
      "room",
      "private",
      "member",
      "invite",
      "role",
      "community",
      "hoa",
      "calendar",
      "files",
      "forms",
      "polls",
    ],
    Icon: Users,
  },
  {
    id: "local-discovery",
    title: "Local & real-world discovery",
    description:
      "Find businesses, Services, Requests, Jobs, Events, Marketplace listings, and remote opportunities by place and availability.",
    eyebrow: "Discover locally",
    href: "/local",
    keywords: [
      "local",
      "distance",
      "radius",
      "location",
      "business",
      "service",
      "request",
      "job",
      "event",
      "marketplace",
      "remote",
    ],
    Icon: MapPin,
  },
  {
    id: "services-matching",
    title: "Services, appointments & matches",
    description:
      "Publish or find Services and Requests, manage appointment activity, and review compatibility suggestions.",
    eyebrow: "Coordinate work",
    href: "/services",
    keywords: [
      "services",
      "requests",
      "appointments",
      "matches",
      "matching",
      "provider",
      "inquiry",
      "booking",
    ],
    Icon: Handshake,
  },
  {
    id: "marketplace-jobs-events",
    title: "Marketplace, Jobs & Events",
    description:
      "Get help publishing, finding, reviewing, reporting, or managing real-world listings and opportunities.",
    eyebrow: "Directory help",
    href: "/marketplace",
    keywords: [
      "marketplace",
      "seller",
      "buyer",
      "jobs",
      "employer",
      "event",
      "organizer",
      "listing",
      "approval",
    ],
    Icon: Store,
  },
  {
    id: "premium-billing",
    title: "Premium & billing",
    description:
      "Review plans, AI limits, Video Context limits, web or app-store billing, subscriptions, and refunds.",
    eyebrow: "Plan support",
    href: "/premium",
    keywords: [
      "premium",
      "billing",
      "payment",
      "subscription",
      "refund",
      "ai usage",
      "apple",
      "app store",
      "video context",
    ],
    Icon: CreditCard,
  },
  {
    id: "safety-privacy",
    title: "Safety, privacy & rights",
    description:
      "Report harmful behavior, protect personal information, review policies, and raise legal or copyright concerns.",
    eyebrow: "Trust center",
    href: "/safety",
    keywords: [
      "safety",
      "privacy",
      "report",
      "block",
      "harassment",
      "guidelines",
      "copyright",
      "dmca",
      "minor",
      "teen",
    ],
    Icon: ShieldCheck,
  },
  {
    id: "accessibility-mobile",
    title: "Accessibility & mobile",
    description:
      "Get help with keyboard or screen-reader access, themes, zoom, media, iOS, Android, and device behavior.",
    eyebrow: "Access help",
    href: "/accessibility",
    keywords: [
      "accessibility",
      "mobile",
      "iphone",
      "android",
      "device",
      "screen reader",
      "keyboard",
      "zoom",
      "contrast",
    ],
    Icon: Accessibility,
  },
];

const helpArticles: HelpArticle[] = [
  {
    title: "How to start using Loombus",
    description:
      "Set up your profile, learn Home and Discussions, follow topics, and create your first contribution.",
    category: "Getting started",
    href: "/settings/guide#getting-started",
    keywords: ["start", "new", "guide", "profile", "home", "onboarding"],
    Icon: BookOpen,
  },
  {
    title: "What Signal means",
    description:
      "Understand contribution and activity indicators without treating Signal as a popularity or identity score.",
    category: "Signal",
    href: "/settings/guide#signal",
    keywords: ["signal", "score", "views", "replies", "saves", "activity"],
    Icon: Sparkles,
  },
  {
    title: "Create a focused discussion",
    description:
      "Use a clear title, written context, Topic, Reality Lens, purpose, sources, and supported attachments.",
    category: "Discussions",
    href: "/create",
    keywords: [
      "create",
      "discussion",
      "topic",
      "title",
      "post",
      "reality lens",
      "video context",
      "attachment",
    ],
    Icon: MessageCircle,
  },
  {
    title: "Browse and follow Signal Topics",
    description:
      "Open topic pages, follow supported alerts, and find focused discussion activity.",
    category: "Topics",
    href: "/topics",
    keywords: ["topic", "follow", "alert", "directory", "signal topics"],
    Icon: Tags,
  },
  {
    title: "Search Everything inside Loombus",
    description:
      "Search discussions, people, authorized Room content, saved items, files, listings, and platform destinations.",
    category: "Search",
    href: "/search",
    keywords: [
      "search everything",
      "search",
      "room content",
      "saved",
      "file",
      "listing",
      "results",
    ],
    Icon: Search,
  },
  {
    title: "Use Ask Loombus AI",
    description:
      "Generate a grounded answer from permitted Loombus sources and open source links to verify the result.",
    category: "AI",
    href: "/search",
    keywords: [
      "ask loombus ai",
      "grounded answer",
      "source links",
      "privacy",
      "ai usage",
      "premium",
    ],
    Icon: Sparkles,
  },
  {
    title: "Use the Signal Inbox",
    description:
      "Review replies, follows, messages, Room activity, reminders, and system notifications.",
    category: "Notifications",
    href: "/notifications",
    keywords: ["signal inbox", "notification", "unread", "reply", "message", "push"],
    Icon: Bell,
  },
  {
    title: "Use private Rooms",
    description:
      "Work with discussions, announcements, calendars, events, files, resources, forms, polls, roles, and members.",
    category: "Rooms",
    href: "/rooms",
    keywords: [
      "rooms",
      "private",
      "calendar",
      "files",
      "forms",
      "roles",
      "polls",
      "members",
    ],
    Icon: Users,
  },
  {
    title: "Find businesses and Services",
    description:
      "Browse attributable business profiles and Service offerings, review details, and send supported inquiries.",
    category: "Businesses",
    href: "/businesses",
    keywords: ["business", "services", "provider", "inquiry", "directory", "local"],
    Icon: Store,
  },
  {
    title: "Publish or find a Request",
    description:
      "Describe a service, recommendation, quote, consultation, or community need and connect it to possible providers.",
    category: "Requests",
    href: "/requests",
    keywords: ["request", "need", "quote", "consultation", "help", "provider"],
    Icon: Handshake,
  },
  {
    title: "Review Intelligent Matches",
    description:
      "Open private Request-to-Service and Service-to-Request compatibility suggestions and verify fit independently.",
    category: "Matching",
    href: "/matches",
    keywords: ["matches", "matching", "compatibility", "service", "request", "suggestion"],
    Icon: Handshake,
  },
  {
    title: "Manage appointment activity",
    description:
      "Review appointment services and requests, status, timing, and provider communication.",
    category: "Appointments",
    href: "/appointments",
    keywords: ["appointment", "booking", "provider", "request", "schedule", "status"],
    Icon: CalendarDays,
  },
  {
    title: "Use Loombus Local",
    description:
      "Filter real-world results by place, radius, type, remote status, event date, and availability.",
    category: "Local",
    href: "/local",
    keywords: ["local", "place", "radius", "distance", "remote", "date", "availability"],
    Icon: MapPin,
  },
  {
    title: "Browse Marketplace safely",
    description:
      "Review attributable sellers and item details, understand Loombus transaction limits, and report suspicious listings.",
    category: "Marketplace",
    href: "/marketplace",
    keywords: ["marketplace", "seller", "buyer", "listing", "item", "fraud", "report"],
    Icon: ShoppingBag,
  },
  {
    title: "Find or post Jobs",
    description:
      "Review attributable employer information, job details, remote status, and common recruiting-scam warning signs.",
    category: "Jobs",
    href: "/jobs",
    keywords: ["job", "employer", "hiring", "career", "remote", "application", "scam"],
    Icon: BriefcaseBusiness,
  },
  {
    title: "Find or manage Events",
    description:
      "Review organizer, date, place or remote access, event details, reminders, and safety information.",
    category: "Events",
    href: "/events",
    keywords: ["event", "organizer", "date", "venue", "remote", "reminder", "calendar"],
    Icon: CalendarDays,
  },
  {
    title: "Premium plans, AI limits, and Video Context",
    description:
      "Review plan access, monthly AI usage, Video Context limits, and current entitlement status.",
    category: "Premium",
    href: "/ai-usage",
    keywords: [
      "premium",
      "ai",
      "usage",
      "limit",
      "billing",
      "plan",
      "video context",
    ],
    Icon: CreditCard,
  },
  {
    title: "Billing, cancellation, and refunds",
    description:
      "Identify the purchase channel and follow the correct web or app-store billing process.",
    category: "Billing",
    href: "/refunds",
    keywords: [
      "billing",
      "cancel",
      "refund",
      "apple",
      "app store",
      "subscription",
      "charge",
    ],
    Icon: CreditCard,
  },
  {
    title: "Safety, blocking, and reporting",
    description:
      "Use the closest in-product report control, block unwanted contact, and understand emergency limits.",
    category: "Safety",
    href: "/safety",
    keywords: ["safety", "block", "report", "moderation", "harassment", "emergency"],
    Icon: ShieldCheck,
  },
  {
    title: "Privacy and Cookie Use",
    description:
      "Review data categories, Room and message boundaries, search and AI processing, location, billing, and browser storage.",
    category: "Privacy",
    href: "/privacy",
    keywords: [
      "privacy",
      "cookies",
      "data",
      "location",
      "search",
      "ai",
      "messages",
      "rooms",
    ],
    Icon: LockKeyhole,
  },
  {
    title: "Accessibility support",
    description:
      "Report keyboard, screen-reader, contrast, zoom, motion, media, file, mobile, or third-party barriers.",
    category: "Accessibility",
    href: "/accessibility",
    keywords: [
      "accessibility",
      "screen reader",
      "keyboard",
      "device",
      "feedback",
      "zoom",
      "contrast",
    ],
    Icon: Accessibility,
  },
  {
    title: "Copyright and DMCA",
    description:
      "Submit a copyright notice, counter-notice, or another rights concern with exact content locations.",
    category: "Legal",
    href: "/dmca",
    keywords: [
      "copyright",
      "dmca",
      "takedown",
      "counter notice",
      "trademark",
      "rights",
    ],
    Icon: FileText,
  },
];

function matchesSearch(values: string[], query: string) {
  if (!query) return true;
  return values.join(" ").toLowerCase().includes(query);
}

export default function SupportV2Client() {
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<SupportCategoryValue>("general");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accountContextLoading, setAccountContextLoading] = useState(true);
  const [signedInEmail, setSignedInEmail] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>(null);
  const supportFormRef = useRef<HTMLElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAccountContext() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const nextEmail = data.user?.email ?? "";
      setSignedInEmail(nextEmail);
      if (nextEmail) setEmail(nextEmail);
      setAccountContextLoading(false);
    }

    void loadAccountContext();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user?: { email?: string } } | null) => {
      const nextEmail = session?.user?.email ?? "";
      setSignedInEmail(nextEmail);
      if (nextEmail) setEmail(nextEmail);
      setAccountContextLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedCategory = params.get("category") as SupportCategoryValue | null;

    if (requestedCategory && supportCategoryValues.has(requestedCategory)) {
      setCategory(requestedCategory);
    }
  }, []);

  const cleanQuery = query.trim().toLowerCase();

  const filteredHelpAreas = useMemo(
    () =>
      helpAreas.filter((area) =>
        matchesSearch(
          [area.title, area.description, area.eyebrow, ...area.keywords],
          cleanQuery
        )
      ),
    [cleanQuery]
  );

  const filteredHelpArticles = useMemo(
    () =>
      helpArticles.filter((article) =>
        matchesSearch(
          [article.title, article.description, article.category, ...article.keywords],
          cleanQuery
        )
      ),
    [cleanQuery]
  );

  const resultCount = filteredHelpAreas.length + filteredHelpArticles.length;
  const hasResults = resultCount > 0;

  function openSupportForm(nextCategory?: SupportCategoryValue) {
    if (nextCategory) setCategory(nextCategory);
    setSubmissionState(null);
    supportFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => subjectRef.current?.focus(), 450);
  }

  async function submitSupportRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setSubmissionState(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          email,
          category,
          subject,
          message: messageBody,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSubmissionState({
          tone: "error",
          message: result.error ?? "Unable to submit the support request.",
        });
        return;
      }

      setSubject("");
      setMessageBody("");
      setSubmissionState({
        tone: "success",
        message:
          "Support request submitted. It is now available in the Loombus support queue for review.",
      });
    } catch {
      setSubmissionState({
        tone: "error",
        message:
          "Unable to submit the support request. Check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="support-v2-page">
      <div className="support-v2-shell">
        <header className="support-v2-hero">
          <p className="support-v2-eyebrow">Loombus Help & Support</p>
          <h1>Find answers across the complete Loombus platform.</h1>
          <p className="support-v2-hero-copy">
            Search platform guidance, open the right workspace, review trust and
            billing information, or send a structured request to the Loombus
            support queue.
          </p>

          <div className="support-v2-search-row">
            <label className="support-v2-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Search Loombus help</span>
              <input
                type="search"
                value={query}
                onChange={(event: { target: { value: string } }) => setQuery(event.target.value)}
                placeholder="Search discussions, Rooms, AI, Local, Services, Jobs, Marketplace, billing, safety..."
              />
            </label>

            <div className="support-v2-actions">
              <button
                type="button"
                className="support-v2-primary-button"
                onClick={() => openSupportForm("general")}
              >
                <LifeBuoy aria-hidden="true" />
                Contact support
              </button>
              <button
                type="button"
                className="support-v2-secondary-button"
                onClick={() => openSupportForm("bug")}
              >
                <Wrench aria-hidden="true" />
                Report a problem
              </button>
            </div>
          </div>

          <div className="support-v2-context-chips" aria-label="Support center details">
            <span className="support-v2-context-chip">Public help center</span>
            <span className="support-v2-context-chip">Structured support queue</span>
            <span className="support-v2-context-chip">Policy and trust resources</span>
            <span className="support-v2-context-chip">
              {accountContextLoading
                ? "Checking account context"
                : signedInEmail
                  ? "Signed-in context included"
                  : "Works without signing in"}
            </span>
          </div>
        </header>

        {hasResults ? (
          <>
            <section className="support-v2-section" aria-labelledby="support-help-areas">
              <div className="support-v2-section-heading">
                <div>
                  <p className="support-v2-section-kicker">Help by area</p>
                  <h2 id="support-help-areas">Go directly to the right workspace</h2>
                </div>
                <span className="support-v2-result-count">
                  {filteredHelpAreas.length} area
                  {filteredHelpAreas.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="support-v2-category-grid">
                {filteredHelpAreas.map(({ Icon, ...area }) => (
                  <Link key={area.id} href={area.href} className="support-v2-card">
                    <span className="support-v2-card-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <h3>{area.title}</h3>
                    <p>{area.description}</p>
                    <span className="support-v2-card-link">
                      {area.eyebrow}
                      <ChevronRight aria-hidden="true" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="support-v2-section" aria-labelledby="support-help-articles">
              <div className="support-v2-section-heading">
                <div>
                  <p className="support-v2-section-kicker">Guides and actions</p>
                  <h2 id="support-help-articles">Help topics across Loombus</h2>
                </div>
                <span className="support-v2-result-count">
                  {filteredHelpArticles.length} result
                  {filteredHelpArticles.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="support-v2-panel">
                <div className="support-v2-article-list">
                  {filteredHelpArticles.map(({ Icon, ...article }) => (
                    <Link
                      key={`${article.href}-${article.title}`}
                      href={article.href}
                      className="support-v2-article"
                    >
                      <span className="support-v2-article-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="support-v2-article-copy">
                        <strong>{article.title}</strong>
                        <span>{article.description}</span>
                      </span>
                      <span className="support-v2-article-meta">
                        {article.category}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : (
          <section
            className="support-v2-section support-v2-no-results"
            aria-live="polite"
          >
            <h2>No help topics match “{query.trim()}”</h2>
            <p>
              Try a broader word, clear the search, or send the support team a
              structured request.
            </p>
            <div className="support-v2-actions" style={{ justifyContent: "center" }}>
              <button
                type="button"
                className="support-v2-clear-search"
                onClick={() => setQuery("")}
              >
                Clear search
              </button>
              <button
                type="button"
                className="support-v2-primary-button"
                onClick={() => openSupportForm("general")}
              >
                Contact support
              </button>
            </div>
          </section>
        )}

        <section
          ref={supportFormRef}
          className="support-v2-contact-layout"
          aria-labelledby="support-request-title"
        >
          <div className="support-v2-form-card">
            <p className="support-v2-section-kicker">Structured request</p>
            <h2 id="support-request-title">Contact Loombus Support</h2>
            <p className="support-v2-form-intro">
              Use this form for account access, Search or AI, Rooms, messages,
              Local, businesses, Services, Requests, Jobs, Events, Marketplace,
              appointments, matching, Premium billing, safety, accessibility,
              bugs, feedback, or legal and rights concerns.
            </p>

            <p className="support-v2-account-note">
              <CheckCircle2 aria-hidden="true" />
              {accountContextLoading
                ? "Checking whether a signed-in account can be attached."
                : signedInEmail
                  ? `Signed-in account email prefilled: ${signedInEmail}`
                  : "You can submit without signing in. Enter the email where support should follow up."}
            </p>

            <form className="support-v2-form" onSubmit={submitSupportRequest}>
              <div className="support-v2-form-grid">
                <label className="support-v2-field">
                  <span className="support-v2-form-label">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event: { target: { value: string } }) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <label className="support-v2-field">
                  <span className="support-v2-form-label">Category</span>
                  <select
                    value={category}
                    onChange={(event: { target: { value: string } }) =>
                      setCategory(event.target.value as SupportCategoryValue)
                    }
                  >
                    {supportCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="support-v2-field">
                <span className="support-v2-form-label">Subject</span>
                <input
                  ref={subjectRef}
                  type="text"
                  value={subject}
                  onChange={(event: { target: { value: string } }) => setSubject(event.target.value)}
                  minLength={3}
                  maxLength={160}
                  placeholder="Briefly describe what you need help with"
                  required
                />
              </label>

              <label className="support-v2-field">
                <span className="support-v2-form-label">Message</span>
                <textarea
                  value={messageBody}
                  onChange={(event: { target: { value: string } }) => setMessageBody(event.target.value)}
                  minLength={10}
                  maxLength={4000}
                  placeholder="Include the exact page or listing, what you expected, what happened, steps to reproduce, relevant dates, and useful account or device context. Never include passwords, verification codes, authentication tokens, or full payment details."
                  required
                />
                <span>{messageBody.length}/4000 characters</span>
              </label>

              {submissionState && (
                <p
                  className={`support-v2-status is-${submissionState.tone}`}
                  role={submissionState.tone === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {submissionState.message}
                </p>
              )}

              <div className="support-v2-form-footer">
                <button
                  type="submit"
                  className="support-v2-submit"
                  disabled={submitting}
                >
                  <Mail aria-hidden="true" />
                  {submitting ? "Submitting..." : "Submit support request"}
                </button>
                <span className="support-v2-direct-email">
                  Direct email:{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                </span>
              </div>
            </form>
          </div>

          <aside className="support-v2-aside-stack" aria-label="Support guidance">
            <section className="support-v2-aside-card">
              <span className="support-v2-aside-icon">
                <FileText aria-hidden="true" />
              </span>
              <h3>Before submitting</h3>
              <ul>
                <li>
                  Use in-product reporting for a specific discussion, reply,
                  profile, message, Room item, business, Service, Request, Job,
                  Event, or Marketplace listing when available.
                </li>
                <li>
                  Include exact links, dates, the device or browser, and steps to
                  reproduce a technical problem.
                </li>
                <li>
                  Never send passwords, verification codes, card numbers,
                  authentication tokens, or illegal material.
                </li>
              </ul>
            </section>

            <section className="support-v2-aside-card">
              <span className="support-v2-aside-icon">
                <ShieldCheck aria-hidden="true" />
              </span>
              <h3>Safety and policy resources</h3>
              <p>
                For immediate physical danger, contact local emergency services.
                Loombus reports and support requests are not monitored as emergency
                channels.
              </p>
              <div className="support-v2-aside-links">
                <Link href="/safety">
                  Safety <ChevronRight aria-hidden="true" />
                </Link>
                <Link href="/privacy">
                  Privacy <ChevronRight aria-hidden="true" />
                </Link>
                <Link href="/guidelines">
                  Guidelines <ChevronRight aria-hidden="true" />
                </Link>
                <Link href="/blocked-users">
                  Blocked members <ChevronRight aria-hidden="true" />
                </Link>
              </div>
            </section>

            <section className="support-v2-aside-card">
              <span className="support-v2-aside-icon">
                <Smartphone aria-hidden="true" />
              </span>
              <h3>Billing, rights, and access</h3>
              <div className="support-v2-aside-links">
                <Link href="/refunds">
                  Refund policy <ChevronRight aria-hidden="true" />
                </Link>
                <Link href="/dmca">
                  Copyright / DMCA <ChevronRight aria-hidden="true" />
                </Link>
                <Link href="/terms">
                  Terms <ChevronRight aria-hidden="true" />
                </Link>
                <Link href="/cookies">
                  Cookie use <ChevronRight aria-hidden="true" />
                </Link>
                <Link href="/accessibility">
                  Accessibility <ChevronRight aria-hidden="true" />
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
