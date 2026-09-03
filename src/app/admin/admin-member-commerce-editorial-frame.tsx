import Link from "next/link";
import type { ReactNode } from "react";

const SUITE_LINKS = [
  { href: "/admin/users", label: "Members", key: "users" },
  { href: "/admin/support", label: "Support", key: "support" },
  { href: "/admin/communications", label: "Communications", key: "communications" },
  { href: "/admin/ai-access", label: "AI access", key: "ai-access" },
  { href: "/admin/billing", label: "Billing", key: "billing" },
  { href: "/admin/professional-booking/payments", label: "Booking payments", key: "booking-payments" },
] as const;

type AdminMemberCommerceEditorialFrameProps = {
  active: (typeof SUITE_LINKS)[number]["key"];
  title: string;
  description: string;
  children: ReactNode;
};

export function AdminMemberCommerceEditorialFrame({
  active,
  title,
  description,
  children,
}: AdminMemberCommerceEditorialFrameProps) {
  return (
    <div className="admin-member-commerce-editorial-route" data-admin-editorial-route={active}>
      <header className="admin-member-commerce-editorial-masthead">
        <Link href="/admin" className="admin-member-commerce-editorial-back">
          Admin operations
        </Link>
        <p className="admin-member-commerce-editorial-eyebrow">Members, support & billing</p>
        <h1>{title}</h1>
        <p className="admin-member-commerce-editorial-deck">{description}</p>
      </header>

      <nav className="admin-member-commerce-editorial-nav" aria-label="Members, support, and billing">
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

      <section className="admin-member-commerce-editorial-workspace">{children}</section>
    </div>
  );
}
