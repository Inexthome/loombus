type LoombusLoadingScreenProps = {
  eyebrow?: string;
  title?: string;
  message?: string;
  waitLabel?: string;
  fixed?: boolean;
};

export function LoombusLoadingScreen({
  eyebrow = "Loombus",
  title = "Loading Loombus...",
  message = "Preparing your Loombus experience.",
  waitLabel = "Please wait",
  fixed = false,
}: LoombusLoadingScreenProps) {
  return (
    <main
      className={`${fixed ? "fixed inset-0 z-[90]" : "min-h-screen"} flex items-center justify-center overflow-hidden bg-[#111113] px-6 py-16 text-white`}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.08),transparent_18rem),linear-gradient(180deg,#202023_0%,#111113_42%,#070707_100%)]" />
      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <div className="relative grid size-44 place-items-center rounded-full bg-black shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:size-52">
          <span className="absolute inset-5 rounded-full border border-white/10" aria-hidden="true" />
          <span
            className="absolute inset-5 animate-spin rounded-full border-[5px] border-transparent border-b-[#facc15] border-r-[#facc15] shadow-[0_0_24px_rgba(250,204,21,0.32)]"
            aria-hidden="true"
          />
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-20 object-contain sm:size-24" />
        </div>

        <p className="mt-12 text-2xl font-medium uppercase tracking-[0.42em] text-zinc-400 sm:mt-14 sm:text-4xl">
          {eyebrow}
        </p>
        <h1 className="mt-10 text-5xl font-black tracking-tight text-white sm:mt-14 sm:text-7xl">
          {title}
        </h1>
        <p className="mt-8 max-w-3xl text-2xl leading-relaxed text-zinc-400 sm:mt-12 sm:text-4xl">
          {message}
        </p>
        <div className="mt-12 flex w-full max-w-3xl items-center gap-5 text-2xl font-medium uppercase tracking-[0.38em] text-zinc-400 sm:mt-16 sm:gap-8 sm:text-4xl sm:tracking-[0.48em]">
          <span className="h-px flex-1 bg-white/10" />
          <span>{waitLabel}</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      </div>
    </main>
  );
}
