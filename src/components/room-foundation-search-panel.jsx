"use client";

import { Loader2, Search } from "lucide-react";
import { RoomCorePagination } from "@/components/room-core-pagination";
import { SEARCH_MODULES, formatDate } from "@/components/room-foundation-types";

export function RoomFoundationSearchPanel({
  query,
  moduleFilter,
  searchPayload,
  loadingPanel,
  resultsHeadingRef,
  searchInputRef,
  setQuery,
  setModuleFilter,
  handleSearchSubmit,
  loadSearch,
  openModule,
}) {
  const results = searchPayload?.results ?? [];
  return (
    <>
      <form className="room-foundation-search-form" onSubmit={handleSearchSubmit}>
        <label>
          <span className="sr-only">Search Room content</span>
          <Search aria-hidden="true" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search words, titles, files, tasks, or answers"
            maxLength={160}
          />
        </label>
        <select
          value={moduleFilter}
          onChange={(event) => setModuleFilter(event.target.value)}
          aria-label="Filter Room search by module"
        >
          {SEARCH_MODULES.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loadingPanel || query.trim().length < 2}>
          {loadingPanel ? (
            <Loader2 className="is-spinning" aria-hidden="true" />
          ) : (
            <Search aria-hidden="true" />
          )}
          Search
        </button>
      </form>

      <div className="room-foundation-results room-core-results-region">
        <h3 ref={resultsHeadingRef} className="room-core-results-heading" tabIndex={-1}>
          Room search results
        </h3>
        {searchPayload?.resultsCapped ? (
          <p className="room-core-limit-warning" role="status">
            Search reached its private safety limit. Refine the words or module filter to narrow the result set.
          </p>
        ) : null}
        {!loadingPanel && results.length === 0 ? (
          <div className="room-foundation-empty">
            <Search aria-hidden="true" />
            <h3>{searchPayload ? "No matching Room content" : "Search the complete Room"}</h3>
            <p>Results are limited to modules included in this Room plan and sections your role may open.</p>
          </div>
        ) : (
          results.map((result) => (
            <button
              key={`${result.targetType}-${result.targetId}`}
              type="button"
              className="room-foundation-result"
              onClick={() => openModule(result.moduleKey)}
            >
              <span>
                {result.moduleLabel}
                {result.createdAt ? ` · ${formatDate(result.createdAt)}` : ""}
              </span>
              <strong>{result.title}</strong>
              {result.snippet ? <p>{result.snippet}</p> : null}
            </button>
          ))
        )}
        <RoomCorePagination
          pageInfo={searchPayload?.pageInfo}
          loading={loadingPanel}
          onPageChange={(page) => void loadSearch(page, true)}
          itemLabel="results"
        />
      </div>
    </>
  );
}
