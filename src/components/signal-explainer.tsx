type SignalExplainerContext = "feed" | "create";

type SignalExplainerProps = {
  context?: SignalExplainerContext;
  className?: string;
};

const copyByContext: Record<
  SignalExplainerContext,
  {
    eyebrow: string;
    title: string;
    mobileTitle: string;
    body: string;
  }
> = {
  feed: {
    eyebrow: "Signal guide",
    title: "Signal Score favors clarity over noise.",
    mobileTitle: "What is Signal Score?",
    body:
      "Signal Score helps surface discussions with clearer ideas, meaningful engagement, and useful community response. It is meant to reward useful signal, not empty popularity.",
  },
  create: {
    eyebrow: "Writing guide",
    title: "Strong posts start with a clear signal.",
    mobileTitle: "Writing a high-signal post",
    body:
      "A strong Loombus post usually includes a clear point, useful context, and the kind of response you are looking for. Keep it thoughtful, specific, and easy for others to engage with.",
  },
};

export function SignalExplainer({
  context = "feed",
  className = "",
}: SignalExplainerProps) {
  const copy = copyByContext[context];

  return (
    <div className={className}>
      <section className="hidden rounded-3xl border border-zinc-200 bg-white/85 px-5 py-4 shadow-sm md:block">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">
          {copy.eyebrow}
        </p>
        <h2 className="mt-2 text-base font-semibold text-zinc-950">{copy.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{copy.body}</p>
      </section>

      <details className="rounded-2xl border border-zinc-200 bg-white/90 px-4 py-3 text-left shadow-sm md:hidden">
        <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-950">
          {copy.mobileTitle}
        </summary>
        <p className="mt-2 text-xs leading-5 text-zinc-600">{copy.body}</p>
      </details>
    </div>
  );
}
