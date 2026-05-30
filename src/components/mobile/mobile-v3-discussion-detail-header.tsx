import Link from "next/link";

const actions = [
  ["Reply", "#replies"],
  ["AI", "#ai-tools"],
  ["Save", "/saved"],
];

export default function MobileV3DiscussionDetailHeader() {
  return (
    <section className="md:hidden">
      <div className="-mx-4 -mt-2 mb-5 bg-[#070716] px-4 pb-5 pt-4 text-white">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-violet-300">
              Loombus
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              Reading
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/discussions"
              className="flex h-11 w-11 items-center justify-center rounded-3xl bg-white/10 text-lg font-black text-white ring-1 ring-white/10"
              aria-label="Back to discussions"
            >
              ←
            </Link>
            <Link
              href="/create"
              className="flex h-11 w-11 items-center justify-center rounded-3xl bg-violet-600 text-xl font-black text-white shadow-lg shadow-violet-950/40"
              aria-label="Create discussion"
            >
              +
            </Link>
          </div>
        </div>

        <div className="mb-4 rounded-[2rem] bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 p-5 shadow-2xl shadow-violet-950/35">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
            Discussion thread
          </p>
          <h2 className="mt-3 text-2xl font-black leading-tight">
            Read the signal. Add value where it matters.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            Focus on the main idea, scan the replies, then respond with
            experience, clarity, or a useful challenge.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {actions.map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="rounded-3xl border border-white/10 bg-white/[0.07] px-3 py-3 text-center text-sm font-black text-white"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
