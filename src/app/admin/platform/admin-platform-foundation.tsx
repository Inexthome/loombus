"use client";

import Link from "next/link";
import {
  CircleAlert,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  ADMIN_PLATFORM_MODULES,
  type PlatformRoute,
} from "./admin-platform-registry";

export function formatAdminMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString()
    : "–";
}

export function AdminPlatformState({
  title,
  description,
  tone = "neutral",
  loading = false,
  children,
}: {
  title: string;
  description: string;
  tone?: "neutral" | "warning" | "danger";
  loading?: boolean;
  children?: ReactNode;
}) {
  const warning = tone !== "neutral";

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-14 text-[var(--loombus-text)] sm:px-6">
      <section className="mx-auto max-w-2xl border-y border-[var(--loombus-border)] py-8 sm:py-10">
        <span
          className={[
            "inline-flex h-10 w-10 items-center justify-center",
            warning
              ? "text-amber-700 dark:text-amber-300"
              : "text-[var(--loombus-gold)]",
          ].join(" ")}
        >
          {loading ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-label="Loading" />
          ) : warning ? (
            <CircleAlert aria-hidden="true" />
          ) : (
            <ShieldCheck aria-hidden="true" />
          )}
        </span>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">
          Platform Operations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-xl leading-7 text-[var(--loombus-text-muted)]">
          {description}
        </p>
        {children ? <div className="mt-6 flex flex-wrap gap-3">{children}</div> : null}
      </section>
    </main>
  );
}

function NavigationLinks({ active }: { active: PlatformRoute }) {
  const links = [
    { href: "/admin/platform", key: "overview" as const, label: "Overview" },
    ...ADMIN_PLATFORM_MODULES.map((module) => ({
      href: `/admin/platform/${module.key}`,
      key: module.key,
      label: module.shortTitle,
    })),
  ];

  return links.map((item) => {
    const selected = active === item.key;
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-current={selected ? "page" : undefined}
        className={[
          "relative inline-flex min-h-11 shrink-0 items-center px-1 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--loombus-gold)]",
          selected
            ? "text-[var(--loombus-text)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--loombus-gold)]"
            : "text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]",
        ].join(" ")}
      >
        {item.label}
      </Link>
    );
  });
}

export function AdminPlatformShell({
  active,
  eyebrow,
  title,
  description,
  actions,
  notice,
  error,
  children,
}: {
  active: PlatformRoute;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  notice?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-7 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[88rem]">
        <header className="admin-platform-editorial-masthead border-b border-[var(--loombus-border)] pb-7 pt-2">
          <Link
            href="/admin"
            className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--loombus-text-muted)] transition-colors hover:text-[var(--loombus-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--loombus-gold)] motion-reduce:transition-none"
          >
            Admin operations
          </Link>

          <div className="mt-5 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">
                {eyebrow}
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-3xl text-[0.95rem] leading-7 text-[var(--loombus-text-muted)]">
                {description}
              </p>
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </header>

        <nav
          className="admin-platform-editorial-nav flex gap-6 overflow-x-auto border-b border-[var(--loombus-border)]"
          aria-label="Platform Operations modules"
        >
          <NavigationLinks active={active} />
        </nav>

        {notice ? (
          <p
            className="mt-5 border-l-2 border-emerald-500 px-4 py-2 text-sm leading-6 text-emerald-700 dark:text-emerald-300"
            role="status"
          >
            {notice}
          </p>
        ) : null}
        {error ? (
          <p
            className="mt-5 border-l-2 border-red-500 px-4 py-2 text-sm leading-6 text-red-700 dark:text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="admin-platform-editorial-workspace min-w-0 pt-6">{children}</div>
      </div>
    </main>
  );
}

export function AdminMetricCard({
  label,
  value,
  description,
  icon,
  featured = false,
}: {
  label: string;
  value: number | string | null | undefined;
  description: string;
  icon?: ReactNode;
  featured?: boolean;
}) {
  return (
    <article
      className={[
        "admin-platform-editorial-metric min-w-0 border-b border-[var(--loombus-border)] px-1 py-5 sm:px-4",
        featured ? "border-t-2 border-t-[var(--loombus-gold)]" : "border-t border-t-transparent",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-muted)]">
          {label}
        </p>
        {icon ? <span className="text-[var(--loombus-gold)]">{icon}</span> : null}
      </div>
      <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
        {typeof value === "number" ? formatAdminMetric(value) : value ?? "–"}
      </strong>
      <p className="mt-1.5 text-sm leading-6 text-[var(--loombus-text-muted)]">
        {description}
      </p>
    </article>
  );
}

export function AdminStatusBadge({
  status,
  children,
}: {
  status: "ready" | "attention" | "unavailable" | "foundation";
  children: ReactNode;
}) {
  const classes =
    status === "ready"
      ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
      : status === "attention"
        ? "border-amber-500/30 text-amber-700 dark:text-amber-300"
        : status === "unavailable"
          ? "border-red-500/30 text-red-700 dark:text-red-300"
          : "border-[var(--loombus-gold)]/40 text-[var(--loombus-gold)]";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>
      {children}
    </span>
  );
}

export function AdminQueueSection({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-platform-editorial-section border-t border-[var(--loombus-border)] py-6 sm:py-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function AdminActionLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors motion-reduce:transition-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--loombus-gold)]",
        primary
          ? "bg-[var(--loombus-gold)] text-[var(--loombus-gold-contrast)] hover:opacity-90"
          : "border border-[var(--loombus-border)] bg-transparent hover:border-[var(--loombus-gold)]",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export function AdminActionButton({
  children,
  primary = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      {...props}
      className={[
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--loombus-gold)]",
        primary
          ? "bg-[var(--loombus-gold)] text-[var(--loombus-gold-contrast)] hover:opacity-90"
          : "border border-[var(--loombus-border)] bg-transparent hover:border-[var(--loombus-gold)]",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function AdminRefreshButton({
  loading,
  onClick,
  label = "Refresh",
}: {
  loading: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <AdminActionButton type="button" onClick={onClick} disabled={loading}>
      <RefreshCw size={16} className={loading ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" />
      {loading ? "Refreshing" : label}
    </AdminActionButton>
  );
}
