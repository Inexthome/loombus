"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SupportRequest = {
  id: string;
  user_id: string | null;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: "new" | "reviewing" | "resolved" | "closed";
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupportTemplate = {
  key: string;
  title: string;
  category: string;
  body: string[];
};

const statuses = ["new", "reviewing", "resolved", "closed"] as const;

const statusLabels: Record<string, string> = {
  new: "New",
  reviewing: "Reviewing",
  resolved: "Resolved",
  closed: "Closed",
};

const supportResponseTemplates: SupportTemplate[] = [
  {
    key: "account-access",
    title: "Account access",
    category: "account",
    body: [
      "Hi,",
      "",
      "Thanks for contacting Loombus support. We received your account access request and are reviewing the details.",
      "",
      "For account protection, please do not send passwords, verification codes, payment card numbers, or private authentication tokens. If this is a login or password issue, use the password reset or sign-in flow first, then reply with the account email and a short description of what happened.",
      "",
      "We will review the account context and follow up if more information is needed.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "billing-premium",
    title: "Billing / Premium",
    category: "billing",
    body: [
      "Hi,",
      "",
      "Thanks for contacting Loombus support about billing or Premium access.",
      "",
      "Please include the account email, the plan involved, and whether the issue is about checkout, billing portal access, subscription status, or Extra AI Pack credits. Do not send full payment card details.",
      "",
      "We will review the billing status and follow up with the safest next step.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "safety-concern",
    title: "Safety concern",
    category: "safety",
    body: [
      "Hi,",
      "",
      "Thanks for reporting this safety concern. We take safety reports seriously and will review the context carefully.",
      "",
      "Please include any relevant discussion link, profile link, report reason, screenshots context, and a short explanation of what concerned you. Do not include sensitive private information unless it is necessary to understand the issue.",
      "",
      "If there is an immediate emergency or threat of physical harm, contact local emergency services first.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "accessibility",
    title: "Accessibility issue",
    category: "accessibility",
    body: [
      "Hi,",
      "",
      "Thanks for telling us about an accessibility issue on Loombus.",
      "",
      "Please include the page or feature where it happened, the device/browser you used, any assistive technology involved, and what made the experience difficult or blocked.",
      "",
      "We will review this and use it to improve accessibility across the platform.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "bug-report",
    title: "Bug report",
    category: "bug",
    body: [
      "Hi,",
      "",
      "Thanks for reporting this bug.",
      "",
      "Please include the page where it happened, what you expected to happen, what actually happened, and the steps to reproduce it. Device, browser, screenshots context, and error text are also helpful.",
      "",
      "We will review the issue and prioritize it based on impact.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "feedback",
    title: "Product feedback",
    category: "feedback",
    body: [
      "Hi,",
      "",
      "Thanks for sharing feedback about Loombus.",
      "",
      "We review feedback for patterns around clarity, usefulness, safety, and the signal-over-noise experience. Your note has been received and can help guide future improvements.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "legal-rights",
    title: "Legal / rights concern",
    category: "legal",
    body: [
      "Hi,",
      "",
      "Thanks for contacting Loombus about a legal or rights concern.",
      "",
      "Please include the relevant content link, the specific rights concern, your relationship to the content, and any documentation needed to understand the request. Do not include unnecessary sensitive information.",
      "",
      "We will review the submission carefully and follow up if additional information is required.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "resolved",
    title: "Resolved confirmation",
    category: "resolved",
    body: [
      "Hi,",
      "",
      "Thanks for contacting Loombus support. We reviewed this request and marked it as resolved.",
      "",
      "If the issue continues or you have new information, please submit a new support request with the updated details.",
      "",
      "Loombus Support",
    ],
  },
];

function statusClass(status: string) {
  if (status === "new") return "border-red-900 text-red-300";
  if (status === "reviewing") return "border-amber-900 text-amber-300";
  if (status === "resolved") return "border-emerald-900 text-emerald-300";
  return "border-zinc-800 text-zinc-400";
}

export default function AdminSupportPage() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workingId, setWorkingId] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadSupportRequests() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!profileData?.is_admin) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      const { data, error } = await supabase
        .from("support_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(`Unable to load support requests: ${error.message}`);
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      const loaded = (data ?? []) as SupportRequest[];
      setRequests(loaded);
      setStatusDrafts(
        loaded.reduce<Record<string, string>>((drafts, item) => {
          drafts[item.id] = item.status;
          return drafts;
        }, {})
      );
      setNoteDrafts(
        loaded.reduce<Record<string, string>>((drafts, item) => {
          drafts[item.id] = item.admin_note ?? "";
          return drafts;
        }, {})
      );

      setAuthChecked(true);
      setLoading(false);
    }

    loadSupportRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  const counts = useMemo(() => {
    return requests.reduce<Record<string, number>>(
      (result, request) => {
        result.all += 1;
        result[request.status] = (result[request.status] ?? 0) + 1;
        return result;
      },
      { all: 0, new: 0, reviewing: 0, resolved: 0, closed: 0 }
    );
  }, [requests]);

  async function copyTemplate(template: SupportTemplate) {
    const templateBody = template.body.join("\n");

    try {
      await navigator.clipboard.writeText(templateBody);
      setMessage(`${template.title} template copied to clipboard.`);
    } catch {
      setMessage("Unable to copy template. Select the text and copy it manually.");
    }
  }

  async function updateRequest(requestId: string) {
    if (workingId) return;

    setWorkingId(requestId);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    const nextStatus = statusDrafts[requestId] ?? "new";
    const nextAdminNote = noteDrafts[requestId] ?? "";

    try {
      const response = await fetch("/api/admin/support/requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          requestId,
          status: nextStatus,
          adminNote: nextAdminNote,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update support request.");
        setWorkingId("");
        return;
      }

      setRequests((current) =>
        current.map((request) =>
          request.id === requestId ? (result.request as SupportRequest) : request
        )
      );
      setMessage("Support request updated.");
    } catch {
      setMessage("Unable to update support request.");
    } finally {
      setWorkingId("");
    }
  }

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-500">
          Loading support requests...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/admin" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
            ← Back to admin
          </Link>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Admin only
            </p>

            <h1 className="mb-4 text-4xl font-semibold tracking-tight">
              Access denied.
            </h1>

            <p className="leading-relaxed text-zinc-400">
              Support request review is available only to Admin accounts.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
          ← Back to admin
        </Link>

        <div className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Administration
          </p>

          <h1 className="mb-5 text-5xl font-semibold tracking-tight">
            Support requests.
          </h1>

          <p className="max-w-3xl leading-relaxed text-zinc-400">
            Review structured contact form submissions for support, account,
            billing, safety, accessibility, bug, feedback, and legal requests.
          </p>
        </div>

        {message && (
          <p className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </p>
        )}

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-5">
            <p className="mb-2 text-sm uppercase tracking-wide text-zinc-600">
              Admin templates
            </p>
            <h2 className="text-2xl font-medium">Response templates</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
              Copy a safe starter reply for common support categories. These templates do not send email automatically.
              Reply manually from the appropriate support inbox or email account.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {supportResponseTemplates.map((template) => (
              <article
                key={template.key}
                className="rounded-2xl border border-zinc-900 bg-black p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-white">{template.title}</p>
                    <p className="text-xs uppercase tracking-wide text-zinc-700">
                      {template.category}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyTemplate(template)}
                    className="rounded-full border border-zinc-800 px-4 py-2 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                  >
                    Copy template
                  </button>
                </div>

                <p className="whitespace-pre-wrap rounded-xl border border-zinc-900 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-500">
                  {template.body.join("\n")}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          {(["all", ...statuses] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={
                statusFilter === status
                  ? "rounded-2xl border border-white bg-white p-4 text-left text-black"
                  : "rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left text-zinc-400 transition hover:border-zinc-600 hover:text-white"
              }
            >
              <p className="text-xs uppercase tracking-wide">
                {status === "all" ? "All" : statusLabels[status]}
              </p>
              <p className="mt-2 text-2xl font-semibold">{counts[status] ?? 0}</p>
            </button>
          ))}
        </section>

        <section className="space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
              <h2 className="mb-3 text-2xl font-medium">No support requests found.</h2>
              <p className="text-zinc-500">
                No requests match the current status filter.
              </p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <article
                key={request.id}
                className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs ${statusClass(request.status)}`}>
                        {statusLabels[request.status] ?? request.status}
                      </span>
                      <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">
                        {request.category}
                      </span>
                    </div>

                    <h2 className="text-2xl font-medium">{request.subject}</h2>
                    <p className="mt-2 text-sm text-zinc-500">
                      {request.email} · {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <p className="whitespace-pre-wrap rounded-2xl border border-zinc-900 bg-black p-4 text-sm leading-relaxed text-zinc-300">
                  {request.message}
                </p>

                <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr_auto]">
                  <label>
                    <span className="mb-2 block text-sm text-zinc-500">Status</span>
                    <select
                      value={statusDrafts[request.id] ?? request.status}
                      onChange={(event) =>
                        setStatusDrafts((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="mb-2 block text-sm text-zinc-500">Admin note</span>
                    <textarea
                      value={noteDrafts[request.id] ?? ""}
                      onChange={(event) =>
                        setNoteDrafts((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      className="min-h-24 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                      placeholder="Optional internal note."
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => updateRequest(request.id)}
                      disabled={workingId === request.id}
                      className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {workingId === request.id ? "Updating..." : "Update"}
                    </button>
                  </div>
                </div>

                {request.reviewed_at && (
                  <p className="mt-4 text-xs text-zinc-600">
                    Last reviewed {new Date(request.reviewed_at).toLocaleString()}
                  </p>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
