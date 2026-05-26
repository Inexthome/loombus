"use client";

import { useEffect, useState, type ReactNode } from "react";

type ProgressiveGuideProps = {
  storageKey: string;
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
  collapsedClassName?: string;
  defaultCollapsed?: boolean;
  autoCollapse?: boolean;
};

export function ProgressiveGuide({
  storageKey,
  eyebrow = "Guide",
  title,
  description,
  children,
  collapsedClassName = "mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:p-5",
  defaultCollapsed = false,
  autoCollapse = false,
}: ProgressiveGuideProps) {
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);

      if (saved === "collapsed") {
        setCollapsed(true);
      } else if (saved === "open") {
        setCollapsed(false);
      } else {
        setCollapsed(defaultCollapsed || autoCollapse);
      }
    } catch {
      setCollapsed(defaultCollapsed || autoCollapse);
    } finally {
      setLoaded(true);
    }
  }, [autoCollapse, defaultCollapsed, storageKey]);

  function collapseGuide() {
    setCollapsed(true);

    try {
      window.localStorage.setItem(storageKey, "collapsed");
    } catch {
      // Ignore storage failures.
    }
  }

  function openGuide() {
    setCollapsed(false);

    try {
      window.localStorage.setItem(storageKey, "open");
    } catch {
      // Ignore storage failures.
    }
  }

  if (!loaded) {
    return <>{children}</>;
  }

  if (collapsed) {
    return (
      <section className={collapsedClassName}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.22em] text-zinc-600">
              {eyebrow}
            </p>

            <h2 className="text-lg font-medium text-white">
              {title}
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={openGuide}
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Open guide
          </button>
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={collapseGuide}
          className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
        >
          Hide guide
        </button>
      </div>

      {children}
    </div>
  );
}
