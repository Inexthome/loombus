import Link from "next/link";

const profileSignals = [
  ["Identity", "Shape how people recognize your signal."],
  ["Credibility", "Keep your profile clear and trustworthy."],
  ["Presence", "Make your Loombus account feel intentional."],
];

export default function MobileV3ProfileHeader() {
  return (
    <section className="md:hidden">
      <div className="-mx-4 -mt-2 mb-5 bg-[#070716] px-4 pb-5 pt-4 text-white">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-violet-300">
              Loombus
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              Profile
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="rounded-3xl bg-white/10 px-4 py-3 text-xs font-black text-white ring-1 ring-white/10"
            >
              Settings
            </Link>
            <Link
              href="/discussions"
              className="flex h-11 w-11 items-center justify-center rounded-3xl bg-white/10 text-lg font-black text-white ring-1 ring-white/10"
              aria-label="Back to discussions"
            >
              ←
            </Link>
          </div>
        </div>

        <div className="mb-4 rounded-[2rem] bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 p-5 shadow-2xl shadow-violet-950/35">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
            Your identity
          </p>
          <h2 className="mt-3 text-2xl font-black leading-tight">
            Let people understand who is behind the signal.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            A clear profile helps replies, follows, and discussions feel more
            human, credible, and connected.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {profileSignals.map(([title, body]) => (
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
