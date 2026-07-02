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
    <main className={`${fixed ? "fixed inset-0 z-[90]" : "min-h-screen"} flex items-center justify-center overflow-hidden bg-[#111113] px-6 py-12 text-white`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.08),transparent_17rem),linear-gradient(180deg,#202023_0%,#111113_44%,#070707_100%)]" />
      <section className="relative mx-auto flex w-full max-w-lg flex-col items-center text-center" role="status" aria-live="polite" aria-label={title}>
        <div className="relative grid size-32 place-items-center rounded-full bg-black shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:size-40">
          <span className="absolute inset-4 rounded-full border border-white/10" aria-hidden="true" />
          <span className="absolute inset-4 animate-spin rounded-full border-[4px] border-transparent border-b-[#facc15] border-r-[#facc15] shadow-[0_0_22px_rgba(250,204,21,0.28)]" aria-hidden="true" />
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-14 object-contain sm:size-20" />
        </div>
        <p className="mt-8 text-xl font-medium uppercase tracking-[0.34em] text-zinc-400 sm:text-2xl">{eyebrow}</p>
        <h1 className="mt-7 text-4xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>
        <p className="mt-6 max-w-md text-xl leading-relaxed text-zinc-400 sm:text-2xl">{message}</p>
        <div className="mt-8 flex w-full max-w-sm items-center gap-4 text-lg font-medium uppercase tracking-[0.32em] text-zinc-400 sm:text-xl">
          <span className="h-px flex-1 bg-white/10" />
          <span>{waitLabel}</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      </section>
    </main>
  );
}
