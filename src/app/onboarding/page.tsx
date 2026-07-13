"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Check,
  Compass,
  DoorOpen,
  Lightbulb,
  MessageCircle,
  PencilLine,
  Sparkles,
  StickyNote,
  UserRound,
  Users,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { supabase } from "@/lib/supabase/client";

const ONBOARDING_TOPIC_KEY = "loombus:onboarding-topic";

type Profile = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type StepStatus = "complete" | "active" | "next" | "explore";

function isFilled(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function getFirstName(profile: Profile | null) {
  const source = profile?.full_name?.trim() || profile?.username?.trim();
  if (!source) return "there";
  return source.split(/\s+/)[0];
}

function StepBadge({ status }: { status: StepStatus }) {
  const label =
    status === "complete"
      ? "Complete"
      : status === "active"
        ? "Recommended"
        : status === "explore"
          ? "Explore"
          : "Next";

  return (
    <span className={`onboarding-v2-step-badge is-${status}`}>
      {status === "complete" ? <Check aria-hidden="true" size={13} /> : null}
      {label}
    </span>
  );
}

function JourneyStep({
  number,
  icon,
  title,
  description,
  href,
  action,
  status,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  action: string;
  status: StepStatus;
}) {
  return (
    <article className={`onboarding-v2-step-card is-${status}`}>
      <div className="onboarding-v2-step-topline">
        <span className="onboarding-v2-step-icon">{icon}</span>
        <span className="onboarding-v2-step-number">{number}</span>
        <StepBadge status={status} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link href={href} className="onboarding-v2-text-link">
        {action}
        <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </article>
  );
}

function ProductCard({
  icon,
  title,
  description,
  href,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="onboarding-v2-product-card">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
      <span className="onboarding-v2-product-action">
        Open
        <ArrowRight aria-hidden="true" size={15} />
      </span>
    </Link>
  );
}

export default function OnboardingPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [discussionCount, setDiscussionCount] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const savedTopic = window.localStorage.getItem(ONBOARDING_TOPIC_KEY);
    if (savedTopic && DISCUSSION_TOPICS.some((topic) => topic === savedTopic)) {
      setSelectedTopic(savedTopic);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadOnboardingState() {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        if (mounted) {
          setLoadError("We could not verify your account. Refresh the page and try again.");
          setLoading(false);
        }
        return;
      }

      if (!userData.user) {
        window.location.replace("/login");
        return;
      }

      const [profileResult, discussionResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, username, bio, avatar_url")
          .eq("id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("discussions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userData.user.id)
          .is("deleted_at", null),
      ]);

      if (!mounted) return;

      if (profileResult.error || discussionResult.error) {
        setLoadError("Some setup progress could not be loaded. Your account data was not changed.");
      }

      setProfile((profileResult.data as Profile | null) ?? null);
      setDiscussionCount(discussionResult.count ?? 0);
      setLoading(false);
    }

    loadOnboardingState();

    return () => {
      mounted = false;
    };
  }, []);

  const completedFields = useMemo(
    () =>
      [
        isFilled(profile?.full_name),
        isFilled(profile?.username),
        isFilled(profile?.bio),
        isFilled(profile?.avatar_url),
      ].filter(Boolean).length,
    [profile]
  );

  const profileComplete = completedFields >= 3 && isFilled(profile?.username);
  const topicChosen = Boolean(selectedTopic);
  const hasStartedDiscussion = discussionCount > 0;
  const completedCheckpoints = [profileComplete, topicChosen, hasStartedDiscussion].filter(Boolean).length;
  const progressPercent = Math.round((completedCheckpoints / 3) * 100);
  const suggestedTopics = DISCUSSION_TOPICS.slice(0, 12);

  const nextAction = !profileComplete
    ? { href: "/profile", label: "Complete your profile" }
    : !topicChosen
      ? { href: "#topic-lanes", label: "Choose a topic lane" }
      : !hasStartedDiscussion
        ? { href: "/create", label: "Start your first discussion" }
        : { href: "/discussions", label: "Continue to discussions" };

  function chooseTopic(topic: string) {
    setSelectedTopic(topic);
    window.localStorage.setItem(ONBOARDING_TOPIC_KEY, topic);
  }

  return (
    <main className="onboarding-v2-page" data-loombus-onboarding>
      <div className="onboarding-v2-shell">
        <section className="onboarding-v2-hero">
          <div className="onboarding-v2-hero-copy">
            <p className="onboarding-v2-eyebrow">Member onboarding</p>
            <h1>Welcome, {getFirstName(profile)}. Build a signal worth following.</h1>
            <p className="onboarding-v2-hero-description">
              Loombus works best when your identity is clear, your topic has direction, and your first
              contribution gives people something meaningful to respond to.
            </p>
            <div className="onboarding-v2-hero-actions">
              <Link href={nextAction.href} className="onboarding-v2-button onboarding-v2-button-primary">
                {nextAction.label}
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <Link href="/discussions" className="onboarding-v2-button onboarding-v2-button-quiet">
                Skip for now
              </Link>
            </div>
          </div>

          <aside className="onboarding-v2-progress-card" aria-label="Onboarding progress">
            <div className="onboarding-v2-progress-heading">
              <div>
                <p>Activation progress</p>
                <strong>{loading ? "—" : `${progressPercent}%`}</strong>
              </div>
              <span>{loading ? "Loading" : `${completedCheckpoints} of 3 checkpoints`}</span>
            </div>
            <div className="onboarding-v2-progress-track" aria-hidden="true">
              <span style={{ width: loading ? "0%" : `${progressPercent}%` }} />
            </div>
            <div className="onboarding-v2-profile-snapshot">
              <ProfileAvatar
                profile={{
                  avatar_url: profile?.avatar_url ?? null,
                  full_name: profile?.full_name ?? null,
                  username: profile?.username ?? null,
                }}
                size="lg"
              />
              <div>
                <strong>{profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member"}</strong>
                <span>{profile?.username ? `@${profile.username}` : "Username not set"}</span>
              </div>
            </div>
            <dl className="onboarding-v2-progress-facts">
              <div>
                <dt>Profile fields</dt>
                <dd>{loading ? "—" : `${completedFields}/4`}</dd>
              </div>
              <div>
                <dt>Topic lane</dt>
                <dd>{selectedTopic || "Not chosen"}</dd>
              </div>
              <div>
                <dt>Discussions</dt>
                <dd>{loading ? "—" : discussionCount}</dd>
              </div>
            </dl>
          </aside>
        </section>

        {loadError ? <p className="onboarding-v2-notice">{loadError}</p> : null}

        <section className="onboarding-v2-section" aria-labelledby="journey-heading">
          <div className="onboarding-v2-section-heading">
            <div>
              <p className="onboarding-v2-eyebrow">Your starting path</p>
              <h2 id="journey-heading">Set up the parts that make conversation useful.</h2>
            </div>
            <p>
              Only profile completion, your chosen starting topic, and an actual discussion count toward
              the progress bar.
            </p>
          </div>

          <div className="onboarding-v2-step-grid">
            <JourneyStep
              number="01"
              icon={<UserRound aria-hidden="true" size={20} />}
              title="Complete your public profile"
              description="A recognizable name, username, image, and concise bio give readers context before they evaluate your ideas."
              href="/profile"
              action={profileComplete ? "Review profile" : "Complete profile"}
              status={profileComplete ? "complete" : "active"}
            />
            <JourneyStep
              number="02"
              icon={<Compass aria-hidden="true" size={20} />}
              title="Choose a starting topic"
              description="Select one area you want to explore first. It guides this onboarding session without locking your feed or future posts."
              href="#topic-lanes"
              action={topicChosen ? `Review ${selectedTopic}` : "Choose a topic"}
              status={topicChosen ? "complete" : profileComplete ? "active" : "next"}
            />
            <JourneyStep
              number="03"
              icon={<PencilLine aria-hidden="true" size={20} />}
              title="Start your first discussion"
              description="Frame a question, observation, or problem clearly enough that another member can add evidence, experience, or a serious counterpoint."
              href="/create"
              action={hasStartedDiscussion ? "Start another discussion" : "Create first discussion"}
              status={hasStartedDiscussion ? "complete" : profileComplete && topicChosen ? "active" : "next"}
            />
            <JourneyStep
              number="04"
              icon={<Users aria-hidden="true" size={20} />}
              title="Find people through substance"
              description="Browse contributors and active discussions, then follow people because of what they add to the conversation."
              href="/people"
              action="Browse people"
              status="explore"
            />
          </div>
        </section>

        <section className="onboarding-v2-topic-section" id="topic-lanes" aria-labelledby="topic-heading">
          <div className="onboarding-v2-topic-copy">
            <p className="onboarding-v2-eyebrow">Topic lanes</p>
            <h2 id="topic-heading">Where do you want to begin?</h2>
            <p>
              Pick one starting lane. This selection is saved on this device for onboarding only and does
              not change your account, recommendations, or posting permissions.
            </p>
            {selectedTopic ? (
              <div className="onboarding-v2-selected-topic">
                <Check aria-hidden="true" size={16} />
                <span>
                  Starting with <strong>{selectedTopic}</strong>
                </span>
              </div>
            ) : null}
          </div>

          <div className="onboarding-v2-topic-panel">
            <div className="onboarding-v2-topic-grid">
              {suggestedTopics.map((topic) => {
                const selected = topic === selectedTopic;
                return (
                  <button
                    key={topic}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseTopic(topic)}
                  >
                    {selected ? <Check aria-hidden="true" size={14} /> : null}
                    {topic}
                  </button>
                );
              })}
            </div>
            <div className="onboarding-v2-topic-actions">
              <Link
                href={selectedTopic ? `/discussions?topic=${encodeURIComponent(selectedTopic)}` : "/discussions"}
                className="onboarding-v2-button onboarding-v2-button-primary"
              >
                Explore this topic
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <Link href="/create" className="onboarding-v2-button onboarding-v2-button-quiet">
                Create a discussion
              </Link>
            </div>
          </div>
        </section>

        <section className="onboarding-v2-lens-section" aria-labelledby="lens-heading">
          <div className="onboarding-v2-lens-icon">
            <Sparkles aria-hidden="true" size={23} />
          </div>
          <div className="onboarding-v2-lens-copy">
            <p className="onboarding-v2-eyebrow">Reality Lenses</p>
            <h2 id="lens-heading">Add human context when the same issue is not experienced the same way.</h2>
            <p>
              A topic says what the discussion is about. A Reality Lens signals that identity, location,
              profession, age, community, or lived experience may materially affect how the issue is
              understood. Use one when that context improves the conversation; leave it off when it does not.
            </p>
          </div>
          <div className="onboarding-v2-lens-principles">
            <div>
              <strong>Use context</strong>
              <span>when it changes the meaning of the question.</span>
            </div>
            <div>
              <strong>Avoid assumptions</strong>
              <span>about what another person must believe or experience.</span>
            </div>
            <div>
              <strong>Invite perspective</strong>
              <span>without treating lived experience as the only form of evidence.</span>
            </div>
          </div>
        </section>

        <section className="onboarding-v2-section" aria-labelledby="tools-heading">
          <div className="onboarding-v2-section-heading">
            <div>
              <p className="onboarding-v2-eyebrow">After the first post</p>
              <h2 id="tools-heading">Know where useful conversations go next.</h2>
            </div>
            <p>These are destinations you open intentionally. None of them appear as floating instruction overlays.</p>
          </div>
          <div className="onboarding-v2-product-grid">
            <ProductCard
              icon={<Bookmark aria-hidden="true" size={20} />}
              title="Saved"
              description="Keep discussions you want to return to and organize them into folders."
              href="/saved"
            />
            <ProductCard
              icon={<StickyNote aria-hidden="true" size={20} />}
              title="Stickies"
              description="Hold the most actionable ideas and reminders closer to your working context."
              href="/stickies"
            />
            <ProductCard
              icon={<DoorOpen aria-hidden="true" size={20} />}
              title="Rooms"
              description="Enter focused public or private spaces built around a group, place, or shared purpose."
              href="/rooms"
            />
            <ProductCard
              icon={<MessageCircle aria-hidden="true" size={20} />}
              title="Messages"
              description="Continue privately when mutual followers need a direct conversation."
              href="/messages"
            />
          </div>
        </section>

        <section className="onboarding-v2-first-post" aria-labelledby="first-post-heading">
          <div className="onboarding-v2-first-post-heading">
            <span><Lightbulb aria-hidden="true" size={22} /></span>
            <div>
              <p className="onboarding-v2-eyebrow">First discussion guidance</p>
              <h2 id="first-post-heading">Specific questions create better replies.</h2>
            </div>
          </div>
          <div className="onboarding-v2-guidance-grid">
            <div>
              <span>01</span>
              <strong>Frame the problem</strong>
              <p>Explain what you are trying to understand, not only what you already believe.</p>
            </div>
            <div>
              <span>02</span>
              <strong>Add enough context</strong>
              <p>Give readers the facts, constraints, and background needed to respond with substance.</p>
            </div>
            <div>
              <span>03</span>
              <strong>Ask for depth</strong>
              <p>Invite evidence, tradeoffs, lived experience, practical solutions, or serious counterpoints.</p>
            </div>
          </div>
          <div className="onboarding-v2-first-post-actions">
            <Link href="/create" className="onboarding-v2-button onboarding-v2-button-cream">
              Start a discussion
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link href="/discussions" className="onboarding-v2-button onboarding-v2-button-dark-quiet">
              Browse before posting
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
