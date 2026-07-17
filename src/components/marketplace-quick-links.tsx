import Link from "next/link";
import { Bookmark, ShieldCheck, Store } from "lucide-react";

const links = [
  {
    href: "/marketplace/manage",
    label: "Manage listings",
    icon: Store,
  },
  {
    href: "/marketplace/saved",
    label: "Saved items",
    icon: Bookmark,
  },
  {
    href: "/marketplace/safety",
    label: "Safety and policy",
    icon: ShieldCheck,
  },
];

export default function MarketplaceQuickLinks() {
  return (
    <nav
      aria-label="Marketplace shortcuts"
      className="bg-[var(--loombus-page-bg)] px-4 pt-6 text-[var(--loombus-text)] sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap gap-2">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-semibold"
          >
            <Icon size={16} /> {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
