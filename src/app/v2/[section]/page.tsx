"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Bell,
  Bookmark,
  Clock3,
  Crown,
  FlaskConical,
  FolderOpen,
  HelpCircle,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  StickyNote,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
};

type ShellCard = {
  title: string;
  description: string;
  meta: string;
};

type ShellSection = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  chips: string[];
  searchPlaceholder: string;
  cards: ShellCard[];
  sideTitle: string;
  sideItems: string[];
  footer: Array<{ title: string; description: string }>;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
];

const SECTIONS: Record<string, ShellSection> = {
  people: {
    slug: "people",
    title: "People",
    eyebrow: "Discover",
    description: "Find thoughtful contributors, mutual connections, and people shaping useful discussions.",
    chips: ["All", "Following", "Followers", "Mutual", "Suggested", "Top Contributors"],
    searchPlaceholder: "Search people, bios, topics, and rooms",
    cards: [
      { title: "Nadia Karim", description: "Research lead focused on trust, identity, and decentralized systems.", meta: "1.8k followers · 128 mutual" },
      { title: "Mason Alvarado", description: "Community builder creating spaces for meaningful dialogue.", meta: "1.4k followers · 96 mutual" },
      { title: "Mira Patel", description: "Engineer focused on climate technology and sustainable infrastructure.", meta: "1.2k followers · 74 mutual" },
      { title: "Alex Rivera", description: "Policy researcher and advisor on digital rights and governance.", meta: "980 followers · 48 mutual" },
    ],
    sideTitle: "Suggested People",
    sideItems: ["Priya Desai", "Ethan Cole", "James Wu"],
    footer: [
      { title: "Thoughtful Contributors", description: "Connect with verified voices who share valuable insights." },
      { title: "Mutual Connections", description: "See shared context before following or messaging." },
      { title: "Relevant Expertise", description: "Discover people by topic, role, and contribution quality." },
    ],
  },
  labs: {
    slug: "labs",
    title: "Labs",
    eyebrow: "Discover",
    description: "Explore research, experiments, and early Loombus features. Follow labs, review updates, and request access.",
    chips: ["All Labs", "Following", "Research", "Product Experiments", "Civic", "Technology", "Requested"],
    searchPlaceholder: "Search labs, experiments, and updates",
    cards: [
      { title: "Loombus Research Lab", description: "Advancing decentralized systems, identity, trust, and social coordination.", meta: "1.8k members · 124 followers" },
      { title: "Civic Futures Lab", description: "Designing civic tools and infrastructure for participatory communities.", meta: "1.4k members · 96 followers" },
      { title: "Open Systems Lab", description: "Building open protocols, open data, and interoperable social systems.", meta: "980 members · 72 followers" },
      { title: "AI Conversation Tools Lab", description: "Exploring ethical AI tools that enhance meaningful conversations.", meta: "870 members · 54 followers" },
    ],
    sideTitle: "Your Lab Access",
    sideItems: ["Loombus Research Lab", "Open Systems Lab", "AI Conversation Tools Lab", "Climate Solutions Hub"],
    footer: [
      { title: "Research & Experiments", description: "Explore early features and real-world experiments." },
      { title: "Early Access", description: "Request access to labs and preview future tools." },
      { title: "Insightful Updates", description: "Stay informed with lab updates and findings." },
    ],
  },
  topics: {
    slug: "topics",
    title: "Topics",
    eyebrow: "Discover",
    description: "Browse topic lanes that organize discussion without turning Loombus into an endless feed.",
    chips: ["All", "Technology", "Society", "Science", "Governance", "Local", "Business"],
    searchPlaceholder: "Search topics and discussion lanes",
    cards: [
      { title: "AI & Society", description: "How AI changes culture, work, knowledge, and human relationships.", meta: "42 discussions · 18 active today" },
      { title: "Science", description: "Research questions, discoveries, and careful debate around evidence.", meta: "31 discussions · 9 active today" },
      { title: "Parenting & Family", description: "Everyday lived experience, practical wisdom, and shared reflection.", meta: "16 discussions · 4 active today" },
      { title: "Governance", description: "Policy, public systems, community rules, and civic problem-solving.", meta: "24 discussions · 7 active today" },
    ],
    sideTitle: "Trending Topics",
    sideItems: ["AI & Society", "Science", "Governance", "Local Voices"],
    footer: [
      { title: "Topic Lanes", description: "Keep conversations organized by purpose and subject." },
      { title: "Find Signal", description: "Jump into areas where useful conversations are forming." },
      { title: "Follow Topics", description: "Track themes you care about across Loombus." },
    ],
  },
  following: {
    slug: "following",
    title: "Following",
    eyebrow: "Discover",
    description: "Updates from the people, rooms, topics, discussions, and labs you follow.",
    chips: ["All", "People", "Rooms", "Topics", "Labs", "Discussions"],
    searchPlaceholder: "Search followed people, rooms, topics, and labs",
    cards: [
      { title: "Nadia Karim started a discussion", description: "The Future of Decentralized Identity", meta: "2h ago · Technology" },
      { title: "Civic Futures Lab published a weekly update", description: "Highlights from civic research and experiments.", meta: "3h ago · Lab" },
      { title: "Mason Alvarado replied to a discussion you follow", description: "AI Alignment in Practice", meta: "4h ago · Research" },
      { title: "Climate Tech topic has 6 new discussions", description: "Top discussions this week from climate infrastructure.", meta: "5h ago · Environment" },
    ],
    sideTitle: "Manage Following",
    sideItems: ["People 128", "Rooms 16", "Topics 24", "Labs 8", "Discussions 56"],
    footer: [
      { title: "Personalized Signals", description: "Curated updates from what you follow most." },
      { title: "Followed Updates", description: "See latest activity from people, rooms, topics, and labs." },
      { title: "Stay in Context", description: "Never miss what matters across Loombus." },
    ],
  },
  saved: {
    slug: "saved",
    title: "Saved",
    eyebrow: "Library",
    description: "Your personal library for discussions, replies, files, and links.",
    chips: ["All Saved", "Discussions", "Replies", "Folders", "Files", "Links", "Unfiled"],
    searchPlaceholder: "Search saved discussions, replies, files, and folders",
    cards: [
      { title: "The Future of Decentralized Identity", description: "Saved discussion with strong signal around identity systems.", meta: "Saved 2h ago" },
      { title: "Ethics of AI Alignment", description: "Saved reply from an ongoing discussion.", meta: "Saved 1h ago" },
      { title: "Climate Tech Roadmap 2030", description: "Research question saved for later review.", meta: "Saved 3h ago" },
      { title: "Web3 Governance Models", description: "PDF attached from a discussion.", meta: "Saved 1d ago" },
    ],
    sideTitle: "Saved Folders",
    sideItems: ["Decentralized Identity", "AI Safety", "Climate & Energy", "Condo Residents", "Unfiled"],
    footer: [
      { title: "Personal Library", description: "Save discussions, replies, files, and links in one place." },
      { title: "Organized Folders", description: "Group saved items by topic or project." },
      { title: "Quick Return", description: "Jump back into what matters." },
    ],
  },
  stickies: {
    slug: "stickies",
    title: "Stickies",
    eyebrow: "Library",
    description: "Capture useful thoughts, reminders, and discussion notes.",
    chips: ["All", "Private", "Discussion Notes", "Room Notes", "Follow-ups", "Pinned", "Archived"],
    searchPlaceholder: "Search notes, tags, and attached sources",
    cards: [
      { title: "Follow up with Nadia on DID research", description: "She mentioned a framework for verifiable credentials to review next week.", meta: "Attached to: The Future of Decentralized Identity" },
      { title: "Builders’ Room takeaways", description: "Community incentives and long-term sustainability notes.", meta: "Attached to: Builders’ Room" },
      { title: "Remember to review governance poll", description: "Check poll results and share insights with the team.", meta: "Attached to: Web3 Governance" },
      { title: "Contributor onboarding checklist", description: "Create a simple checklist to help new contributors get started.", meta: "Attached to: Open Systems Lab" },
    ],
    sideTitle: "Pinned Stickies",
    sideItems: ["Follow up with Nadia", "Builders’ Room takeaways", "Review governance poll"],
    footer: [
      { title: "Private Notes", description: "Keep reminders private and secure." },
      { title: "Discussion Memory", description: "Capture key insights from discussions." },
      { title: "Follow-up Reminders", description: "Track next steps and stay on top of what matters." },
    ],
  },
  "reading-history": {
    slug: "reading-history",
    title: "Reading History",
    eyebrow: "Library",
    description: "Return to discussions, rooms, people, and labs you recently viewed.",
    chips: ["All", "Discussions", "Rooms", "People", "Labs", "Files"],
    searchPlaceholder: "Search your history",
    cards: [
      { title: "The Future of Decentralized Identity", description: "3 new replies since you viewed it.", meta: "Read 80% · 2h ago" },
      { title: "Builders’ Room", description: "12 new messages since you viewed it.", meta: "Read 65% · 3h ago" },
      { title: "Nadia Karim", description: "Viewed profile.", meta: "1h ago" },
      { title: "Loombus Research Lab", description: "2 new updates since you viewed it.", meta: "Read 40% · Yesterday" },
    ],
    sideTitle: "Continue Reading",
    sideItems: ["The Future of Decentralized Identity", "Climate Tech Roadmap 2030"],
    footer: [
      { title: "Resume Reading", description: "Jump back into anything you were reading." },
      { title: "Pick Up Where You Left Off", description: "Track progress across devices." },
      { title: "Private History", description: "Your reading history stays in your control." },
    ],
  },
  "my-activity": {
    slug: "my-activity",
    title: "My Activity",
    eyebrow: "My Loombus",
    description: "Review your recent contributions, saves, follows, and account activity.",
    chips: ["All", "Replies", "Discussions", "Saves", "Follows", "Rooms", "Labs", "Messages"],
    searchPlaceholder: "Search your activity",
    cards: [
      { title: "You replied to The Future of Decentralized Identity", description: "Great discussion on decentralized identity and portability.", meta: "1h ago" },
      { title: "You saved Climate Tech Roadmap 2030", description: "Important roadmap outlining key technologies for climate impact.", meta: "3h ago" },
      { title: "You followed Nadia Karim", description: "Loombus Lab contributor.", meta: "2h ago" },
      { title: "Your discussion received 4 replies", description: "Rethinking Reputation in Web3", meta: "8h ago" },
    ],
    sideTitle: "Activity Summary",
    sideItems: ["Replies 12", "Discussions 8", "Saves 15", "Follows 9"],
    footer: [
      { title: "Activity Timeline", description: "A clear view of engagement across Loombus." },
      { title: "Needs Attention", description: "See replies and updates that need your input." },
      { title: "Private by Default", description: "Your activity remains controlled by you." },
    ],
  },
  "my-discussions": {
    slug: "my-discussions",
    title: "My Discussions",
    eyebrow: "My Loombus",
    description: "Manage discussions you started, drafted, or archived.",
    chips: ["Published", "Drafts", "Archived", "Needs Attention"],
    searchPlaceholder: "Search your discussions",
    cards: [
      { title: "The Future of Decentralized Identity", description: "Exploring trust, privacy, and interoperability in the next generation of digital identity.", meta: "Published · 128 replies · 1.2k views" },
      { title: "Designing Better Communities", description: "How urban design, policy, and technology can create livable and equitable communities.", meta: "Published · 64 replies · 640 views" },
      { title: "Should AI labs be regulated?", description: "Balancing innovation and safety in advanced AI development.", meta: "Draft · Last edited 3h ago" },
      { title: "Local Voice Networks", description: "Building community-owned networks that strengthen local communication.", meta: "Published · 37 replies · 410 views" },
    ],
    sideTitle: "Drafts",
    sideItems: ["AI Safety in Open Models", "Web3 Governance Models", "Climate Education in Schools"],
    footer: [
      { title: "Manage Discussions", description: "Organize and take action on all your discussions." },
      { title: "Draft Control", description: "Create, edit, and save drafts before publishing." },
      { title: "Creator Workspace", description: "Manage, analyze, and grow your discussions." },
    ],
  },
  "my-replies": {
    slug: "my-replies",
    title: "My Replies",
    eyebrow: "My Loombus",
    description: "Review replies you posted across Loombus and jump back into the thread.",
    chips: ["All Replies", "Recent", "Highlighted", "Quoted", "With Responses"],
    searchPlaceholder: "Search your replies",
    cards: [
      { title: "The Future of Decentralized Identity", description: "Great point on portability. I’d add user-controlled encryption keys are critical.", meta: "You replied · 2h ago" },
      { title: "Should AI labs be regulated?", description: "A risk-based framework makes sense. Start with compute thresholds and transparency.", meta: "You replied · 5h ago" },
      { title: "Climate Tech Roadmap 2030", description: "Grid storage and transmission will be the bottleneck, not generation.", meta: "You replied · Yesterday" },
      { title: "Reputation in Web3", description: "Reputation should be portable, privacy-preserving, and resistant to manipulation.", meta: "You replied · May 19" },
    ],
    sideTitle: "Replies Getting Attention",
    sideItems: ["The Future of Decentralized Identity", "Should AI labs be regulated?", "Climate Tech Roadmap 2030"],
    footer: [
      { title: "Reply History", description: "Review every reply you posted." },
      { title: "Thread Re-entry", description: "Jump back into any conversation with one click." },
      { title: "Thoughtful Contributions", description: "Track the impact of your insights." },
    ],
  },
  profile: {
    slug: "profile",
    title: "Profile",
    eyebrow: "My Loombus",
    description: "Your profile, contributions, and presence across Loombus.",
    chips: ["Overview", "Discussions", "Replies", "Rooms", "Labs", "Contributions"],
    searchPlaceholder: "Search your profile activity",
    cards: [
      { title: "Profile Summary", description: "Exploring trust, identity, and decentralized systems. Building open systems for a better internet.", meta: "Researcher · Technology · Identity · Web3" },
      { title: "Featured Discussions", description: "Discussions that best represent your contribution style and interests.", meta: "128 discussions · 342 replies" },
      { title: "Recent Replies", description: "Recent responses you made across active threads.", meta: "342 total replies" },
      { title: "Rooms & Labs", description: "Spaces where you participate and contribute.", meta: "12 rooms · 4 labs" },
    ],
    sideTitle: "Known For",
    sideItems: ["Thoughtful Insights", "In-Depth Research", "Quality Contributor"],
    footer: [
      { title: "Identity & Presence", description: "Showcase who you are and what you care about." },
      { title: "Contribution Overview", description: "See your impact across discussions and rooms." },
      { title: "Manage Visibility", description: "Control how your profile appears on Loombus." },
    ],
  },
  settings: {
    slug: "settings",
    title: "Settings",
    eyebrow: "Account",
    description: "Manage account preferences, notifications, privacy, and app behavior.",
    chips: ["Account", "Notifications", "Privacy", "Security", "Display", "Billing"],
    searchPlaceholder: "Search settings",
    cards: [
      { title: "Account Preferences", description: "Update profile basics, language, timezone, and account defaults.", meta: "Profile and account" },
      { title: "Notifications", description: "Control email, push, message, reply, and follow notifications.", meta: "Messages · Replies · Rooms" },
      { title: "Privacy", description: "Manage visibility, activity, and who can contact you.", meta: "Profile visibility · Activity visibility" },
      { title: "Security", description: "Review sign-in methods and account protection.", meta: "Authentication and sessions" },
    ],
    sideTitle: "Quick Settings",
    sideItems: ["Profile visibility", "Notification preferences", "Account security"],
    footer: [
      { title: "Personal Control", description: "Configure Loombus around how you work." },
      { title: "Privacy First", description: "Decide how visible your activity should be." },
      { title: "Secure Access", description: "Keep your account protected." },
    ],
  },
  premium: {
    slug: "premium",
    title: "Premium",
    eyebrow: "Account",
    description: "Review Loombus plan options, premium tools, and current access.",
    chips: ["Plans", "Premium", "Premium Plus", "Billing", "AI Tools"],
    searchPlaceholder: "Search premium features",
    cards: [
      { title: "Premium", description: "Expanded AI tools, richer discussion support, and increased context features.", meta: "Monthly or annual" },
      { title: "Premium Plus", description: "More powerful AI assistance, deeper context features, and higher limits.", meta: "Monthly or annual" },
      { title: "AI Tools", description: "Summary, key takeaways, disagreement maps, and conversation mapping.", meta: "Available by plan" },
      { title: "Billing Portal", description: "Manage subscription, invoices, and payment methods.", meta: "Secure billing" },
    ],
    sideTitle: "Plan Highlights",
    sideItems: ["AI summaries", "Video context limits", "Advanced discussion tools"],
    footer: [
      { title: "Upgrade When Ready", description: "Choose the plan that fits how you use Loombus." },
      { title: "AI-Native Tools", description: "Use tools built for clarity and signal." },
      { title: "Manage Billing", description: "Keep plan and payment details in one place." },
    ],
  },
  support: {
    slug: "support",
    title: "Support",
    eyebrow: "Account",
    description: "Get help with your account, discussions, billing, safety, and technical issues.",
    chips: ["Help", "Account", "Billing", "Safety", "Technical", "Feedback"],
    searchPlaceholder: "Search support topics",
    cards: [
      { title: "Account Help", description: "Get help with login, profile, settings, and account access.", meta: "Common support" },
      { title: "Billing & Premium", description: "Questions about plans, subscriptions, invoices, and billing status.", meta: "Premium support" },
      { title: "Trust & Safety", description: "Report issues, review moderation help, and understand safety tools.", meta: "Safety and reporting" },
      { title: "Send Feedback", description: "Share what is confusing, missing, or not working in V2.", meta: "Product feedback" },
    ],
    sideTitle: "Helpful Links",
    sideItems: ["Contact support", "Report a problem", "Billing help", "Safety center"],
    footer: [
      { title: "Clear Help", description: "Find answers without leaving your workflow." },
      { title: "Issue Tracking", description: "Keep support requests organized." },
      { title: "Feedback Loop", description: "Help shape V2 before public release." },
    ],
  },
  "privacy-security": {
    slug: "privacy-security",
    title: "Privacy/Security",
    eyebrow: "Account",
    description: "Review visibility, account protection, privacy controls, and data-related preferences.",
    chips: ["Privacy", "Security", "Visibility", "Data", "Messages", "Teen Safety"],
    searchPlaceholder: "Search privacy and security settings",
    cards: [
      { title: "Profile Visibility", description: "Control who can see your profile, activity, and contribution history.", meta: "Public · Private · Limited" },
      { title: "Account Security", description: "Review sessions, sign-in methods, and account protection status.", meta: "Security controls" },
      { title: "Message Privacy", description: "Choose who can message you and how message notifications work.", meta: "Mutuals · Followers · No one" },
      { title: "Data & Permissions", description: "Review data controls and connected permissions.", meta: "Manage permissions" },
    ],
    sideTitle: "Privacy Controls",
    sideItems: ["Profile visibility", "Activity visibility", "Message controls", "Data permissions"],
    footer: [
      { title: "Private by Design", description: "Set boundaries around visibility and contact." },
      { title: "Secure Sessions", description: "Protect account access and devices." },
      { title: "Data Control", description: "Understand what Loombus stores and why." },
    ],
  },
};

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function getParamValue(param: string | string[] | undefined) {
  return (Array.isArray(param) ? param[0] : param ?? "").trim();
}

function getIcon(section: ShellSection) {
  const iconMap: Record<string, typeof Users> = {
    people: Users,
    labs: FlaskConical,
    topics: FolderOpen,
    following: Users,
    saved: Bookmark,
    stickies: StickyNote,
    "reading-history": Clock3,
    "my-activity": Clock3,
    "my-discussions": MessageCircle,
    "my-replies": MessageCircle,
    profile: UserRound,
    settings: Settings,
    premium: Crown,
    support: HelpCircle,
    "privacy-security": ShieldCheck,
  };
  return iconMap[section.slug] ?? FolderOpen;
}

function GateCard({ title, message, loading = false, payload }: { title: string; message: string; loading?: boolean; payload?: ShellPayload | null }) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>
        {payload && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</span>
          </div>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Back to V2 Home
          </Link>
          <Link href="/discussions" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Open V1
          </Link>
        </div>
      </section>
    </main>
  );
}

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] loombus-v2-top-nav shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
          <span className="text-xl">Loombus</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {V2_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Search className="size-5" />
          </Link>
          <Link href="/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Bell className="size-5" />
            <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">3</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 loombus-v2-bottom-nav px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {V2_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1 rounded-2xl py-2 text-slate-500">
              <Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function V2SecondaryShellPage() {
  const params = useParams<{ section?: string | string[] }>();
  const sectionSlug = getParamValue(params?.section);
  const section = SECTIONS[sectionSlug];
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeChip, setActiveChip] = useState(section?.chips[0] ?? "All");

  const filteredCards = useMemo(() => {
    if (!section) return [];
    const cleanQuery = query.trim().toLowerCase();
    return section.cards.filter((card) => !cleanQuery || `${card.title} ${card.description} ${card.meta}`.toLowerCase().includes(cleanQuery));
  }, [query, section]);

  async function loadShell() {
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 shell access. Current Loombus remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadShell();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!section) {
    return <GateCard title="V2 page not found" message="This V2 shell route is not available yet." payload={payload} />;
  }

  if (loading) return <GateCard title={`Loading ${section.title}`} message="Loombus is verifying access before loading this V2 shell page." loading />;
  if (message) return <GateCard title="V2 shell check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 shell is internal-only right now. Sign in first so Loombus can verify access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <GateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;
  }

  const Icon = getIcon(section);

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{section.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{section.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{section.description}</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={section.searchPlaceholder} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <button type="button" className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <Settings className="size-5" />
              </button>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {section.chips.map((chip) => (
                <button key={chip} type="button" onClick={() => setActiveChip(chip)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeChip === chip ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>
                  {chip}
                </button>
              ))}
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.12)] sm:p-5">
              <div className="space-y-3">
                {filteredCards.map((card, index) => (
                  <article key={card.title} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/30 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
                    <div className="grid size-16 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                      <Icon className="size-7" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-black text-slate-950">{card.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{card.description}</p>
                      <p className="mt-2 text-xs font-bold text-blue-700">{card.meta}</p>
                    </div>
                    <Link href="/v2/discussions" className="self-start rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-50">
                      {index === 0 ? "Open" : "View"}
                    </Link>
                  </article>
                ))}
                {filteredCards.length === 0 && <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">No items match this search.</div>}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.1)]">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">{section.sideTitle}</h2>
              <div className="mt-4 space-y-3">
                {section.sideItems.map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">{item}</div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-amber-700" /><h2 className="font-black text-amber-900">V2 shell pass</h2></div>
              <p className="mt-3 text-sm leading-6 text-amber-800">This page is a read-only V2 shell. Live writes, mutations, and route replacement stay guarded until final testing.</p>
            </section>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {section.footer.map((item) => (
            <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <Icon className="size-6 text-blue-600" />
              <h3 className="mt-3 font-black text-slate-950">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
            </div>
          ))}
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
