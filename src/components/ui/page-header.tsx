import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`mb-12 ${className}`}>
      {eyebrow && (
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          {eyebrow}
        </p>
      )}

      <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
        {title}
      </h1>

      {description && (
        <div className="mt-5 max-w-3xl leading-relaxed text-zinc-400">
          {description}
        </div>
      )}

      {children}
    </div>
  );
}
