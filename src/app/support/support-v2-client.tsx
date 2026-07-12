"use client";

import Link from "next/link";
import {
  Accessibility,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
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
    description: "Learn the main Loombus workspaces and how to begin moving with Signal.",
    eyebrow: "Start here",
    href: "/settings/guide#getting-started",
    keywords: ["start", "guide", "home", "profile", "new member"],
    Icon: Sparkles,
  },
  {
    id: "account-security",
    title: "Account & security",
    description: "Manage sign-in, password, profile, privacy, blocking, and account controls.",
    eyebrow: "Account help",
    href: "/settings",
    keywords: ["account", "login", "password", "email", "security", "block", "settings"],
    Icon: LockKeyhole,
  },
  {
    id: "signal-discussions",
    title: "Signal & discussions",
    description: "Understand Signal, create focused discussions, reply well, and find topics.",
    eyebrow: "Platform guidance",
    href: "/settings/guide#signal",
    keywords: ["signal", "discussion", "reply", "create", "topic", "post"],
    Icon: MessageCircle,
  },
  {
    id: "notifications-messages",
    title: "Notifications & messages",
    description: "Use the Signal Inbox, manage alerts, and work with private conversations.",
    eyebrow: "Communication",
    href: "/notifications",
    keywords: ["notification", "alert", "inbox", "message", "reply", "mention"],
    Icon: Bell,
  },
  {
    id: "rooms-community",
    title: "Rooms & community",
    description: "Find help with private Rooms, membership, roles, invitations, and shared tools.",
    eyebrow: "Room help",
    href: "/rooms",
    keywords: ["room", "private", "member", "invite", "role", "community", "hoa"],
    Icon: Users,
  },
  {
    id: "premium-billing",
    title: "Premium & billing",
    description: "Review plans, AI limits, billing paths, subscriptions, and refund guidance.",
    eyebrow: "Plan support",
    href: "/premium",
    keywords: ["premium", "billing", "payment", "subscription", "refund", "ai usage"],
    Icon: CreditCard,
  },
  {
    id: "safety-privacy",
    title: "Safety & privacy",
    description: "Report harmful behavior, review platform rules, and manage privacy controls.",
    eyebrow: "Trust center",
    href: "/safety",
    keywords: ["safety", "privacy", "report", "block", "harassment", "guidelines"],
    Icon: ShieldCheck,
  },
  {
    id: "accessibility-mobile",
    title: "Accessibility & mobile",
    description: "Get help with accessible use, device behavior, and the mobile experience.",
    eyebrow: "Device help",
    href: "/accessibility",
    keywords: ["accessibility", "mobile", "iphone", "android", "device", "screen reader"],
    Icon: Accessibility,
  },
];

const helpArticles: HelpArticle[] = [
  {
    title: "How to start using Loombus",
    description: "Profile, Home, Discussions, Create, and the first steps for a new member.",
    category: "Getting started",
    href: "/settings/guide#getting-started",
    keywords: ["start", "new", "guide", "profile", "home"],
    Icon: BookOpen,
  },
  {
    title: "What Signal means",
    description: "How Loombus uses useful activity without turning Signal into a popularity score.",
    category: "Signal",
    href: "/settings/guide#signal",
    keywords: ["signal", "views", "replies", "saves", "activity"],
    Icon: Sparkles,
  },
  {
    title: "Create a focused discussion",
    description: "Use a clear title, enough context, a Topic, and a reason for thoughtful replies.",
    category: "Discussions",
    href: "/settings/guide#create",
    keywords: ["create", "discussion", "topic", "title", "post"],
    Icon: MessageCircle,
  },
  {
    title: "Browse and follow Signal Topics",
    description: "Find topic pages, follow supported alerts, and open topic-filtered Signal.",
    category: "Topics",
    href: "/topics",
    keywords: ["topic", "follow", "alert", "directory", "signal topics"],
    Icon: Tags,
  },
  {
    title: "Manage Account & Signal Settings",
    description: "Appearance, Signal Inbox preferences, topic alerts, password, blocking, and account actions.",
    category: "Settings",
    href: "/settings",
    keywords: ["settings", "appearance", "password", "notification", "account", "topic alert"],
    Icon: LockKeyhole,
  },
  {
    title: "Use the Signal Inbox",
    description: "Review replies, follows, discussions, messages, and system notifications.",
    category: "Notifications",
    href: "/notifications",
    keywords: ["signal inbox", "notification", "unread", "reply", "message"],
    Icon: Bell,
  },
  {
    title: "Use private Rooms",
    description: "Open your Rooms and work with discussions, calendars, files, forms, roles, and controls.",
    category: "Rooms",
    href: "/rooms",
    keywords: ["rooms", "private", "calendar", "files", "forms", "roles"],
    Icon: Users,
  },
  {
    title: "Premium plans and AI usage",
    description: "Review plan access, AI limits, and current usage before reporting a billing issue.",
    category: "Premium",
    href: "/ai-usage",
    keywords: ["premium", "ai", "usage", "limit", "billing", "plan"],
    Icon: CreditCard,
  },
  {
    title: "Safety, blocking, and reporting",
    description: "Use in-platform reporting where possible and block members when interaction must stop.",
    category: "Safety",
    href: "/settings/guide#safety",
    keywords: ["safety", "block", "report", "moderation", "harassment"],
    Icon: ShieldCheck,
  },
  {
    title: "Accessibility support",
    description: "Review accessibility information and submit device or assistive-technology details.",
    category: "Accessibility",
    href: "/accessibility",
    keywords: ["accessibility", "screen reader", "keyboard", "device", "feedback"],
    Icon: Accessibility,
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextEmail = session?.user.email ?? "";
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
        message: "Unable to submit the support request. Check your connection and try again.",
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
          <h1>Find answers. Keep moving with Signal.</h1>
          <p className="support-v2-hero-copy">
            Search platform guidance, open the right workspace, or send a structured
            request to the Loombus support queue.
          </p>

          <div className="support-v2-search-row">
            <label className="support-v2-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Search Loombus help</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Signal, accounts, Rooms, billing, safety, mobile..."
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
                  {filteredHelpAreas.length} area{filteredHelpAreas.length === 1 ? "" : "s"}
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
                  <h2 id="support-help-articles">Popular help topics</h2>
                </div>
                <span className="support-v2-result-count">
                  {filteredHelpArticles.length} result{filteredHelpArticles.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="support-v2-panel">
                <div className="support-v2-article-list">
                  {filteredHelpArticles.map(({ Icon, ...article }) => (
                    <Link key={`${article.href}-${article.title}`} href={article.href} className="support-v2-article">
                      <span className="support-v2-article-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="support-v2-article-copy">
                        <strong>{article.title}</strong>
                        <span>{article.description}</span>
                      </span>
                      <span className="support-v2-article-meta">{article.category}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="support-v2-section support-v2-no-results" aria-live="polite">
            <h2>No help topics match “{query.trim()}”</h2>
            <p>
              Try a broader word, clear the search, or send the support team a structured request.
            </p>
            <div className="support-v2-actions" style={{ justifyContent: "center" }}>
              <button type="button" className="support-v2-clear-search" onClick={() => setQuery("")}>
                Clear search
              </button>
              <button type="button" className="support-v2-primary-button" onClick={() => openSupportForm("general")}>
                Contact support
              </button>
            </div>
          </section>
        )}

        <section ref={supportFormRef} className="support-v2-contact-layout" aria-labelledby="support-request-title">
          <div className="support-v2-form-card">
            <p className="support-v2-section-kicker">Structured request</p>
            <h2 id="support-request-title">Contact Loombus Support</h2>
            <p className="support-v2-form-intro">
              Use this form for account access, Premium billing, safety, accessibility,
              bugs, platform feedback, or legal and rights concerns.
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
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <label className="support-v2-field">
                  <span className="support-v2-form-label">Category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as SupportCategoryValue)}
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
                  onChange={(event) => setSubject(event.target.value)}
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
                  onChange={(event) => setMessageBody(event.target.value)}
                  minLength={10}
                  maxLength={4000}
                  placeholder="Include the relevant page, what you expected, what happened, steps to reproduce, and any useful account or device context. Never include passwords or verification codes."
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
                <button type="submit" className="support-v2-submit" disabled={submitting}>
                  <Mail aria-hidden="true" />
                  {submitting ? "Submitting..." : "Submit support request"}
                </button>
                <span className="support-v2-direct-email">
                  Direct email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
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
                <li>Use in-app reporting for a specific discussion, reply, profile, or message when available.</li>
                <li>Include links, the device or browser, and steps to reproduce a bug.</li>
                <li>Never send passwords, verification codes, card numbers, or authentication tokens.</li>
              </ul>
            </section>

            <section className="support-v2-aside-card">
              <span className="support-v2-aside-icon">
                <ShieldCheck aria-hidden="true" />
              </span>
              <h3>Safety and policy resources</h3>
              <p>
                For immediate physical danger, contact local emergency services. For platform concerns, use Loombus reporting and support.
              </p>
              <div className="support-v2-aside-links">
                <Link href="/safety">Safety <ChevronRight aria-hidden="true" /></Link>
                <Link href="/privacy">Privacy <ChevronRight aria-hidden="true" /></Link>
                <Link href="/guidelines">Guidelines <ChevronRight aria-hidden="true" /></Link>
                <Link href="/blocked-users">Blocked members <ChevronRight aria-hidden="true" /></Link>
              </div>
            </section>

            <section className="support-v2-aside-card">
              <span className="support-v2-aside-icon">
                <Smartphone aria-hidden="true" />
              </span>
              <h3>Billing, rights, and access</h3>
              <div className="support-v2-aside-links">
                <Link href="/refunds">Refund policy <ChevronRight aria-hidden="true" /></Link>
                <Link href="/dmca">Copyright / DMCA <ChevronRight aria-hidden="true" /></Link>
                <Link href="/terms">Terms <ChevronRight aria-hidden="true" /></Link>
                <Link href="/accessibility">Accessibility <ChevronRight aria-hidden="true" /></Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
