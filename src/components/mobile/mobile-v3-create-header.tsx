import Link from "next/link";

const composerSteps = [
  ["1", "Write", "Start with the signal."],
  ["2", "Refine", "Add tags, topic, and clarity."],
  ["3", "Publish", "Share when it feels useful."],
];

export default function MobileV3CreateHeader() {
  return (
    <section className="md:hidden">
      <div className="-mx-4 -mt-2 mb-5 bg-[#070716] px-4 pb-5 pt-4 text-white">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-violet-300">
              Loombus
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              Create
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/my-discussions"
              className="rounded-3xl bg-white/10 px-4 py-3 text-xs font-black text-white ring-1 ring-white/10"
            >
              Mine
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
            New signal
          </p>
          <h2 className="mt-3 text-2xl font-black leading-tight">
            Share something worth thinking about.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            Start with a clear idea, lived experience, useful question, or
            observation that can create a meaningful reply.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {composerSteps.map(([number, title, body]) => (
            <div
              key={title}
              className="rounded-3xl border border-white/10 bg-white/[0.07] p-3 text-center"
            >
              <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white">
                {number}
              </div>
              <p className="mt-2 text-sm font-black text-white">{title}</p>
              <p className="mt-1 text-[10px] font-semibold leading-tight text-white/45">
                {body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
            Mobile composer
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            The form below still uses the existing Loombus create system. This
            layer only makes the mobile entry point feel more app-native.
          </p>
        </div>
      </div>
    </section>
  );
}
