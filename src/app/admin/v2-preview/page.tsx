"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Bookmark,
  CalendarDays,
  FileText,
  FlaskConical,
  Home,
  Lock,
  Mail,
  MessageCircle,
  Plus,
  Reply,
  Search,
  Send,
  Settings2,
  Share2,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";

type PreviewPageKey = "home" | "discussions" | "detail" | "create" | "rooms" | "messages";

type PreviewPage = {
  key: PreviewPageKey;
  label: string;
  summary: string;
};

const previewPages: PreviewPage[] = [
  {
    key: "home",
    label: "Home",
    summary: "Signal Brief, needs attention, featured signal, recent signals, and rooms.",
  },
  {
    key: "discussions",
    label: "Discussions",
    summary: "Browse discussions by topic, mode, relevance, saved folders, and contributor signals.",
  },
  {
    key: "detail",
    label: "Discussion Detail",
    summary: "Focused post, replies, state of the discussion, signal activity, and AI tools.",
  },
  {
    key: "create",
    label: "Create",
    summary: "Guided discussion creation with title, topic, mode, purpose, body, tags, and context.",
  },
  {
    key: "rooms",
    label: "Rooms",
    summary: "Dedicated spaces for labs, local groups, private communities, and expert-led rooms.",
  },
  {
    key: "messages",
    label: "Messages",
    summary: "Focused private messaging with files, shared links, details, and archive controls.",
  },
];

const discussions = [
  {
    title: "The Future of Decentralized Identity",
    topic: "Technology",
    mode: "Research Question",
    author: "Nadia Karim",
    lab: "Loombus Lab",
    metric: "1.2k",
    replies: 128,
    tone: "blue",
  },
  {
    title: "Should AI labs be regulated?",
    topic: "Society",
    mode: "Debate",
    author: "Ethan Cole",
    lab: "Civic Futures Lab",
    metric: "980",
    replies: 96,
    tone: "purple",
  },
  {
    title: "Climate Tech Roadmap 2030",
    topic: "Science",
    mode: "Problem Solving",
    author: "Mira Patel",
    lab: "Open Systems Lab",
    metric: "870",
    replies: 84,
    tone: "green",
  },
  {
    title: "Designing Better Communities",
    topic: "Governance",
    mode: "Open Discussion",
    author: "Alex Rivera",
    lab: "Community Lab",
    metric: "640",
    replies: 64,
    tone: "orange",
  },
];

const rooms = [
  {
    name: "Loombus Research Lab",
    description: "Research, experiments, and insights about the future of communities.",
    type: "Lab",
    members: "1.2k",
    icon: FlaskConical,
  },
  {
    name: "Builders’ Room",
    description: "A space for builders and operators sharing ideas and solving challenges.",
    type: "Expert",
    members: "980",
    icon: Users,
  },
  {
    name: "Civic Futures Lab",
    description: "Designing better systems and policies for stronger communities.",
    type: "Community",
    members: "870",
    icon: Shield,
  },
  {
    name: "Condo Residents Network",
    description: "Private resident communication without posting to the main discussion page.",
    type: "Private",
    members: "640",
    icon: Lock,
  },
];

const messages = [
  ["Mason Alvarado", "Thanks! I’ll share the deck shortly.", "9:41 AM"],
  ["Nadia Karim", "Sounds good. Let’s sync tomorrow.", "9:12 AM"],
  ["Builders’ Room Admin", "Reminder: Community call today at 4pm.", "Yesterday"],
  ["Civic Futures Lab", "New document shared.", "May 19"],
];

function ShellNav({ active }: { active: PreviewPageKey }) {
  const navItems = [
    ["home", "Home", Home],
    ["discussions", "Discussions", MessageCircle],
    ["create", "Create", Plus],
    ["rooms", "Rooms", Users],
    ["messages", "Messages", Mail],
  ] as const;

  return (
    <div className="flex items-center justify-between rounded-t-[2rem] bg-[#001a44] px-6 py-4 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-2xl bg-blue-500/20 text-blue-200">
          <span className="text-lg font-black">L</span>
        </div>
        <span className="text-xl font-semibold tracking-tight">Loombus</span>
      </div>

      <nav className="hidden items-center gap-1 lg:flex">
        {navItems.map(([key, label, Icon]) => (
          <span
            key={key}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
              active === key
                ? "bg-white text-[#001a44]"
                : "text-blue-100/80"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-3 text-blue-100">
        <Search className="size-5" />
        <Bell className="size-5" />
        <div className="grid size-9 place-items-center rounded-full bg-white text-sm font-semibold text-[#001a44]">
          S
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
      {children}
    </span>
  );
}

function MetricCard({ icon, title, body, count }: { icon: React.ReactNode; title: string; body: string; count?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-600">
          {icon}
        </div>
        {count ? (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
            {count}
          </span>
        ) : null}
      </div>
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}

function DiscussionCard({ item }: { item: (typeof discussions)[number] }) {
  const gradientMap: Record<string, string> = {
    blue: "from-blue-700 to-cyan-400",
    purple: "from-violet-700 to-fuchsia-400",
    green: "from-emerald-700 to-lime-300",
    orange: "from-orange-600 to-amber-300",
  };

  return (
    <article className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`hidden h-28 w-32 shrink-0 rounded-2xl bg-gradient-to-br ${gradientMap[item.tone]} sm:block`} />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge>{item.topic}</Badge>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            {item.mode}
          </span>
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-950">{item.title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Exploring trust, clarity, and better outcomes through structured discussion.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{item.author}</span>
          <span>{item.lab}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" /> {item.replies}</span>
          <span className="inline-flex items-center gap-1"><TrendingUp className="size-3.5" /> {item.metric}</span>
          <Bookmark className="ml-auto size-4 text-slate-400" />
        </div>
      </div>
    </article>
  );
}

function SidebarPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
      {children}
    </aside>
  );
}

function MobilePreview({ active }: { active: PreviewPageKey }) {
  const content = useMemo(() => {
    if (active === "rooms") {
      return rooms.map((room) => (
        <div key={room.name} className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="font-semibold text-slate-950">{room.name}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{room.description}</p>
          <p className="mt-2 text-xs text-blue-600">{room.members} members · Active now</p>
        </div>
      ));
    }

    if (active === "messages") {
      return messages.map(([name, body, time]) => (
        <div key={name} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="grid size-10 place-items-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">{name[0]}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-950">{name}</p>
            <p className="truncate text-xs text-slate-500">{body}</p>
          </div>
          <span className="text-[10px] text-slate-400">{time}</span>
        </div>
      ));
    }

    if (active === "create") {
      return ["Discussion Title", "Topic", "Discussion Mode", "Purpose", "Body"].map((field) => (
        <div key={field} className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-500">{field}</p>
          <div className="mt-2 h-8 rounded-xl bg-slate-50" />
        </div>
      ));
    }

    return discussions.slice(0, 3).map((item) => <DiscussionCard key={item.title} item={item} />);
  }, [active]);

  return (
    <div className="rounded-[2.25rem] border-[10px] border-slate-950 bg-slate-100 shadow-2xl">
      <div className="rounded-[1.55rem] bg-white">
        <div className="flex items-center justify-between rounded-t-[1.55rem] bg-[#001a44] px-5 py-4 text-white">
          <span className="font-semibold">Loombus</span>
          <div className="flex items-center gap-3">
            <Bell className="size-4" />
            <div className="grid size-7 place-items-center rounded-full bg-white text-xs font-bold text-[#001a44]">S</div>
          </div>
        </div>
        <div className="h-[560px] overflow-hidden px-4 py-5">
          <h3 className="text-xl font-bold tracking-tight text-slate-950">
            {previewPages.find((page) => page.key === active)?.label}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Mobile-first V2 shell preview.
          </p>
          <div className="mt-4 space-y-3">{content}</div>
        </div>
        <div className="grid grid-cols-5 rounded-b-[1.55rem] border-t border-slate-200 bg-white px-3 py-3 text-[10px] text-slate-500">
          {[Home, MessageCircle, Plus, Users, Mail].map((Icon, index) => (
            <div key={index} className="grid place-items-center gap-1">
              <Icon className="size-4 text-blue-600" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HomePreview() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold tracking-tight text-slate-950">Welcome back, Saint.</h2>
        <p className="mt-2 text-slate-500">Here is what needs attention across your Loombus activity.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard icon={<MessageCircle className="size-5" />} title="New Replies" body="2 unread replies in 2 discussions." count="2" />
        <MetricCard icon={<Bookmark className="size-5" />} title="Saved Discussions" body="4 discussions saved for later review." count="4" />
        <MetricCard icon={<FlaskConical className="size-5" />} title="Labs Updates" body="3 updates from labs you follow." count="3" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Featured Signal</p>
          <div className="grid gap-5 md:grid-cols-[220px_1fr]">
            <div className="min-h-48 rounded-3xl bg-gradient-to-br from-blue-950 via-blue-700 to-cyan-300" />
            <div>
              <Badge>Technology</Badge>
              <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">The Future of Decentralized Identity</h3>
              <p className="mt-2 max-w-xl leading-7 text-slate-500">
                Exploring trust, privacy, and interoperability in the next generation of digital identity.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">View Discussion</button>
                <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Save</button>
              </div>
            </div>
          </div>
        </article>

        <SidebarPanel title="Trending Topics">
          <div className="space-y-3 text-sm">
            {['Decentralized Identity', 'AI Alignment', 'Climate Tech', 'Digital Commons', 'Web3 Governance'].map((topic, index) => (
              <div key={topic} className="flex items-center justify-between gap-3">
                <span className="text-slate-700">{index + 1}. {topic}</span>
                <span className="text-blue-600">{["1.2k", "980", "870", "640", "520"][index]}</span>
              </div>
            ))}
          </div>
        </SidebarPanel>
      </section>
    </div>
  );
}

function DiscussionsPreview() {
  return (
    <div className="grid gap-5 xl:grid-cols-[220px_1fr_280px]">
      <SidebarPanel title="Browse Topics">
        <div className="space-y-2 text-sm">
          {['Technology', 'Society', 'Governance', 'Science', 'Local', 'Business'].map((topic, index) => (
            <div key={topic} className={`rounded-2xl px-3 py-2 ${index === 0 ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600'}`}>
              {topic}
            </div>
          ))}
        </div>
      </SidebarPanel>

      <section className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-slate-400">
            <Search className="size-5" />
            <span>Search discussions, topics, and contributors</span>
            <Settings2 className="ml-auto size-5" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['All', 'Following', 'Research Questions', 'Debates', 'Problem Solving', 'Saved', 'Trending'].map((filter, index) => (
              <span key={filter} className={`rounded-full px-4 py-2 text-sm font-semibold ${index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{filter}</span>
            ))}
          </div>
        </div>
        {discussions.map((item) => <DiscussionCard key={item.title} item={item} />)}
      </section>

      <SidebarPanel title="Top Contributors">
        <div className="space-y-4 text-sm">
          {['Nadia Karim', 'Mason Alvarado', 'Mira Patel', 'Alex Rivera'].map((name) => (
            <div key={name} className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-blue-50 font-semibold text-blue-700">{name[0]}</div>
              <div>
                <p className="font-semibold text-slate-800">{name}</p>
                <p className="text-xs text-slate-500">1.2k signals</p>
              </div>
            </div>
          ))}
        </div>
      </SidebarPanel>
    </div>
  );
}

function DetailPreview() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <section className="space-y-5">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge>Technology</Badge>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">Research Question</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">The Future of Decentralized Identity</h2>
          <p className="mt-3 text-sm text-slate-500">Nadia Karim · Loombus Lab · May 20, 2025 · 10:32 AM</p>
          <div className="mt-6 space-y-4 leading-7 text-slate-700">
            <p>Exploring trust, privacy, and interoperability in the next generation of digital identity.</p>
            <p>What are the biggest blockers to mainstream adoption — and what would it take to get there?</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Reply className="size-4" /> Reply</button>
            <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"><Bookmark className="size-4" /> Save</button>
            <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"><Share2 className="size-4" /> Share</button>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-950">64 Replies</h3>
            <span className="text-sm text-blue-600">Newest</span>
          </div>
          {['Mason Alvarado', 'Priya Desai', 'Alex Chen'].map((name, index) => (
            <div key={name} className={`border-t border-slate-100 py-5 ${index === 2 ? 'rounded-2xl bg-blue-50 px-4' : ''}`}>
              <p className="font-semibold text-slate-900">{name}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Interoperability is still the hardest piece. Without shared standards, we keep building walled gardens.
              </p>
            </div>
          ))}
        </article>
      </section>

      <section className="space-y-5">
        <SidebarPanel title="State of the Discussion">
          <div className="space-y-4 text-sm leading-6 text-slate-600">
            <p><strong className="text-slate-900">Key takeaways:</strong> interoperability, UX, and regulatory alignment are the top barriers.</p>
            <p><strong className="text-slate-900">Open questions:</strong> standards, privacy compliance, and adoption incentives.</p>
            <p><strong className="text-slate-900">Agreement:</strong> users should own their identity.</p>
          </div>
        </SidebarPanel>
        <SidebarPanel title="AI Tools">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {['Summary', 'Key Takeaways', 'What Changed', 'Conversation Map'].map((tool) => (
              <button key={tool} className="rounded-2xl border border-slate-200 p-4 font-semibold text-slate-700">{tool}</button>
            ))}
          </div>
        </SidebarPanel>
      </section>
    </div>
  );
}

function CreatePreview() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-3xl font-bold tracking-tight text-slate-950">Create Discussion</h2>
        <p className="mt-2 text-slate-500">Start a meaningful conversation. Give your community something worth discussing.</p>

        <div className="mt-6 space-y-5">
          {['Discussion Title', 'Topic', 'Purpose'].map((label) => (
            <label key={label} className="block">
              <span className="text-sm font-semibold text-slate-700">{label} <span className="text-red-500">*</span></span>
              <div className="mt-2 h-11 rounded-2xl border border-slate-200 bg-slate-50" />
            </label>
          ))}

          <div>
            <p className="text-sm font-semibold text-slate-700">Discussion Mode</p>
            <div className="mt-2 grid gap-3 md:grid-cols-4">
              {['Open Discussion', 'Debate', 'Research Question', 'Problem Solving'].map((mode, index) => (
                <div key={mode} className={`rounded-3xl border p-4 text-center ${index === 0 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}>
                  <p className="font-semibold">{mode}</p>
                  <p className="mt-1 text-xs">{index === 0 ? 'Open-ended conversation' : 'Guided response format'}</p>
                </div>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Body <span className="text-red-500">*</span></span>
            <div className="mt-2 h-32 rounded-2xl border border-slate-200 bg-slate-50" />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4"><FileText className="mb-2 size-5 text-blue-600" /> Attach Files</div>
            <div className="rounded-2xl border border-slate-200 p-4"><Share2 className="mb-2 size-5 text-blue-600" /> Video Context</div>
          </div>

          <button className="w-full rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white">Publish Discussion</button>
        </div>
      </section>

      <SidebarPanel title="Create with Clarity">
        <div className="space-y-5 text-sm leading-6 text-slate-600">
          {['Choose a clear title', 'Add context', 'Select the right mode', 'Invite meaningful responses'].map((step, index) => (
            <div key={step} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{index + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </SidebarPanel>
    </div>
  );
}

function RoomsPreview() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <section className="space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-slate-400">
            <Search className="size-5" />
            <span>Search rooms and communities</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['All Rooms', 'Local', 'Expert', 'Private', 'Following', 'Trending'].map((filter, index) => (
              <span key={filter} className={`rounded-full px-4 py-2 text-sm font-semibold ${index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{filter}</span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {rooms.map((room) => {
            const Icon = room.icon;
            return (
              <article key={room.name} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start gap-4">
                  <div className="grid size-14 place-items-center rounded-2xl bg-blue-600 text-white"><Icon className="size-6" /></div>
                  <div>
                    <h3 className="font-bold text-slate-950">{room.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{room.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>{room.members} members · {room.type}</span>
                  <button className="rounded-2xl bg-blue-600 px-4 py-2 font-semibold text-white">View Room</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-5">
        <SidebarPanel title="Your Rooms">
          <div className="space-y-3 text-sm">
            {rooms.slice(0, 3).map((room) => <p key={room.name} className="text-slate-700">{room.name}</p>)}
          </div>
        </SidebarPanel>
        <SidebarPanel title="Upcoming Room Events">
          <div className="space-y-4 text-sm">
            {['Research Briefing', 'Builders Office Hour', 'Civic Tech Roundtable'].map((event, index) => (
              <div key={event} className="flex gap-3">
                <CalendarDays className="size-5 text-blue-600" />
                <div><p className="font-semibold text-slate-800">{event}</p><p className="text-xs text-slate-500">May {22 + index}</p></div>
              </div>
            ))}
          </div>
        </SidebarPanel>
      </section>
    </div>
  );
}

function MessagesPreview() {
  return (
    <div className="grid min-h-[660px] gap-5 xl:grid-cols-[300px_1fr_300px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Messages</h2>
          <button className="grid size-10 place-items-center rounded-2xl bg-blue-600 text-white"><Plus className="size-5" /></button>
        </div>
        <div className="mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-400">Search messages</div>
        <div className="space-y-2">
          {messages.map(([name, body, time], index) => (
            <div key={name} className={`rounded-2xl p-3 ${index === 0 ? 'bg-blue-50' : 'bg-white'}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{name}</p>
                <span className="text-xs text-slate-400">{time}</span>
              </div>
              <p className="mt-1 truncate text-sm text-slate-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="grid size-11 place-items-center rounded-full bg-blue-50 font-semibold text-blue-700">M</div>
          <div>
            <p className="font-bold text-slate-950">Mason Alvarado</p>
            <p className="text-xs text-emerald-600">Online</p>
          </div>
        </div>
        <div className="space-y-5">
          <div className="max-w-md rounded-3xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">Hey Saint, thanks for leading the discussion yesterday. The ideas on decentralized identity really resonated.</div>
          <div className="ml-auto max-w-md rounded-3xl bg-blue-600 p-4 text-sm leading-6 text-white">Thanks, Mason. I’ll put together a summary and share it here.</div>
          <div className="max-w-md rounded-3xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">Perfect. I attached the slide deck from our chat.</div>
          <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">Trust Models Overview.pdf · 1.8 MB</div>
        </div>
        <div className="mt-10 flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-slate-400">
          <span>Write a message</span>
          <Send className="ml-auto size-5 text-blue-600" />
        </div>
      </section>

      <SidebarPanel title="Conversation Details">
        <div className="space-y-5 text-sm text-slate-600">
          <div className="text-center">
            <div className="mx-auto mb-3 grid size-16 place-items-center rounded-full bg-blue-50 text-xl font-bold text-blue-700">M</div>
            <p className="font-bold text-slate-950">Mason Alvarado</p>
            <p>Head of Community at Loombus</p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-slate-900">Shared files</p>
            <p>Trust Models Overview.pdf</p>
            <p>Decentralized Identity.png</p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-slate-900">Shared links</p>
            <p>Designing Better Communities</p>
            <p>Climate Tech Roadmap 2030</p>
          </div>
        </div>
      </SidebarPanel>
    </div>
  );
}

function DesktopPreview({ active }: { active: PreviewPageKey }) {
  const content = {
    home: <HomePreview />,
    discussions: <DiscussionsPreview />,
    detail: <DetailPreview />,
    create: <CreatePreview />,
    rooms: <RoomsPreview />,
    messages: <MessagesPreview />,
  }[active];

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 shadow-2xl">
      <ShellNav active={active === "detail" ? "discussions" : active} />
      <div className="p-6 lg:p-8">{content}</div>
    </div>
  );
}

export default function V2PreviewPage() {
  const [active, setActive] = useState<PreviewPageKey>("home");
  const activePage = previewPages.find((page) => page.key === active) ?? previewPages[0];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-blue-300">Admin Preview · Not Live</p>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Loombus V2 Shell Preview</h1>
              <p className="mt-4 max-w-3xl leading-7 text-slate-300">
                Review the proposed V2 shell before we connect live data or expose it to users. This page is intentionally static and admin-only.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-5 py-4 text-sm leading-6 text-blue-100">
              Current view: <strong>{activePage.label}</strong><br />
              {activePage.summary}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {previewPages.map((page) => (
              <button
                key={page.key}
                onClick={() => setActive(page.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active === page.key
                    ? "bg-white text-slate-950"
                    : "bg-white/10 text-slate-300 hover:bg-white/15"
                }`}
              >
                {page.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
          <section>
            <div className="sticky top-8 space-y-5">
              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Mobile View</p>
                <MobilePreview active={active} />
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-300">
                <p className="font-semibold text-white">Approval notes</p>
                <p className="mt-2">
                  Use this page to decide layout, naming, flow, and priority before we wire V2 to Supabase data. Current users are not affected.
                </p>
              </div>
            </div>
          </section>

          <section>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Desktop View</p>
            <DesktopPreview active={active} />
          </section>
        </div>
      </div>
    </main>
  );
}
