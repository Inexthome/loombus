"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
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
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-7 shadow-2xl shadow-black/10 sm:p-9">
        <span
          className={[
            "inline-flex h-12 w-12 items-center justify-center rounded-2xl",
            warning
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "bg-[var(--loombus-gold-soft)] text-[var(--loombus-gold)]",
          ].join(" ")}
        >
          {loading ? (
            <Loader2 className="animate-spin" aria-label="Loading" />
          ) : warning ? (
            <CircleAlert aria-hidden="true" />
          ) : (
            <ShieldCheck aria-hidden="true" />
          )}
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-[var(--loombus-gold)]">
          Platform Operations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 leading-7 text-[var(--loombus-text-muted)]">
          {description}
        </p>
        {children ? <div className="mt-6 flex flex-wrap gap-3">{children}</div> : null}
      </section>
    </main>
  );
}

function NavigationLinks({ active }: { active: PlatformRoute }) {
  return (
    <>
      <Link
        href="/admin/platform"
        aria-current={active === "overview" ? "page" : undefined}
        className={[
          "flex min-h-11 items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition",
          active === "overview"
            ? "bg-[var(--loombus-gold)] text-[var(--loombus-gold-contrast)]"
            : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]",
        ].join(" ")}
      >
        <span className="inline-flex items-center gap-3">
          <Database size={18} aria-hidden="true" /> Overview
        </span>
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
      {ADMIN_PLATFORM_MODULES.map((module) => {
        const selected = active === module.key;
        return (
          <Link
            key={module.key}
            href={`/admin/platform/${module.key}`}
            aria-current={selected ? "page" : undefined}
            className={[
              "flex min-h-11 items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition",
              selected
                ? "bg-[var(--loombus-gold)] text-[var(--loombus-gold-contrast)]"
                : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]",
            ].join(" ")}
          >
            <span className="inline-flex items-center gap-3">
              {createElement(module.Icon, { size: 18, "aria-hidden": true })} {module.shortTitle}
            </span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        );
      })}
    </>
  );
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
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[92rem]">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-gold)]"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Admin Operations Center
        </Link>

        <header className="mt-5 overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[radial-gradient(circle_at_top_right,var(--loombus-gold-soft),transparent_30rem),var(--loombus-surface)] p-6 shadow-2xl shadow-black/10 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--loombus-gold)]">
                {eyebrow}
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-3xl leading-7 text-[var(--loombus-text-muted)]">
                {description}
              </p>
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </header>

        <nav
          className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2 lg:hidden"
          aria-label="Platform Operations modules"
        >
          <Link
            href="/admin/platform"
            aria-current={active === "overview" ? "page" : undefined}
            className={[
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold",
              active === "overview"
                ? "bg-[var(--loombus-gold)] text-[var(--loombus-gold-contrast)]"
                : "text-[var(--loombus-text-muted)]",
            ].join(" ")}
          >
            <Database size={16} aria-hidden="true" /> Overview
          </Link>
          {ADMIN_PLATFORM_MODULES.map((module) => (
            <Link
              key={module.key}
              href={`/admin/platform/${module.key}`}
              aria-current={active === module.key ? "page" : undefined}
              className={[
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold",
                active === module.key
                  ? "bg-[var(--loombus-gold)] text-[var(--loombus-gold-contrast)]"
                  : "text-[var(--loombus-text-muted)]",
              ].join(" ")}
            >
              {createElement(module.Icon, { size: 16, "aria-hidden": true })} {module.shortTitle}
            </Link>
          ))}
        </nav>

        {notice ? (
          <p
            className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300"
            role="status"
          >
            {notice}
          </p>
        ) : null}
        {error ? (
          <p
            className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
          <aside className="hidden h-fit rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-3 shadow-xl shadow-black/5 lg:sticky lg:top-24 lg:block">
            <p className="px-3 pb-2 pt-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[var(--loombus-text-subtle)]">
              Admin modules
            </p>
            <nav className="grid gap-1" aria-label="Platform Operations modules">
              <NavigationLinks active={active} />
            </nav>
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
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
        "rounded-[1.55rem] border p-5 shadow-sm",
        featured
          ? "border-[var(--loombus-gold)] bg-[var(--loombus-cream)] text-[var(--loombus-cream-contrast)] dark:bg-[var(--loombus-gold-soft)] dark:text-[var(--loombus-text)]"
          : "border-[var(--loombus-border)] bg-[var(--loombus-surface)]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.17em] text-[var(--loombus-text-muted)]">
          {label}
        </p>
        {icon ? <span className="text-[var(--loombus-gold)]">{icon}</span> : null}
      </div>
      <strong className="mt-3 block text-3xl font-semibold tracking-[-0.04em]">
        {typeof value === "number" ? formatAdminMetric(value) : value ?? "–"}
      </strong>
      <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
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
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "attention"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : status === "unavailable"
          ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
          : "border-[var(--loombus-gold)]/40 bg-[var(--loombus-gold-soft)] text-[var(--loombus-gold)]";

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
    <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">
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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition",
        primary
          ? "bg-[var(--loombus-gold)] text-[var(--loombus-gold-contrast)] hover:opacity-90"
          : "border border-[var(--loombus-border)] bg-[var(--loombus-surface)] hover:border-[var(--loombus-gold)]",
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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        primary
          ? "bg-[var(--loombus-gold)] text-[var(--loombus-gold-contrast)] hover:opacity-90"
          : "border border-[var(--loombus-border)] bg-[var(--loombus-surface)] hover:border-[var(--loombus-gold)]",
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
      <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
      {loading ? "Refreshing" : label}
    </AdminActionButton>
  );
}
