export default function DiscussionsLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[88rem]" aria-label="Loading discussions" aria-busy="true">
        <div className="max-w-2xl">
          <div className="h-11 w-56 animate-pulse rounded-xl bg-[color:var(--loombus-surface-muted)]" />
          <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded-lg bg-[color:var(--loombus-surface-muted)]" />
        </div>

        <div className="mt-8 h-14 w-full animate-pulse rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)]" />
        <div className="mt-4 flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-[color:var(--loombus-surface-muted)]"
            />
          ))}
        </div>

        <div className="mt-7 grid gap-5">
          {[0, 1, 2].map((item) => (
            <section
              key={item}
              className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6"
            >
              <div className="h-6 w-28 animate-pulse rounded-full bg-[color:var(--loombus-surface-muted)]" />
              <div className="mt-5 h-8 w-4/5 animate-pulse rounded-lg bg-[color:var(--loombus-surface-muted)]" />
              <div className="mt-4 h-5 w-full animate-pulse rounded-lg bg-[color:var(--loombus-surface-muted)]" />
              <div className="mt-2 h-5 w-2/3 animate-pulse rounded-lg bg-[color:var(--loombus-surface-muted)]" />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
