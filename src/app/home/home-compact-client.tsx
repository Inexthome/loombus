"use client";

import Link from "next/link";
import {
  Bell,
  Bookmark,
  ChevronRight,
  CircleUserRound,
  Compass,
  Eye,
  Home,
  LayoutDashboard,
  MessageCircle,
  MessageSquareReply,
  Pencil,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DateOfBirthSelect } from "@/components/date-of-birth-select";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getAgeBandFromDateOfBirth } from "@/lib/age-safety";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";
import { supabase } from "@/lib/supabase/client";

type HomeProfile = {
  id?: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type HomeDiscussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  discussion_status: string | null;
  created_at: string;
  replyCount: number;
  viewCount: number;
  savedCount: number;
  saved: boolean;
  author: HomeProfile | null;
};

type HomeCounts = {
  messages: number;
  notifications: number;
  saved: number;
};

const EMPTY_COUNTS: HomeCounts = {
  messages: 0,
  notifications: 0,
  saved: 0,
};

function relativeTime(value: string) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const NAV_ITEMS = [
  { label: "Home", href: "/home", icon: Home, active: true },
  { label: "Discussions", href: "/discussions", icon: MessageSquareReply },
  { label: "Saved", href: "/saved", icon: Bookmark },
  { label: "Rooms", href: "/rooms", icon: Users },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "People", href: "/people", icon: CircleUserRound },
];

function AttentionRow({
  href,
  label,
  value,
  icon,
}: {
  href: string;
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="home-compact-attention-row">
      <span className="home-compact-row-icon">{icon}</span>
      <span className="home-compact-attention-label">{label}</span>
      <span className={value > 0 ? "home-compact-count is-active" : "home-compact-count"}>{value}</span>
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

export default function HomeCompactClient() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [counts, setCounts] = useState<HomeCounts>(EMPTY_COUNTS);
  const [discussions, setDiscussions] = useState<HomeDiscussion[]>([]);
  const [dob, setDob] = useState("");
  const [dobConfirmed, setDobConfirmed] = useState(true);
  const [dobSaving, setDobSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadHome() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        const user = session?.user;

        if (!session || !user) {
          window.location.replace("/login?next=%2Fhome");
          return;
        }

        const [profileResult, sensitiveResult, messageResult, notificationResult, savedResult, discussionResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("full_name, username, bio, avatar_url")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("profile_sensitive")
              .select("date_of_birth")
              .eq("id", user.id)
              .maybeSingle(),
            fetch("/api/messages/unread-count", {
              headers: { Authorization: `Bearer ${session.access_token}` },
              cache: "no-store",
            })
              .then((response) => (response.ok ? response.json() : { unreadCount: 0 }))
              .catch(() => ({ unreadCount: 0 })),
            supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .is("read_at", null),
            supabase
              .from("bookmarks")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id),
            supabase
              .from("discussions")
              .select("id, user_id, title, topic, discussion_status, created_at")
              .is("deleted_at", null)
              .order("created_at", { ascending: false })
              .limit(10),
          ]);

        if (profileResult.error) throw profileResult.error;
        if (sensitiveResult.error) throw sensitiveResult.error;
        if (notificationResult.error) throw notificationResult.error;
        if (savedResult.error) throw savedResult.error;
        if (discussionResult.error) throw discussionResult.error;

        const rows = (discussionResult.data ?? []) as Array<{
          id: string;
          user_id: string;
          title: string;
          topic: string | null;
          discussion_status: string | null;
          created_at: string;
        }>;
        const ids = rows.map((row) => row.id);
        const authorIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];

        const [replyResult, viewResult, saveCountResult, mySaveResult, authorResult] = await Promise.all([
          ids.length
            ? supabase.from("replies").select("discussion_id").in("discussion_id", ids).is("deleted_at", null)
            : Promise.resolve({ data: [], error: null }),
          ids.length
            ? supabase.from("discussion_views").select("discussion_id").in("discussion_id", ids)
            : Promise.resolve({ data: [], error: null }),
          ids.length
            ? supabase.from("bookmarks").select("discussion_id").in("discussion_id", ids)
            : Promise.resolve({ data: [], error: null }),
          ids.length
            ? supabase.from("bookmarks").select("discussion_id").eq("user_id", user.id).in("discussion_id", ids)
            : Promise.resolve({ data: [], error: null }),
          authorIds.length
            ? supabase.from("profiles").select("id, full_name, username, bio, avatar_url").in("id", authorIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (replyResult.error) throw replyResult.error;
        if (viewResult.error) throw viewResult.error;
        if (saveCountResult.error) throw saveCountResult.error;
        if (mySaveResult.error) throw mySaveResult.error;
        if (authorResult.error) throw authorResult.error;

        const replyCounts: Record<string, number> = {};
        const viewCounts: Record<string, number> = {};
        const saveCounts: Record<string, number> = {};

        for (const row of replyResult.data ?? []) {
          replyCounts[row.discussion_id] = (replyCounts[row.discussion_id] ?? 0) + 1;
        }
        for (const row of viewResult.data ?? []) {
          viewCounts[row.discussion_id] = (viewCounts[row.discussion_id] ?? 0) + 1;
        }
        for (const row of saveCountResult.data ?? []) {
          saveCounts[row.discussion_id] = (saveCounts[row.discussion_id] ?? 0) + 1;
        }

        const savedIds = new Set((mySaveResult.data ?? []).map((row) => row.discussion_id));
        const authors = new Map<string, HomeProfile>();
        for (const author of (authorResult.data ?? []) as HomeProfile[]) {
          if (author.id) authors.set(author.id, author);
        }

        if (!mounted) return;

        const profileData = (profileResult.data as HomeProfile | null) ?? null;
        const storedDob = typeof sensitiveResult.data?.date_of_birth === "string" ? sensitiveResult.data.date_of_birth : "";

        setProfile(profileData);
        setDob(storedDob);
        setDobConfirmed(Boolean(storedDob));
        setCounts({
          messages: Number(messageResult?.unreadCount ?? 0),
          notifications: notificationResult.count ?? 0,
          saved: savedResult.count ?? 0,
        });
        setDiscussions(
          rows.map((row) => ({
            ...row,
            replyCount: replyCounts[row.id] ?? 0,
            viewCount: viewCounts[row.id] ?? 0,
            savedCount: saveCounts[row.id] ?? 0,
            saved: savedIds.has(row.id),
            author: authors.get(row.user_id) ?? null,
          }))
        );
      } catch (error) {
        if (!mounted) return;
        setNotice(error instanceof Error ? error.message : "Some Home activity could not load. Refresh to try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadHome();
    return () => {
      mounted = false;
    };
  }, []);

  const profileStatus = validatePublicProfileCompletion({
    fullName: profile?.full_name ?? null,
    username: profile?.username ?? null,
    bio: profile?.bio ?? null,
  });

  const trendingTopics = useMemo(() => {
    const topics = new Map<string, number>();
    for (const discussion of discussions) {
      const topic = discussion.topic?.trim() || "Discussion";
      topics.set(topic, (topics.get(topic) ?? 0) + 1);
    }
    return [...topics.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  }, [discussions]);

  async function saveDiscussion(discussion: HomeDiscussion) {
    if (discussion.saved || savingId) return;
    setSavingId(discussion.id);
    setNotice("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = token
      ? await fetch("/api/bookmarks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ discussionId: discussion.id }),
        })
      : null;

    if (response?.ok || response?.status === 409) {
      setDiscussions((current) =>
        current.map((item) =>
          item.id === discussion.id
            ? { ...item, saved: true, savedCount: item.savedCount + (item.saved ? 0 : 1) }
            : item
        )
      );
      setCounts((current) => ({ ...current, saved: current.saved + 1 }));
      setNotice("Discussion saved.");
    } else {
      setNotice("Unable to save this discussion right now.");
    }

    setSavingId(null);
  }

  async function confirmDob() {
    const band = getAgeBandFromDateOfBirth(dob);
    if (!band) {
      setNotice("Enter a valid date of birth.");
      return;
    }
    if (band === "under_13") {
      setNotice("This account is not eligible to use Loombus.");
      return;
    }

    setDobSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = token
      ? await fetch("/api/profile/age", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ dateOfBirth: dob }),
        })
      : null;

    if (response?.ok) {
      setDobConfirmed(true);
      setNotice("Date of birth saved.");
    } else {
      setNotice("Unable to save date of birth.");
    }
    setDobSaving(false);
  }

  if (loading) {
    return <LoombusLoadingScreen title="Loading Home..." message="Preparing your discussions." />;
  }

  return (
    <main className="home-compact-page min-h-screen text-[var(--loombus-text)]">
      <div className="home-compact-shell">
        <aside className="home-compact-left" aria-label="Home navigation">
          <nav className="home-compact-nav">
            {NAV_ITEMS.map(({ label, href, icon: Icon, active }) => (
              <Link key={href} href={href} className={active ? "home-compact-nav-item is-active" : "home-compact-nav-item"}>
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <div className="home-compact-nav-separator" />
          <Link href="/dashboard" className="home-compact-nav-item">
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>
          <Link href="/discover" className="home-compact-nav-item">
            <Compass className="h-5 w-5" />
            <span>Discover</span>
          </Link>
          <Link href="/search" className="home-compact-nav-item">
            <Search className="h-5 w-5" />
            <span>Search</span>
          </Link>
        </aside>

        <section className="home-compact-center">
          {notice ? <div className="home-compact-notice">{notice}</div> : null}

          {!profileStatus.ok ? (
            <section className="home-compact-gate">
              <div>
                <strong>Complete your public profile</strong>
                <p>{profileStatus.message}</p>
              </div>
              <Link href="/profile" className="home-compact-primary">Complete profile</Link>
            </section>
          ) : null}

          {!dobConfirmed ? (
            <section className="home-compact-gate is-stacked">
              <div>
                <strong>Confirm your date of birth</strong>
                <p>This information is stored separately from your public profile.</p>
              </div>
              <DateOfBirthSelect
                value={dob}
                onChange={setDob}
                idPrefix="home-age"
                disabled={dobSaving}
                className="home-compact-dob"
                selectClassName="home-compact-select"
              />
              <button type="button" onClick={() => void confirmDob()} disabled={dobSaving} className="home-compact-primary">
                {dobSaving ? "Saving..." : "Confirm date of birth"}
              </button>
            </section>
          ) : null}

          <section className="home-compact-composer">
            <Link href="/create" className="home-compact-composer-main">
              <span className="home-compact-composer-icon"><Pencil className="h-5 w-5" /></span>
              <span>Start a discussion, ask a question, or share an idea...</span>
            </Link>
            <Link href="/create" className="home-compact-create-icon" aria-label="Create discussion">
              <Plus className="h-5 w-5" />
            </Link>
          </section>

          <div className="home-compact-feed-heading">
            <div>
              <h1>Recent discussions</h1>
              <p>Latest conversations across Loombus.</p>
            </div>
            <Link href="/discussions">View all</Link>
          </div>

          <div className="home-compact-feed">
            {discussions.map((discussion, index) => (
              <article key={discussion.id} className="home-compact-card">
                <div className="home-compact-card-author">
                  <ProfileAvatar profile={discussion.author} size="md" />
                  <div className="min-w-0">
                    <div className="home-compact-author-line">
                      <strong>{discussion.author?.full_name || discussion.author?.username || "Loombus member"}</strong>
                      <span>·</span>
                      <span>{relativeTime(discussion.created_at)}</span>
                    </div>
                    <span className="home-compact-topic">{discussion.topic || "Discussion"}</span>
                  </div>
                </div>

                <Link href={`/discussions/${discussion.id}`} className="home-compact-card-body">
                  <h2>{discussion.title}</h2>
                  {index === 0 ? (
                    <div className="home-v2-featured-art home-compact-featured-art" aria-label="Featured discussion media">
                      <Sparkles className="h-8 w-8" />
                    </div>
                  ) : null}
                </Link>

                <div className="home-compact-card-footer">
                  <div className="home-compact-stats">
                    <span><MessageSquareReply className="h-4 w-4" />{discussion.replyCount}</span>
                    <span><Eye className="h-4 w-4" />{discussion.viewCount}</span>
                    <span><Bookmark className="h-4 w-4" />{discussion.savedCount}</span>
                  </div>
                  <div className="home-compact-card-actions">
                    <button
                      type="button"
                      onClick={() => void saveDiscussion(discussion)}
                      disabled={discussion.saved || savingId === discussion.id}
                      className="home-compact-save"
                    >
                      <Bookmark className="h-4 w-4" />
                      {discussion.saved ? "Saved" : savingId === discussion.id ? "Saving..." : "Save"}
                    </button>
                    <Link href={`/discussions/${discussion.id}`} className="home-compact-open">Open</Link>
                  </div>
                </div>
              </article>
            ))}

            {discussions.length === 0 ? (
              <div className="home-compact-empty">
                <Sparkles className="h-7 w-7" />
                <strong>No discussions yet.</strong>
                <Link href="/create">Start the first conversation</Link>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="home-compact-right">
          <section className="home-compact-panel">
            <h2>Needs attention</h2>
            <div className="home-compact-panel-list">
              <AttentionRow href="/messages" label="Messages" value={counts.messages} icon={<MessageCircle className="h-4 w-4" />} />
              <AttentionRow href="/notifications" label="Notifications" value={counts.notifications} icon={<Bell className="h-4 w-4" />} />
              <AttentionRow href="/saved" label="Saved" value={counts.saved} icon={<Bookmark className="h-4 w-4" />} />
            </div>
          </section>

          <section className="home-compact-panel">
            <div className="home-compact-panel-title-row">
              <h2>Trending topics</h2>
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="home-compact-trending">
              {trendingTopics.map(([topic, count], index) => (
                <Link key={topic} href={`/discussions?topic=${encodeURIComponent(topic)}`}>
                  <span><strong>{index + 1}.</strong> {topic}</span>
                  <small>{count}</small>
                </Link>
              ))}
              {trendingTopics.length === 0 ? <p>No topic activity yet.</p> : null}
            </div>
          </section>

          <section className="home-compact-panel">
            <h2>Rooms</h2>
            <div className="home-compact-room-actions">
              <Link href="/rooms"><Users className="h-4 w-4" />Open rooms<ChevronRight className="ml-auto h-4 w-4" /></Link>
              <Link href="/rooms/create"><Plus className="h-4 w-4" />Create a room<ChevronRight className="ml-auto h-4 w-4" /></Link>
            </div>
          </section>

          <Link href="/dashboard" className="home-compact-dashboard-link">
            <LayoutDashboard className="h-5 w-5" />
            <span>
              <strong>Dashboard</strong>
              <small>Performance and account overview</small>
            </span>
            <ChevronRight className="ml-auto h-4 w-4" />
          </Link>
        </aside>
      </div>
    </main>
  );
}
