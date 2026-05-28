"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const supportEmail = "support@loombus.com";

const categories = [
  { value: "general", label: "General support" },
  { value: "account", label: "Account access" },
  { value: "billing", label: "Billing or Premium" },
  { value: "safety", label: "Safety concern" },
  { value: "accessibility", label: "Accessibility issue" },
  { value: "bug", label: "Bug report" },
  { value: "feedback", label: "Platform feedback" },
  { value: "legal", label: "Legal / rights concern" },
];

export default function ContactPage() {
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadUserEmail() {
      const { data } = await supabase.auth.getUser();

      if (data.user?.email) {
        setEmail(data.user.email);
      }
    }

    loadUserEmail();
  }, []);

  async function submitSupportRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    setSubmitting(true);
    setStatusMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          email,
          category,
          subject,
          message: messageBody,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatusMessage(result.error ?? "Unable to submit support request.");
        setSubmitting(false);
        return;
      }

      setSubject("");
      setMessageBody("");
      setCategory("general");
      setStatusMessage("Support request submitted. Loombus support can review it from the admin queue.");
    } catch {
      setStatusMessage("Unable to submit support request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <section className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Contact
          </p>

          <h1 className="mb-5 text-5xl font-semibold tracking-tight">
            Contact Loombus.
          </h1>

          <p className="max-w-3xl leading-relaxed text-zinc-400">
            Send account questions, safety concerns, accessibility issues,
            billing questions, bug reports, or platform feedback through the
            structured support form below.
          </p>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-5 text-2xl font-medium">Support request</h2>

            <form onSubmit={submitSupportRequest} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm text-zinc-400">Email</span>
                <input
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-zinc-400">Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none transition focus:border-zinc-600"
                >
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-zinc-400">Subject</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                  placeholder="Briefly describe the issue"
                  minLength={3}
                  maxLength={160}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-zinc-400">Message</span>
                <textarea
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  className="min-h-40 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                  placeholder="Include relevant links, usernames, screenshots context, account email, or steps to reproduce."
                  minLength={10}
                  maxLength={4000}
                  required
                />
              </label>

              {statusMessage && (
                <p className="rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-400">
                  {statusMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit support request"}
              </button>
            </form>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
              <h2 className="mb-3 text-xl font-medium">Direct email</h2>

              <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                You can still email Loombus directly. Use the form for a more
                structured request that can be tracked in admin review.
              </p>

              <a
                href={`mailto:${supportEmail}`}
                className="text-sm text-zinc-300 underline underline-offset-4 hover:text-white"
              >
                {supportEmail}
              </a>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
              <h2 className="mb-3 text-xl font-medium">Legal resources</h2>

              <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                For copyright, refund, privacy, or platform rule questions,
                review the relevant policy before submitting a request.
              </p>

              <div className="flex flex-col gap-2 text-sm">
                <Link href="/dmca" className="text-zinc-300 underline underline-offset-4 hover:text-white">
                  Copyright and DMCA Process
                </Link>
                <Link href="/refunds" className="text-zinc-300 underline underline-offset-4 hover:text-white">
                  Refund Policy
                </Link>
                <Link href="/terms" className="text-zinc-300 underline underline-offset-4 hover:text-white">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="text-zinc-300 underline underline-offset-4 hover:text-white">
                  Privacy Policy
                </Link>
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
              <h2 className="mb-3 text-xl font-medium">For safety concerns</h2>

              <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                Report content through the in-app report tools when possible.
                Use this form for account, safety, or accessibility context that
                needs more explanation.
              </p>

              <Link href="/safety" className="text-sm text-zinc-300 underline underline-offset-4 hover:text-white">
                Review Safety
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
