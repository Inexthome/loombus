"use client";

import { useEffect, useMemo, useState } from "react";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { supabase } from "@/lib/supabase/client";

export function TopicAlertsControl({
  canUseTopicAlerts,
}: {
  canUseTopicAlerts: boolean;
}) {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedTopicSet = useMemo(
    () => new Set(selectedTopics),
    [selectedTopics]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAlerts() {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/topic-alerts", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (cancelled) {
        return;
      }

      if (response.ok) {
        setSelectedTopics(
          Array.isArray(result.selectedTopics) ? result.selectedTopics : []
        );
      }

      setLoading(false);
    }

    loadAlerts();

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleTopic(topic: string) {
    if (!canUseTopicAlerts) {
      return;
    }

    setSelectedTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic]
    );
  }

  async function saveTopicAlerts() {
    if (!canUseTopicAlerts || saving) {
      return;
    }

    setSaving(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/topic-alerts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topics: selectedTopics,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to save topic alerts.");
        setSaving(false);
        return;
      }

      setSelectedTopics(
        Array.isArray(result.selectedTopics) ? result.selectedTopics : []
      );
      setMessage("Topic alerts updated.");
    } catch {
      setMessage("Unable to save topic alerts.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-900 bg-zinc-950 p-6">
      <div className="mb-5">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-600">
          Premium alerts
        </p>

        <h2 className="text-xl font-semibold text-white">Topic alerts</h2>

        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Choose topic lanes you want to track. Loombus will send an in-app
          notification when a new discussion is published in those topics.
        </p>
      </div>

      {!canUseTopicAlerts && (
        <div className="mb-5 rounded-2xl border border-zinc-900 bg-black p-4 text-sm leading-relaxed text-zinc-500">
          Topic alerts require Premium access. Free accounts can still
          browse topics and use normal in-app notifications.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {DISCUSSION_TOPICS.map((topic) => {
          const selected = selectedTopicSet.has(topic);

          return (
            <button
              key={topic}
              type="button"
              onClick={() => toggleTopic(topic)}
              disabled={!canUseTopicAlerts || loading}
              className={
                selected
                  ? "rounded-full border border-white bg-white px-4 py-2 text-sm text-black disabled:cursor-not-allowed"
                  : "rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
              }
            >
              {topic}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={saveTopicAlerts}
          disabled={!canUseTopicAlerts || loading || saving}
          className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {saving ? "Saving alerts..." : "Save topic alerts"}
        </button>

        <span className="text-sm text-zinc-600">
          {selectedTopics.length} selected
        </span>
      </div>

      {message && (
        <p className="mt-3 text-sm text-zinc-500">
          {message}
        </p>
      )}
    </section>
  );
}
