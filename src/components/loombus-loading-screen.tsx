type LoombusLoadingScreenProps = {
  eyebrow?: string;
  title?: string;
  message?: string;
  waitLabel?: string;
};

export function LoombusLoadingScreen({
  eyebrow = "Loombus",
  title = "Bringing the signal into focus.",
  message = "Preparing a cleaner Loombus experience with less noise and more context.",
  waitLabel = "Loading",
}: LoombusLoadingScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 py-16 text-slate-950">
      <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-2xl shadow-slate-900/10">
        <div className="mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-amber-200 bg-amber-50 shadow-xl shadow-amber-900/10">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-amber-200" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-amber-500 border-t-amber-500" />
            <img
              src="/assets/brand/loombus-mark-transparent.png"
              alt=""
              className="h-9 w-9 object-contain"
            />
          </div>
        </div>

        <p className="mb-3 text-sm font-black uppercase tracking-[0.3em] text-amber-700">
          {eyebrow}
        </p>

        <h1 className="mb-4 text-3xl font-black tracking-tight text-slate-950">
          {title}
        </h1>

        <p className="font-medium leading-relaxed text-slate-600">
          {message}
        </p>

        <div className="mx-auto mt-7 flex max-w-xs items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          {waitLabel}
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      </div>
    </main>
  );
}
