import Link from "next/link";

type ResearchEditorialRoute = "research" | "evidence" | "graph" | "provenance" | "promote";

const routes: Array<{ key: ResearchEditorialRoute; label: string; href: string }> = [
  { key: "research", label: "Research", href: "/library/research" },
  { key: "evidence", label: "Evidence & Knowledge", href: "/library/research/evidence" },
  { key: "graph", label: "Knowledge Graph", href: "/library/research/evidence/graph" },
  { key: "provenance", label: "Provenance", href: "/library/research/evidence/provenance" },
  { key: "promote", label: "Promote", href: "/library/research/evidence/promote" },
];

export function LibraryResearchEditorialNav({ active }: { active: ResearchEditorialRoute }) {
  return (
    <nav className="research-editorial-route-nav" aria-label="Research workspace">
      <div className="research-editorial-route-nav-inner">
        {routes.map((route) => (
          <Link
            key={route.key}
            href={route.href}
            data-active={active === route.key ? "true" : "false"}
            aria-current={active === route.key ? "page" : undefined}
          >
            {route.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
