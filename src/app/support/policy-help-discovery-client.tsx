"use client";

import Link from "next/link";
import {
  ChevronRight,
  FileText,
  LifeBuoy,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  PublicPolicyDiscoveryCategory,
  PublicPolicyDiscoveryEntry,
} from "@/lib/policy-content-public-discovery";

type DiscoveryCategory = "All" | PublicPolicyDiscoveryCategory;

function matchesSearch(values: readonly string[], query: string) {
  if (!query) return true;
  return values.join(" ").toLowerCase().includes(query);
}

function policyIcon(category: PublicPolicyDiscoveryCategory) {
  return category === "Safety" ? ShieldCheck : FileText;
}

const supportDestinations = [
  { label: "Account", category: "account" },
  { label: "Billing", category: "billing" },
  { label: "Safety", category: "safety" },
  { label: "Technical", category: "bug" },
] as const;

export default function PolicyHelpDiscoveryClient({
  policyEntries,
}: {
  policyEntries: readonly PublicPolicyDiscoveryEntry[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DiscoveryCategory>("All");
  const cleanQuery = query.trim().toLowerCase();

  const categories = useMemo(() => {
    const values = new Set<DiscoveryCategory>(["All"]);
    for (const entry of policyEntries) values.add(entry.category);
    return [...values];
  }, [policyEntries]);

  const filteredPolicyEntries = useMemo(
    () =>
      policyEntries.filter(
        (entry) =>
          (category === "All" || category === entry.category) &&
          matchesSearch(
            [entry.title, entry.description, entry.category, ...entry.keywords],
            cleanQuery,
          ),
      ),
    [category, cleanQuery, policyEntries],
  );

  return (
    <div className="support-v2-page support-policy-discovery-page">
      <div className="support-v2-shell">
        <header className="support-v2-hero">
          <p className="support-v2-eyebrow">Loombus Help & Support</p>
          <h1>How can we help?</h1>
          <p className="support-v2-hero-copy">
            Contact Loombus for account, billing, safety, accessibility, or technical
            help, or search the current public policies below.
          </p>

          <div className="support-v2-search-row">
            <label className="support-v2-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Search Loombus policies</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search privacy, safety, terms, refunds, accessibility..."
              />
            </label>

            <div className="support-v2-actions">
              <a
                href="/support?category=general#support-request-title"
                className="support-v2-primary-button"
              >
                <LifeBuoy aria-hidden="true" />
                Contact support
              </a>
              <a
                href="/support?category=bug#support-request-title"
                className="support-v2-secondary-button"
              >
                <Wrench aria-hidden="true" />
                Report a problem
              </a>
            </div>
          </div>

          <nav className="support-policy-category-nav" aria-label="Common support needs">
            {supportDestinations.map((item) => (
              <a
                key={item.category}
                href={`/support?category=${item.category}#support-request-title`}
                className="support-policy-category-button"
              >
                {item.label}
              </a>
            ))}
            <a href="#support-policy-documents" className="support-policy-category-button">
              Policies
            </a>
          </nav>
        </header>

        <section
          id="support-policy-documents"
          className="support-v2-section"
          aria-labelledby="support-policy-documents-title"
        >
          <div className="support-v2-section-heading">
            <div>
              <p className="support-v2-section-kicker">Policies and trust</p>
              <h2 id="support-policy-documents-title">Current public documents</h2>
            </div>
            <span className="support-v2-result-count">
              {filteredPolicyEntries.length} document
              {filteredPolicyEntries.length === 1 ? "" : "s"}
            </span>
          </div>

          <nav className="support-policy-category-nav" aria-label="Policy categories">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                className="support-policy-category-button"
                data-active={category === item ? "true" : "false"}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </nav>

          {filteredPolicyEntries.length > 0 ? (
            <div className="support-v2-panel">
              <div className="support-v2-article-list">
                {filteredPolicyEntries.map((entry) => {
                  const Icon = policyIcon(entry.category);
                  return (
                    <Link
                      key={entry.documentId}
                      href={entry.href}
                      className="support-v2-article"
                    >
                      <span className="support-v2-article-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="support-v2-article-copy">
                        <strong>{entry.title}</strong>
                        <span>{entry.description}</span>
                      </span>
                      <span className="support-v2-article-meta">
                        {entry.category}
                        <ChevronRight aria-hidden="true" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="support-v2-no-results" aria-live="polite">
              <h2>No policy documents match “{query.trim()}”</h2>
              <p>Try a broader word, choose All, or contact Loombus Support.</p>
              <div className="support-v2-actions support-policy-centered-actions">
                <button
                  type="button"
                  className="support-v2-clear-search"
                  onClick={() => {
                    setQuery("");
                    setCategory("All");
                  }}
                >
                  Clear search
                </button>
                <a
                  href="/support?category=general#support-request-title"
                  className="support-v2-primary-button"
                >
                  Contact support
                </a>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
