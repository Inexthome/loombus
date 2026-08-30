"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const SUPPORT_EMAIL = "support@loombus.com";

type SupportCategoryValue =
  | "general"
  | "account"
  | "billing"
  | "safety"
  | "accessibility"
  | "bug"
  | "feedback"
  | "legal";

type SubmissionState = {
  tone: "success" | "error";
  message: string;
} | null;

const supportCategoryOptions: Array<{
  value: SupportCategoryValue;
  label: string;
}> = [
  { value: "general", label: "General support" },
  { value: "account", label: "Account access" },
  { value: "billing", label: "Billing or Premium" },
  { value: "safety", label: "Safety concern" },
  { value: "accessibility", label: "Accessibility issue" },
  { value: "bug", label: "Bug report" },
  { value: "feedback", label: "Platform feedback" },
  { value: "legal", label: "Legal / rights concern" },
];

const supportCategoryValues = new Set<SupportCategoryValue>(
  supportCategoryOptions.map((option) => option.value),
);

export default function SupportV2Client() {
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<SupportCategoryValue>("general");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accountContextLoading, setAccountContextLoading] = useState(true);
  const [signedInEmail, setSignedInEmail] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAccountContext() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const nextEmail = data.user?.email ?? "";
      setSignedInEmail(nextEmail);
      if (nextEmail) setEmail(nextEmail);
      setAccountContextLoading(false);
    }

    void loadAccountContext();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user?: { email?: string } } | null) => {
        const nextEmail = session?.user?.email ?? "";
        setSignedInEmail(nextEmail);
        if (nextEmail) setEmail(nextEmail);
        setAccountContextLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedCategory = params.get("category") as SupportCategoryValue | null;

    if (requestedCategory && supportCategoryValues.has(requestedCategory)) {
      setCategory(requestedCategory);
    }

    if (window.location.hash === "#support-request-title") {
      window.setTimeout(() => subjectRef.current?.focus(), 350);
    }
  }, []);

  async function submitSupportRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setSubmissionState(null);

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
        setSubmissionState({
          tone: "error",
          message: result.error ?? "Unable to submit the support request.",
        });
        return;
      }

      setSubject("");
      setMessageBody("");
      setSubmissionState({
        tone: "success",
        message:
          "Support request submitted. It is now available in the Loombus support queue for review.",
      });
    } catch {
      setSubmissionState({
        tone: "error",
        message:
          "Unable to submit the support request. Check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="support-v2-page">
      <div className="support-v2-shell">
        <section
          className="support-v2-contact-layout"
          aria-labelledby="support-request-title"
        >
          <div className="support-v2-form-card">
            <p className="support-v2-section-kicker">Contact support</p>
            <h2 id="support-request-title">Contact Loombus Support</h2>
            <p className="support-v2-form-intro">
              Tell us what went wrong or what you need help with. Choose the closest
              category so the request reaches the right support workflow.
            </p>

            <p className="support-v2-account-note">
              <CheckCircle2 aria-hidden="true" />
              {accountContextLoading
                ? "Checking whether a signed-in account can be attached."
                : signedInEmail
                  ? `Signed-in account email prefilled: ${signedInEmail}`
                  : "You can submit without signing in. Enter the email where support should follow up."}
            </p>

            <form className="support-v2-form" onSubmit={submitSupportRequest}>
              <div className="support-v2-form-grid">
                <label className="support-v2-field">
                  <span className="support-v2-form-label">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <label className="support-v2-field">
                  <span className="support-v2-form-label">Category</span>
                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value as SupportCategoryValue)
                    }
                  >
                    {supportCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="support-v2-field">
                <span className="support-v2-form-label">Subject</span>
                <input
                  ref={subjectRef}
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  minLength={3}
                  maxLength={160}
                  placeholder="Briefly describe what you need help with"
                  required
                />
              </label>

              <label className="support-v2-field">
                <span className="support-v2-form-label">Message</span>
                <textarea
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  minLength={10}
                  maxLength={4000}
                  placeholder="Include the exact page, what you expected, what happened, and useful device or account context. Never include passwords, verification codes, authentication tokens, or full payment details."
                  required
                />
                <span>{messageBody.length}/4000 characters</span>
              </label>

              {submissionState && (
                <p
                  className={`support-v2-status is-${submissionState.tone}`}
                  role={submissionState.tone === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {submissionState.message}
                </p>
              )}

              <div className="support-v2-form-footer">
                <button
                  type="submit"
                  className="support-v2-submit"
                  disabled={submitting}
                >
                  <Mail aria-hidden="true" />
                  {submitting ? "Submitting..." : "Submit support request"}
                </button>
                <span className="support-v2-direct-email">
                  Direct email:{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                </span>
              </div>
            </form>
          </div>

          <aside className="support-v2-aside-stack" aria-label="Support guidance">
            <section className="support-v2-aside-card">
              <span className="support-v2-aside-icon">
                <FileText aria-hidden="true" />
              </span>
              <h3>Before submitting</h3>
              <ul>
                <li>Use the in-product report control for specific content when available.</li>
                <li>For technical problems, include the page, device or browser, and steps to reproduce.</li>
                <li>Never send passwords, verification codes, card numbers, authentication tokens, or illegal material.</li>
              </ul>
            </section>

            <section className="support-v2-aside-card">
              <span className="support-v2-aside-icon">
                <ShieldCheck aria-hidden="true" />
              </span>
              <h3>Safety</h3>
              <p>
                For immediate physical danger, contact local emergency services.
                Loombus reports and support requests are not emergency channels.
              </p>
              <div className="support-v2-aside-links">
                <Link href="/safety">
                  Safety <ChevronRight aria-hidden="true" />
                </Link>
                <Link href="/privacy">
                  Privacy <ChevronRight aria-hidden="true" />
                </Link>
                <Link href="/guidelines">
                  Guidelines <ChevronRight aria-hidden="true" />
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
