import Link from "next/link";

const lanes = [
  ["Discover", "/discussions"],
  ["Following", "/following"],
  ["Saved", "/saved"],
  ["Mine", "/my-discussions"],
];

const topics = [
  ["All", "/discussions"],
  ["AI", "/discussions?topic=AI%20%26%20Society"],
  ["Business", "/discussions?topic=Business"],
  ["Life", "/discussions?topic=Life"],
  ["Work", "/discussions?topic=Work"],
];

export default function MobileV3DiscussionsHeader() {
  return (
    <section className="md:hidden">
      <div className="-mx-4 -mt-2 mb-5 bg-[#070716] px-4 pb-5 pt-4 text-white">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-violet-300">
              Loombus
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              Discuss
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/search"
              className="flex h-11 w-11 items-center justify-center rounded-3xl bg-white/10 text-lg font-black text-white ring-1 ring-white/10"
              aria-label="Search"
            >
              ⌕
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
            Signal feed
          </p>
          <h2 className="mt-3 text-2xl font-black leading-tight">
            Find conversations worth joining.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            Browse useful discussions, follow better thinkers, and reply where
            your experience adds signal.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-4 rounded-3xl bg-white/10 p-1 text-center text-[12px] font-black text-white/60 ring-1 ring-white/10">
          {lanes.map(([label, href]) => (
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

        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2">
            {topics.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className={
                  label === "All"
                    ? "rounded-full bg-violet-600 px-4 py-2 text-[12px] font-black text-white shadow-lg shadow-violet-950/35"
                    : "rounded-full bg-white/10 px-4 py-2 text-[12px] font-black text-white/75 ring-1 ring-white/10"
                }
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
