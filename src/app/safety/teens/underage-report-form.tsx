"use client";

import { FormEvent, useState } from "react";
import { Flag } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function UnderageReportForm() {
  const [username, setUsername] = useState("");
  const [details, setDetails] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setMessage("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      window.location.href = "/login?next=%2Fsafety%2Fteens";
      return;
    }

    const response = await fetch("/api/safety/underage-report", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reportedUsername: username, details }),
    });
    const payload = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? payload.alreadyReported
          ? "This account is already waiting for Teen Safety review."
          : "Report submitted for confidential Teen Safety review."
        : payload.error ?? "Unable to submit this report.",
    );
    if (response.ok) {
      setUsername("");
      setDetails("");
    }
    setWorking(false);
  }

  return (
    <section className="teen-safety-section teen-safety-report">
      <div className="teen-safety-report-heading">
        <Flag aria-hidden="true" />
        <div>
          <h2>Report a possible underage account</h2>
          <p>
            Submit the Loombus username and enough context for a confidential review. Do not publicly investigate the person or request identity documents from them.
          </p>
        </div>
      </div>
      <form onSubmit={submit}>
        <label>
          <span>Loombus username</span>
          <input
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="@username"
            autoComplete="off"
          />
        </label>
        <label>
          <span>Reason for concern</span>
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Describe what led you to believe the account may be below the minimum age."
          />
        </label>
        <button type="submit" disabled={working}>
          {working ? "Submitting..." : "Submit confidential report"}
        </button>
      </form>
      {message ? <p className="teen-safety-form-message" role="status">{message}</p> : null}
    </section>
  );
}
