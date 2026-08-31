import Link from "next/link";
import type { ReactNode } from "react";
import "./admin-trust-safety-native.css";

const SUITE_LINKS = [
  { href: "/admin/reports", label: "Reports", key: "reports" },
  { href: "/admin/safety", label: "Safety", key: "safety" },
  { href: "/admin/enforcement", label: "Enforcement", key: "enforcement" },
  { href: "/admin/deleted", label: "Deleted discussions", key: "deleted" },
  { href: "/admin/deleted-replies", label: "Deleted replies", key: "deleted-replies" },
  { href: "/admin/audit", label: "Audit", key: "audit" },
] as const;

type AdminTrustSafetyEditorialFrameProps = {
  active: (typeof SUITE_LINKS)[number]["key"];
  eyebrow: string;
  title: string;
  description: string;
  utility?: ReactNode;
  children: ReactNode;
};

export function AdminTrustSafetyEditorialFrame({
  active,
  eyebrow,
  title,
  description,
  utility,
  children,
}: AdminTrustSafetyEditorialFrameProps) {
  return (
    <div className="admin-trust-safety-editorial-route" data-admin-editorial-route={active}>
      <header className="admin-trust-safety-editorial-masthead">
        <div className="admin-trust-safety-editorial-heading">
          <Link href="/admin" className="admin-trust-safety-editorial-back">
            Admin operations
          </Link>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <div className="admin-trust-safety-editorial-deck">{description}</div>
        </div>
        {utility ? <div className="admin-trust-safety-editorial-utility">{utility}</div> : null}
      </header>

      <nav className="admin-trust-safety-editorial-nav" aria-label="Trust, safety, and moderation">
        {SUITE_LINKS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active === item.key ? "page" : undefined}
            className={active === item.key ? "is-active" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="admin-trust-safety-editorial-workspace">{children}</section>
    </div>
  );
}
