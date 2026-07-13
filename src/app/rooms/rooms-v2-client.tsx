"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  RoomModelCard,
  RoomsHonestEmptyState,
  RoomsSectionHeading,
  RoomWorkspaceBlueprint,
} from "./rooms-v2-components";
import {
  type RoomCategory,
  ROOM_MODELS,
} from "./rooms-v2-model";

const filters = ["All", "Business", "Residents", "Classroom", "Customer", "Community"] as const;
type RoomFilter = (typeof filters)[number];

export default function RoomsV2Client() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<RoomFilter>("All");

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return ROOM_MODELS.filter((model) => {
      const matchesFilter = activeFilter === "All" || model.category === activeFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          model.title,
          model.shortTitle,
          model.category,
          model.description,
          model.audience,
          model.calendarUse,
          ...model.examples,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query]);

  return (
    <main className="rooms-v2-page">
      <div className="rooms-v2-shell">
        <section className="rooms-v2-hero">
          <div className="rooms-v2-hero-copy">
            <p className="rooms-v2-eyebrow">Private Rooms</p>
            <h1>Give a group one private place to discuss, organize, and act.</h1>
            <p className="rooms-v2-hero-description">
              Rooms are designed for teams, residents, classrooms, customers, and communities that
              need more than a public feed. Each room is intended to combine focused discussion,
              announcements, resources, members, and its own shared calendar.
            </p>
            <div className="rooms-v2-hero-actions">
              <Link href="/rooms/new" className="rooms-v2-button rooms-v2-button-primary">
                Plan a private room
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <a href="#room-models" className="rooms-v2-button rooms-v2-button-quiet">
                Explore room models
              </a>
            </div>
          </div>

          <aside className="rooms-v2-boundary-card">
            <div className="rooms-v2-boundary-heading">
              <span>
                <Lock aria-hidden="true" size={20} />
              </span>
              <div>
                <p>Current product boundary</p>
                <strong>Private by design</strong>
              </div>
            </div>
            <div className="rooms-v2-boundary-list">
              <p>
                <CheckCircle2 aria-hidden="true" size={16} />
                Room content is not presented as public Discussions.
              </p>
              <p>
                <CheckCircle2 aria-hidden="true" size={16} />
                No sample room, member, event, or activity is shown as real account data.
              </p>
              <p>
                <CheckCircle2 aria-hidden="true" size={16} />
                The current builder prepares a setup plan only; it does not provision or charge.
              </p>
            </div>
          </aside>
        </section>

        <section className="rooms-v2-section">
          <RoomsSectionHeading
            eyebrow="Your rooms"
            title="A private workspace should begin with real access, not placeholder activity."
            description="Room records and memberships are not connected to the current production route, so the dashboard stays truthful until those contracts exist."
            action={{ href: "/rooms/new", label: "Plan a room" }}
          />
          <RoomsHonestEmptyState />
        </section>

        <section className="rooms-v2-section" id="room-models">
          <RoomsSectionHeading
            eyebrow="Room models"
            title="Choose the structure that matches the group."
            description="Search and compare the room blueprints Loombus is organizing around. Selecting a model in the builder changes its suggested identity and purpose."
          />

          <div className="rooms-v2-explorer">
            <label className="rooms-v2-search">
              <Search aria-hidden="true" size={20} />
              <span className="sr-only">Search room models</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search room models, audiences, or calendar uses"
              />
            </label>

            <div className="rooms-v2-filter-row" aria-label="Filter room models">
              {filters.map((filter) => {
                const selected = activeFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredModels.length > 0 ? (
            <div className="rooms-v2-model-grid">
              {filteredModels.map((model) => (
                <RoomModelCard key={model.id} model={model} />
              ))}
            </div>
          ) : (
            <div className="rooms-v2-no-results">
              <Search aria-hidden="true" size={22} />
              <h3>No room model matches that search.</h3>
              <p>Clear the search or choose another category.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveFilter("All");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        <section className="rooms-v2-section rooms-v2-blueprint-section">
          <RoomsSectionHeading
            eyebrow="Workspace blueprint"
            title="Every room should connect conversation to coordination."
            description="These modules define the intended room experience. They are presented as the product blueprint, not as currently connected room records."
          />
          <RoomWorkspaceBlueprint />
        </section>

        <section className="rooms-v2-calendar-feature">
          <div className="rooms-v2-calendar-icon">
            <CalendarDays aria-hidden="true" size={25} />
          </div>
          <div className="rooms-v2-calendar-copy">
            <p className="rooms-v2-eyebrow">Room calendar</p>
            <h2>Shared dates belong inside the room where people already have context.</h2>
            <p>
              Owners, administrators, HOA managers, teachers, or authorized staff should be able to
              publish meetings, deadlines, maintenance windows, classes, releases, and events for the
              members of that room.
            </p>
          </div>
          <div className="rooms-v2-calendar-principles">
            <div>
              <strong>Role-controlled publishing</strong>
              <span>Only authorized room roles create or change events.</span>
            </div>
            <div>
              <strong>Member visibility</strong>
              <span>Upcoming dates remain visible to the people inside the room.</span>
            </div>
            <div>
              <strong>Context beside the event</strong>
              <span>Announcements, files, and discussions can support the shared date.</span>
            </div>
          </div>
        </section>

        <section className="rooms-v2-operating-section">
          <div>
            <p className="rooms-v2-eyebrow">Access model</p>
            <h2>Clear roles without turning the room into another noisy social feed.</h2>
            <p>
              The intended hierarchy is Owner, Administrator, Moderator, and Member. Invitations,
              approvals, posting controls, calendar publishing, files, and moderation should follow
              those explicit roles.
            </p>
          </div>
          <div className="rooms-v2-role-grid">
            <article>
              <span><ShieldCheck aria-hidden="true" size={19} /></span>
              <strong>Owner</strong>
              <p>Controls the room identity, access model, administrators, and high-risk settings.</p>
            </article>
            <article>
              <span><Sparkles aria-hidden="true" size={19} /></span>
              <strong>Administrator</strong>
              <p>Manages members, announcements, events, resources, and operational settings.</p>
            </article>
            <article>
              <span><CheckCircle2 aria-hidden="true" size={19} /></span>
              <strong>Moderator</strong>
              <p>Maintains discussion quality and handles room-level safety actions.</p>
            </article>
            <article>
              <span><Users aria-hidden="true" size={19} /></span>
              <strong>Member</strong>
              <p>Participates according to the room permissions established by its leadership.</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
