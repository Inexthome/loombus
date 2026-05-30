export const metadata = {
  title: "Loombus Mobile v3 Preview",
  description: "App-native mobile preview for Loombus.",
  robots: {
    index: false,
    follow: false,
  },
};

const discussions = [
  {
    signal: 72,
    title: "The future of work isn't remote. It's human.",
    preview:
      "Companies are learning that culture, creativity, and connection can't be outsourced.",
    author: "Saint Blanc",
    replies: 14,
    time: "2h ago",
  },
  {
    signal: 71,
    title: "We need a new playbook for digital trust.",
    preview:
      "Trust is becoming infrastructure. But who is building it for regular people?",
    author: "Maya Chen",
    replies: 9,
    time: "3h ago",
  },
  {
    signal: 68,
    title: "AI can write, but can it understand?",
    preview:
      "There is a gap between generation and comprehension that platforms need to address.",
    author: "David Lee",
    replies: 12,
    time: "1h ago",
  },
];

const people = [
  ["Maya Chen", "Entrepreneur & Writer", "Following"],
  ["David Lee", "Product Leader", "Following"],
  ["Alex Rivera", "AI Researcher", "Follow"],
  ["Priya Nair", "Designer & Creator", "Follow"],
];

function PhoneShell({
  title,
  children,
  active = "Home",
}: {
  title: string;
  children: React.ReactNode;
  active?: string;
}) {
  const nav = ["Home", "Discuss", "Create", "People", "Alerts"];

  return (
    <div className="mx-auto flex h-[760px] w-full max-w-[340px] flex-col overflow-hidden rounded-[2.25rem] border border-zinc-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between px-5 pb-3 pt-4 text-[11px] font-semibold text-zinc-950">
        <span>9:41</span>
        <span>●●● ▰</span>
      </div>

      <div className="flex items-center justify-between border-b border-zinc-100 px-5 pb-4">
        <h2 className="text-base font-black text-zinc-950">{title}</h2>
        <div className="flex items-center gap-3 text-lg text-zinc-800">
          <span>⌕</span>
          <span>☰</span>
        </div>
      </div>

      <main className="flex-1 overflow-hidden px-4 py-4">{children}</main>

      <div className="grid grid-cols-5 border-t border-zinc-100 bg-white px-2 pb-3 pt-2">
        {nav.map((item) => (
          <div
            key={item}
            className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-1 text-[10px] font-semibold ${
              active === item ? "text-violet-700" : "text-zinc-500"
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-2xl ${
                active === item ? "bg-violet-100" : "bg-transparent"
              }`}
            >
              {item === "Home"
                ? "⌂"
                : item === "Discuss"
                  ? "◔"
                  : item === "Create"
                    ? "+"
                    : item === "People"
                      ? "◎"
                      : "◌"}
            </span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function DiscussionCard({
  discussion,
}: {
  discussion: {
    signal: number;
    title: string;
    preview: string;
    author: string;
    replies: number;
    time: string;
  };
}) {
  return (
    <article className="rounded-3xl border border-zinc-100 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-zinc-500">
        <span>Signal {discussion.signal}</span>
        <span>⋮</span>
      </div>
      <h3 className="text-[15px] font-black leading-snug text-zinc-950">
        {discussion.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-zinc-600">
        {discussion.preview}
      </p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          {discussion.author} · {discussion.replies} replies · {discussion.time}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="rounded-2xl border border-zinc-200 px-3 py-2 text-[11px] font-bold text-zinc-800">
          Reply
        </button>
        <button className="rounded-2xl border border-zinc-200 px-3 py-2 text-[11px] font-bold text-zinc-800">
          Save
        </button>
      </div>
    </article>
  );
}

function HomePreview() {
  return (
    <PhoneShell title="Loombus" active="Home">
      <div className="space-y-4">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700">
            Today
          </p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-zinc-950">
            Good morning, Saint.
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Here’s what is worth your attention.
          </p>
        </section>

        <section className="rounded-3xl bg-gradient-to-br from-violet-700 to-indigo-700 p-4 text-white shadow-xl">
          <div className="text-[11px] font-semibold opacity-80">
            Continue reading
          </div>
          <h3 className="mt-2 text-base font-black leading-tight">
            The future of work isn’t remote. It’s human.
          </h3>
          <p className="mt-2 text-xs leading-relaxed opacity-80">
            Signal 72 · Saint Blanc · 2h ago
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-zinc-950">
              Worth replying to
            </h2>
            <span className="text-xs font-bold text-violet-700">View all</span>
          </div>
          <div className="space-y-3">
            {discussions.slice(1).map((discussion) => (
              <DiscussionCard key={discussion.title} discussion={discussion} />
            ))}
          </div>
        </section>
      </div>
    </PhoneShell>
  );
}

function DiscussionsPreview() {
  const chips = ["All", "Work", "AI", "Life", "Business"];

  return (
    <PhoneShell title="Loombus" active="Discuss">
      <div className="space-y-4">
        <div className="grid grid-cols-4 rounded-3xl bg-zinc-100 p-1 text-center text-[12px] font-bold text-zinc-600">
          {["Discover", "Following", "Saved", "Mine"].map((item) => (
            <div
              key={item}
              className={
                item === "Discover"
                  ? "rounded-2xl bg-white py-2 text-violet-700 shadow-sm"
                  : "py-2"
              }
            >
              {item}
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-hidden">
          {chips.map((chip) => (
            <span
              key={chip}
              className={`rounded-full px-3 py-2 text-[12px] font-bold ${
                chip === "All"
                  ? "bg-violet-700 text-white"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="space-y-3">
          {discussions.map((discussion) => (
            <DiscussionCard key={discussion.title} discussion={discussion} />
          ))}
        </div>
      </div>
    </PhoneShell>
  );
}

function DetailPreview() {
  return (
    <PhoneShell title="Signal 72" active="Discuss">
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm font-bold text-zinc-700">
          <span>←</span>
          <span>Save</span>
        </div>

        <article>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-sm font-black text-violet-700">
              SB
            </div>
            <div>
              <p className="text-sm font-black text-zinc-950">Saint Blanc</p>
              <p className="text-xs text-zinc-500">2h ago · Edited</p>
            </div>
          </div>

          <h1 className="mt-5 text-2xl font-black leading-tight text-zinc-950">
            The future of work isn’t remote. It’s human.
          </h1>

          <p className="mt-4 text-[14px] leading-relaxed text-zinc-700">
            We’ve learned a lot in the last few years. Remote work gave us
            flexibility, but it also exposed a truth: humans need humans.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {["Work", "Future", "Human", "Culture"].map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-zinc-100 px-3 py-2 text-[11px] font-bold text-zinc-700"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {["Reply", "AI Summary", "Key Points"].map((item) => (
              <button
                key={item}
                className={`rounded-2xl px-3 py-3 text-[11px] font-black ${
                  item === "Reply"
                    ? "bg-violet-700 text-white"
                    : "bg-zinc-100 text-zinc-700"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </article>

        <section>
          <h2 className="mb-3 text-sm font-black text-zinc-950">Top replies</h2>
          <div className="rounded-3xl border border-zinc-100 p-4 shadow-sm">
            <p className="text-[11px] font-bold text-violet-700">
              Pinned by author
            </p>
            <p className="mt-2 text-sm font-black text-zinc-950">Maya Chen</p>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-700">
              The companies that thrive will be the ones that design for human
              connection, not just output.
            </p>
            <div className="mt-3 text-xs font-bold text-zinc-500">
              ♡ 12 · Reply
            </div>
          </div>
        </section>

        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
          Add a reply...
        </div>
      </div>
    </PhoneShell>
  );
}

function CreatePreview() {
  return (
    <PhoneShell title="Create" active="Create">
      <div className="space-y-5">
        <div className="flex items-center justify-between text-sm font-bold">
          <span>×</span>
          <span className="text-violet-700">Drafts</span>
        </div>

        <section>
          <h1 className="text-2xl font-black leading-tight text-zinc-950">
            What signal do you want to share?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Share an insight, experience, or observation with the Loombus
            community.
          </p>
        </section>

        <div className="h-64 rounded-3xl border border-zinc-200 bg-white p-4 text-sm text-zinc-400 shadow-sm">
          Start writing your signal...
        </div>

        <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
          {["Add topic", "Add tags", "Add attachment", "AI quality check"].map(
            (item, index) => (
              <div
                key={item}
                className={`flex items-center justify-between px-4 py-4 text-sm font-bold text-zinc-800 ${
                  index !== 3 ? "border-b border-zinc-100" : ""
                }`}
              >
                <span>{item}</span>
                <span className="text-zinc-400">›</span>
              </div>
            ),
          )}
        </div>

        <button className="w-full rounded-3xl bg-violet-700 py-4 text-sm font-black text-white shadow-xl">
          Publish signal
        </button>
        <button className="w-full rounded-3xl py-2 text-sm font-black text-violet-700">
          Save draft
        </button>
      </div>
    </PhoneShell>
  );
}

function BottomSheetsPreview() {
  return (
    <PhoneShell title="Filters" active="Discuss">
      <div className="relative h-full rounded-3xl bg-zinc-950/90 p-4">
        <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-white p-5 shadow-2xl">
          <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-zinc-300" />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-zinc-950">Filters</h2>
            <span className="text-sm font-bold text-violet-700">Reset</span>
          </div>

          <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-500">
            Topics
          </p>
          <div className="mb-5 flex flex-wrap gap-2">
            {["All", "Work", "AI", "Life", "Business", "Purpose"].map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-3 py-2 text-[12px] font-bold ${
                  tag === "All"
                    ? "bg-violet-700 text-white"
                    : "bg-zinc-100 text-zinc-700"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>

          <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-500">
            Sort by
          </p>
          <div className="mb-5 rounded-3xl border border-zinc-100">
            {["Latest", "Top discussions", "Most replies", "Trending"].map(
              (item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 text-sm font-bold last:border-b-0"
                >
                  <span>{item === "Latest" ? "◉" : "○"}</span>
                  {item}
                </div>
              ),
            )}
          </div>

          <button className="w-full rounded-3xl bg-violet-700 py-4 text-sm font-black text-white">
            Apply filters
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}

function PeoplePreview() {
  return (
    <PhoneShell title="People" active="People">
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-400">
          Search people...
        </div>

        <div className="grid grid-cols-3 rounded-3xl bg-zinc-100 p-1 text-center text-[12px] font-bold text-zinc-600">
          {["Following", "Followers", "Suggested"].map((item) => (
            <div
              key={item}
              className={
                item === "Following"
                  ? "rounded-2xl bg-white py-2 text-violet-700 shadow-sm"
                  : "py-2"
              }
            >
              {item}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {people.map(([name, role, status]) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-3xl border border-zinc-100 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-sm font-black text-violet-700">
                  {name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </div>
                <div>
                  <p className="text-sm font-black text-zinc-950">{name}</p>
                  <p className="text-xs text-zinc-500">{role}</p>
                </div>
              </div>
              <button className="rounded-2xl bg-violet-100 px-3 py-2 text-[11px] font-black text-violet-700">
                {status}
              </button>
            </div>
          ))}
        </div>
      </div>
    </PhoneShell>
  );
}

export default function MobileV3PreviewPage() {
  return (
    <main className="min-h-screen bg-[#070716] px-4 py-10 text-white">
      <section className="mx-auto max-w-7xl">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-violet-300">
            Preview only
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
            Loombus Mobile Experience v3
          </h1>
          <p className="mt-4 text-base leading-relaxed text-violet-100/80 md:text-lg">
            A non-destructive app-native concept route. This does not replace
            the live app screens yet.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="mb-3 text-center text-sm font-black text-violet-200">
              Home
            </p>
            <HomePreview />
          </div>

          <div>
            <p className="mb-3 text-center text-sm font-black text-violet-200">
              Discussions
            </p>
            <DiscussionsPreview />
          </div>

          <div>
            <p className="mb-3 text-center text-sm font-black text-violet-200">
              Discussion Detail
            </p>
            <DetailPreview />
          </div>

          <div>
            <p className="mb-3 text-center text-sm font-black text-violet-200">
              Create
            </p>
            <CreatePreview />
          </div>

          <div>
            <p className="mb-3 text-center text-sm font-black text-violet-200">
              Filters Bottom Sheet
            </p>
            <BottomSheetsPreview />
          </div>

          <div>
            <p className="mb-3 text-center text-sm font-black text-violet-200">
              People
            </p>
            <PeoplePreview />
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-4">
          {[
            ["Mobile-first", "Built for thumb navigation."],
            ["Clean feed", "Less desktop clutter."],
            ["Bottom sheets", "Actions appear where needed."],
            ["Safe preview", "No backend logic changed."],
          ].map(([title, text]) => (
            <div
              key={title}
              className="rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <h3 className="text-sm font-black text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-violet-100/70">
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
