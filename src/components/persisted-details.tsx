"use client";

import { type ComponentPropsWithoutRef, type ReactNode, useEffect, useState } from "react";

type PersistedDetailsProps = Omit<ComponentPropsWithoutRef<"details">, "open" | "onToggle"> & {
  storageKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function PersistedDetails({
  storageKey,
  defaultOpen = true,
  children,
  ...detailsProps
}: PersistedDetailsProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "open") setOpen(true);
      if (saved === "closed") setOpen(false);
    } catch {
      // Storage can be unavailable in restricted browser contexts; keep the default state.
    }
  }, [storageKey]);

  function handleToggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    const nextOpen = event.currentTarget.open;
    setOpen(nextOpen);
    try {
      window.localStorage.setItem(storageKey, nextOpen ? "open" : "closed");
    } catch {
      // The disclosure still works even when persistence is unavailable.
    }
  }

  return (
    <details {...detailsProps} open={open} onToggle={handleToggle}>
      {children}
    </details>
  );
}
