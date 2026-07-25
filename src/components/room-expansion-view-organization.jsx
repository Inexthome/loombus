"use client";

import { BarChart3, Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  formatBytes,
  StudioPagination,
} from "@/components/room-expansion-ui";

const ORGANIZATION_PAGE_SIZE = 12;

export function OrganizationView({
  data,
  manifest,
  working,
  action,
  request,
}) {
  const [consoleData, setConsoleData] = useState(data ?? null);
  const organization = consoleData?.organization;
  const rooms = consoleData?.rooms ?? [];
  const totals = consoleData?.totals ?? {};
  const pageInfo = consoleData?.pageInfo ?? null;
  const limits = consoleData?.limits ?? {};

  const [name, setName] = useState(organization?.name ?? "");
  const [logoUrl, setLogoUrl] = useState(
    organization?.branding?.logoUrl ?? ""
  );
  const [accent, setAccent] = useState(
    organization?.branding?.accent ?? ""
  );
  const [description, setDescription] = useState(
    organization?.branding?.description ?? ""
  );
  const [domains, setDomains] = useState(
    (organization?.security?.allowedEmailDomains ?? []).join("\n")
  );
  const [requireApproval, setRequireApproval] = useState(
    organization?.security?.requireInviteApproval !== false
  );
  const [defaultRole, setDefaultRole] = useState(
    organization?.security?.defaultInviteRole === "moderator"
      ? "moderator"
      : "member"
  );
  const [legalHold, setLegalHold] = useState(
    organization?.security?.legalHold === true
  );
  const [retentionDays, setRetentionDays] = useState(
    String(organization?.security?.retentionDays ?? 0)
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchLimits, setSearchLimits] = useState(null);
  const [searching, setSearching] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [notice, setNotice] = useState("");

  const pageAbortRef = useRef(null);
  const searchAbortRef = useRef(null);
  const roomListHeadingRef = useRef(null);

  useEffect(() => {
    setConsoleData(data ?? null);
  }, [data]);

  useEffect(() => {
    setName(organization?.name ?? "");
    setLogoUrl(organization?.branding?.logoUrl ?? "");
    setAccent(organization?.branding?.accent ?? "");
    setDescription(organization?.branding?.description ?? "");
    setDomains(
      (organization?.security?.allowedEmailDomains ?? []).join("\n")
    );
    setRequireApproval(
      organization?.security?.requireInviteApproval !== false
    );
    setDefaultRole(
      organization?.security?.defaultInviteRole === "moderator"
        ? "moderator"
        : "member"
    );
    setLegalHold(organization?.security?.legalHold === true);
    setRetentionDays(
      String(organization?.security?.retentionDays ?? 0)
    );
  }, [organization]);

  useEffect(
    () => () => {
      pageAbortRef.current?.abort();
      searchAbortRef.current?.abort();
    },
    []
  );

  async function loadPage(page, focusResults = true) {
    pageAbortRef.current?.abort();
    const controller = new AbortController();
    pageAbortRef.current = controller;
    setLoadingPage(true);
    setNotice("");
    try {
      const params = new URLSearchParams({
        page: String(Math.max(1, page)),
        limit: String(ORGANIZATION_PAGE_SIZE),
      });
      const next = await request(
        "organization",
        { signal: controller.signal },
        params
      );
      setConsoleData(next);
      if (focusResults) {
        window.requestAnimationFrame(() => roomListHeadingRef.current?.focus());
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        setNotice(
          error instanceof Error
            ? error.message
            : "Organization Rooms could not load."
        );
      }
    } finally {
      if (pageAbortRef.current === controller) setLoadingPage(false);
    }
  }

  async function search(event) {
    event.preventDefault();
    const cleaned = query.trim();
    if (cleaned.length < 2) return;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);
    setNotice("");
    try {
      const params = new URLSearchParams({ q: cleaned });
      const found = await request(
        "organization_search",
        { signal: controller.signal },
        params
      );
      setResults(Array.isArray(found?.items) ? found.items : []);
      setSearchLimits(found?.limits ?? null);
    } catch (error) {
      if (error?.name !== "AbortError") {
        setNotice(
          error instanceof Error
            ? error.message
            : "Organization search could not run."
        );
      }
    } finally {
      if (searchAbortRef.current === controller) setSearching(false);
    }
  }

  async function saveOrganization() {
    await action(
      {
        action: "save_organization",
        name,
        logoUrl,
        accent,
        description,
        allowedEmailDomains: domains.split("\n"),
        requireInviteApproval: requireApproval,
        defaultInviteRole: defaultRole,
        legalHold,
        retentionDays: Number(retentionDays || 0),
      },
      "Organization settings saved.",
      "organization"
    );
  }

  async function applyPolicy() {
    await action(
      { action: "propagate_organization_security" },
      "Organization invitation policy applied to all Rooms.",
      "organization"
    );
  }

  return (
    <div className="room-organization-layout">
      <section className="room-organization-branding">
        <form
          className="room-expansion-form"
          onSubmit={(event) => event.preventDefault()}
          aria-busy={working}
        >
          <h3>Shared organization identity</h3>
          <label>
            <span>Organization name</span>
            <input
              value={name}
              maxLength={160}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <span>Logo URL</span>
            <input
              type="url"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
            />
          </label>
          <label>
            <span>Accent token</span>
            <input
              value={accent}
              maxLength={120}
              onChange={(event) => setAccent(event.target.value)}
              placeholder="#5b5bd6 or a CSS color"
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              rows={4}
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <h3>Shared invitation policy</h3>
          <label>
            <span>Allowed email domains, one per line</span>
            <textarea
              rows={5}
              value={domains}
              onChange={(event) => setDomains(event.target.value)}
            />
          </label>
          <label className="room-expansion-checkbox">
            <input
              type="checkbox"
              checked={requireApproval}
              onChange={(event) => setRequireApproval(event.target.checked)}
            />
            Require invitation approval
          </label>
          <label>
            <span>Default invite role</span>
            <select
              value={defaultRole}
              onChange={(event) => setDefaultRole(event.target.value)}
            >
              <option value="member">Member</option>
              <option value="moderator">Moderator</option>
            </select>
          </label>

          {manifest.capabilities?.enterprise ? (
            <>
              <h3>Enterprise retention</h3>
              <label className="room-expansion-checkbox">
                <input
                  type="checkbox"
                  checked={legalHold}
                  onChange={(event) => setLegalHold(event.target.checked)}
                />
                Legal hold blocks Room deletion
              </label>
              <label>
                <span>Minimum retention days</span>
                <input
                  type="number"
                  min="0"
                  max="3650"
                  value={retentionDays}
                  onChange={(event) => setRetentionDays(event.target.value)}
                />
              </label>
            </>
          ) : null}

          <div className="room-expansion-inline-actions">
            <button type="button" disabled={working} onClick={saveOrganization}>
              Save organization
            </button>
            <button type="button" disabled={working} onClick={applyPolicy}>
              Apply policy to Rooms
            </button>
          </div>
        </form>
      </section>

      <section className="room-organization-console" aria-busy={loadingPage}>
        {notice ? (
          <p className="room-expansion-limit-warning" role="alert">
            {notice}
          </p>
        ) : null}

        <div className="room-organization-metrics">
          {[
            ["Rooms", totals.rooms],
            ["Members", totals.members],
            ["Discussions", totals.posts],
            ["Operational records", totals.records],
            ["Files", totals.files],
            ["Events", totals.events],
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value ?? 0}</strong>
            </article>
          ))}
        </div>

        {limits.totalsRoomsCapped || limits.storageRowsCapped ? (
          <p className="room-expansion-limit-warning" role="status">
            Organization totals reached a bounded safety limit. The Room list
            remains fully paginated, while aggregate storage or cross-Room totals
            may represent only the bounded set already loaded.
          </p>
        ) : null}

        <div className="room-expansion-card">
          <h3>Cross-Room search</h3>
          <form className="room-organization-search" onSubmit={search}>
            <input
              value={query}
              maxLength={160}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search every Room in this organization"
              aria-label="Search organization Rooms"
            />
            <button
              type="submit"
              disabled={searching || query.trim().length < 2}
            >
              {searching ? (
                <Loader2 className="is-spinning" aria-hidden="true" />
              ) : (
                <Search aria-hidden="true" />
              )}
              Search
            </button>
          </form>
          {searchLimits?.roomsCapped || searchLimits?.resultsCapped ? (
            <p className="room-expansion-limit-warning" role="status">
              Search reached its bounded cross-Room safety limit. Refine the
              search phrase to narrow the results.
            </p>
          ) : null}
          <div className="room-organization-results" aria-live="polite">
            {results.map((result) => (
              <a
                key={`${result.roomId}-${result.targetId}`}
                href={`/rooms/${result.roomId}`}
              >
                <span>
                  {result.roomName} · {result.moduleKey}
                </span>
                <strong>{result.title}</strong>
                <p>{result.snippet}</p>
              </a>
            ))}
          </div>
        </div>

        <h3
          ref={roomListHeadingRef}
          tabIndex={-1}
          className="room-core-results-heading"
        >
          Organization Rooms
        </h3>
        {loadingPage ? (
          <div className="room-expansion-loading" role="status">
            <Loader2 className="is-spinning" aria-hidden="true" />
            Loading organization Rooms
          </div>
        ) : (
          <div className="room-organization-room-list">
            {rooms.map((room) => (
              <a
                key={room.id}
                href={`/rooms/${room.id}`}
                className="room-expansion-card"
              >
                <header>
                  <div>
                    <span>{room.plan}</span>
                    <small>{room.status}</small>
                  </div>
                  <BarChart3 aria-hidden="true" />
                </header>
                <h3>{room.name}</h3>
                <p>{room.description}</p>
                <div className="room-expansion-meta">
                  <span>{room.members} members</span>
                  <span>{room.posts} discussions</span>
                  <span>{room.records} records</span>
                  <span>{formatBytes(room.storageBytes)}</span>
                </div>
              </a>
            ))}
          </div>
        )}

        <StudioPagination
          pageInfo={pageInfo}
          loading={loadingPage || working}
          onPageChange={loadPage}
          itemLabel="Rooms"
        />
      </section>
    </div>
  );
}
