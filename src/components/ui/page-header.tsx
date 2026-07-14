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
    <header className={`loombus-page-header-v2 ${className}`}>
      {eyebrow && (
        <p className="loombus-page-header-eyebrow">{eyebrow}</p>
      )}

      <h1>{title}</h1>

      {description && (
        <div className="loombus-page-header-description">{description}</div>
      )}

      {children}
    </header>
  );
}
