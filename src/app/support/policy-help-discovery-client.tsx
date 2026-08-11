"use client";

import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  FileText,
  LifeBuoy,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  PUBLIC_HELP_AREAS,
  PUBLIC_HELP_ARTICLES,
} from "@/lib/public-help-catalog";
import type {
  PublicPolicyDiscoveryCategory,
  PublicPolicyDiscoveryEntry,
} from "@/lib/policy-content-public-discovery";

type DiscoveryCategory = "All" | "Help" | PublicPolicyDiscoveryCategory;

function matchesSearch(values: readonly string[], query: string) {
  if (!query) return true;
  return values.join(" ").toLowerCase().includes(query);
}

function categoryMatches(
  selected: DiscoveryCategory,
  itemCategory: DiscoveryCategory,
) {
  return selected === "All" || selected === itemCategory;
}

function policyIcon(category: PublicPolicyDiscoveryCategory) {
  return category === "Safety" ? ShieldCheck : FileText;
}

export default function PolicyHelpDiscoveryClient({
  policyEntries,
}: {
  policyEntries: readonly PublicPolicyDiscoveryEntry[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DiscoveryCategory>("All");
  const cleanQuery = query.trim().toLowerCase();

  const categories = useMemo(() => {
    const values = new Set<DiscoveryCategory>(["All", "Help"]);
    for (const entry of policyEntries) values.add(entry.category);
    return [...values];
  }, [policyEntries]);

  const filteredHelpAreas = useMemo(() => {
    if (!categoryMatches(category, "Help")) return [];
    return PUBLIC_HELP_AREAS.filter((area) =>
      matchesSearch(
        [area.title, area.description, area.eyebrow, ...area.keywords],
        cleanQuery,
      ),
    );
  }, [category, cleanQuery]);

  const filteredHelpArticles = useMemo(() => {
    if (!categoryMatches(category, "Help")) return [];
    return PUBLIC_HELP_ARTICLES.filter((article) =>
      matchesSearch(
        [article.title, article.description, article.category, ...article.keywords],
        cleanQuery,
      ),
    );
  }, [category, cleanQuery]);

  const filteredPolicyEntries = useMemo(
    () =>
      policyEntries.filter(
        (entry) =>
          categoryMatches(category, entry.category) &&
          matchesSearch(
            [entry.title, entry.description, entry.category, ...entry.keywords],
            cleanQuery,
          ),
      ),
    [category, cleanQuery, policyEntries],
  );

  const resultCount =
    filteredHelpAreas.length +
    filteredHelpArticles.length +
    filteredPolicyEntries.length;
  const hasResults = resultCount > 0;

  return (
    <div className="support-v2-page support-policy-discovery-page">
      <div className="support-v2-shell">
        <header className="support-v2-hero">
          <p className="support-v2-eyebrow">Loombus Help & Support</p>
          <h1>Find help, policies, and trusted platform guidance.</h1>
          <p className="support-v2-hero-copy">
            Search public Help guidance and the current public policy, safety, legal,
            and reference documents from one place.
          </p>

          <div className="support-v2-search-row">
            <label className="support-v2-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Search Loombus Help and policies</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Help, privacy, safety, accessibility, billing, Rooms, AI..."
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

          <nav
            className="support-policy-category-nav"
            aria-label="Help and policy categories"
          >
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

          <div className="support-v2-context-chips" aria-label="Support center details">
            <span className="support-v2-context-chip">Public Help Center</span>
            <span className="support-v2-context-chip">Current public policies only</span>
            <span className="support-v2-context-chip">Version-aware policy discovery</span>
            <span className="support-v2-context-chip">Works without signing in</span>
          </div>
        </header>

        {hasResults ? (
          <>
            {filteredHelpAreas.length > 0 && (
              <section className="support-v2-section" aria-labelledby="policy-help-areas">
                <div className="support-v2-section-heading">
                  <div>
                    <p className="support-v2-section-kicker">Help by area</p>
                    <h2 id="policy-help-areas">Go directly to the right workspace</h2>
                  </div>
                  <span className="support-v2-result-count">
                    {filteredHelpAreas.length} area
                    {filteredHelpAreas.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="support-v2-category-grid">
                  {filteredHelpAreas.map((area) => (
                    <Link key={area.id} href={area.href} className="support-v2-card">
                      <span className="support-v2-card-icon">
                        <BookOpen aria-hidden="true" />
                      </span>
                      <h3>{area.title}</h3>
                      <p>{area.description}</p>
                      <span className="support-v2-card-link">
                        {area.eyebrow}
                        <ChevronRight aria-hidden="true" />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {filteredHelpArticles.length > 0 && (
              <section className="support-v2-section" aria-labelledby="policy-help-articles">
                <div className="support-v2-section-heading">
                  <div>
                    <p className="support-v2-section-kicker">Guides and actions</p>
                    <h2 id="policy-help-articles">Help topics across Loombus</h2>
                  </div>
                  <span className="support-v2-result-count">
                    {filteredHelpArticles.length} result
                    {filteredHelpArticles.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="support-v2-panel">
                  <div className="support-v2-article-list">
                    {filteredHelpArticles.map((article) => (
                      <Link
                        key={article.id}
                        href={article.href}
                        className="support-v2-article"
                      >
                        <span className="support-v2-article-icon">
                          <BookOpen aria-hidden="true" />
                        </span>
                        <span className="support-v2-article-copy">
                          <strong>{article.title}</strong>
                          <span>{article.description}</span>
                        </span>
                        <span className="support-v2-article-meta">
                          {article.category}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {filteredPolicyEntries.length > 0 && (
              <section
                className="support-v2-section"
                aria-labelledby="policy-help-documents"
              >
                <div className="support-v2-section-heading">
                  <div>
                    <p className="support-v2-section-kicker">Policy and trust</p>
                    <h2 id="policy-help-documents">Current public documents</h2>
                  </div>
                  <span className="support-v2-result-count">
                    {filteredPolicyEntries.length} document
                    {filteredPolicyEntries.length === 1 ? "" : "s"}
                  </span>
                </div>

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
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </>
        ) : (
          <section
            className="support-v2-section support-v2-no-results"
            aria-live="polite"
          >
            <h2>No Help or policy results match “{query.trim()}”</h2>
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
          </section>
        )}
      </div>
    </div>
  );
}
