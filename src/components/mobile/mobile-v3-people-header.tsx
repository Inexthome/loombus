import Link from "next/link";

const peopleModes = [
  ["Discover", "/people"],
  ["Following", "/u/saint/following"],
  ["Followers", "/u/saint/followers"],
];

const signals = [
  ["Follow useful people", "Build a cleaner feed around real insight."],
  ["Find contributors", "Look for people who add thoughtful replies."],
  ["Grow signal", "Make your network sharper over time."],
];

export default function MobileV3PeopleHeader() {
  return (
    <section className="md:hidden">
      <div className="-mx-4 -mt-2 mb-5 bg-[#070716] px-4 pb-5 pt-4 text-white">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-violet-300">
              Loombus
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              People
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/search"
              className="flex h-11 w-11 items-center justify-center rounded-3xl bg-white/10 text-lg font-black text-white ring-1 ring-white/10"
              aria-label="Search people"
            >
              ⌕
            </Link>
            <Link
              href="/profile"
              className="rounded-3xl bg-white/10 px-4 py-3 text-xs font-black text-white ring-1 ring-white/10"
            >
              Profile
            </Link>
          </div>
        </div>

        <div className="mb-4 rounded-[2rem] bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 p-5 shadow-2xl shadow-violet-950/35">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
            Signal network
          </p>
          <h2 className="mt-3 text-2xl font-black leading-tight">
            Follow people who make the feed smarter.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            Loombus gets better when your network is built around useful
            thought, lived experience, and meaningful contribution.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-3 rounded-3xl bg-white/10 p-1 text-center text-[12px] font-black text-white/60 ring-1 ring-white/10">
          {peopleModes.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className={
                label === "Discover"
                  ? "rounded-2xl bg-white py-2 text-violet-800 shadow-sm"
                  : "py-2"
              }
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="grid gap-2">
          {signals.map(([title, body]) => (
            <div
              key={title}
              className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4"
            >
              <h3 className="text-sm font-black text-white">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/55">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
