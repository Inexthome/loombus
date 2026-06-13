type LoombusLoadingScreenProps = {
  eyebrow?: string;
  title?: string;
  message?: string;
  waitLabel?: string;
};

export function LoombusLoadingScreen({
  eyebrow = "Loombus",
  title = "Loading Loombus...",
  message = "Preparing your Loombus experience.",
  waitLabel = "Please wait",
}: LoombusLoadingScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-16 text-white">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-full border border-zinc-800 bg-black shadow-2xl shadow-black/40">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-zinc-800" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-amber-300 border-t-amber-300" />
            <img
              src="/assets/brand/loombus-mark-transparent.png"
              alt=""
              className="h-9 w-9 object-contain"
            />
          </div>
        </div>

        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
          {eyebrow}
        </p>

        <h1 className="mb-4 text-3xl font-semibold tracking-tight">
          {title}
        </h1>

        <p className="leading-relaxed text-zinc-400">
          {message}
        </p>

        <div className="mx-auto mt-7 flex max-w-xs items-center justify-center gap-2 text-xs uppercase tracking-[0.24em] text-zinc-600">
          <span className="h-px flex-1 bg-zinc-900" />
          {waitLabel}
          <span className="h-px flex-1 bg-zinc-900" />
        </div>
      </div>
    </main>
  );
}
