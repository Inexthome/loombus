import Link from "next/link";

const alertModes = [
  ["All", "/notifications"],
  ["Unread", "/notifications?filter=unread"],
  ["Mentions", "/notifications?type=mention"],
  ["Replies", "/notifications?type=reply"],
];

const alertSignals = [
  ["Replies", "See where conversations moved forward."],
  ["Mentions", "Find places where someone pulled you in."],
  ["Follows", "Notice who is building around your signal."],
];

export default function MobileV3NotificationsHeader() {
  return (
    <section className="md:hidden">
      <div className="-mx-4 -mt-2 mb-5 bg-[#070716] px-4 pb-5 pt-4 text-white">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-violet-300">
              Loombus
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              Alerts
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/discussions"
              className="rounded-3xl bg-white/10 px-4 py-3 text-xs font-black text-white ring-1 ring-white/10"
            >
              Discuss
            </Link>
            <Link
              href="/settings"
              className="flex h-11 w-11 items-center justify-center rounded-3xl bg-white/10 text-lg font-black text-white ring-1 ring-white/10"
              aria-label="Notification settings"
            >
              ⚙
            </Link>
          </div>
        </div>

        <div className="mb-4 rounded-[2rem] bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 p-5 shadow-2xl shadow-violet-950/35">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
            Signal inbox
          </p>
          <h2 className="mt-3 text-2xl font-black leading-tight">
            Track what deserves your response.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            Alerts should help you return to meaningful replies, mentions, and
            follows without turning Loombus into noise.
          </p>
        </div>

        <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2">
            {alertModes.map(([label, href]) => (
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

        <div className="grid grid-cols-3 gap-2">
          {alertSignals.map(([title, body]) => (
            <div
              key={title}
              className="rounded-3xl border border-white/10 bg-white/[0.07] p-3 text-center"
            >
              <p className="text-sm font-black text-white">{title}</p>
              <p className="mt-1 text-[10px] font-semibold leading-tight text-white/45">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
