"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileCheck2,
  Headphones,
  Loader2,
  LockKeyhole,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Props = {
  initialOrganization: string;
  initialUseCase: string;
  initialModel: string;
  roomId: string;
  currentPlan: string;
};

type SubmissionState =
  | { tone: "success" | "error"; message: string }
  | null;

export default function RoomEnterpriseClient({
  initialOrganization,
  initialUseCase,
  initialModel,
  roomId,
  currentPlan,
}: Props) {
  const [organization, setOrganization] = useState(initialOrganization);
  const [email, setEmail] = useState("");
  const [estimatedRooms, setEstimatedRooms] = useState("11-25");
  const [membersPerRoom, setMembersPerRoom] = useState("2000+");
  const [useCase, setUseCase] = useState(initialUseCase);
  const [requirements, setRequirements] = useState("");
  const [timeline, setTimeline] = useState("Exploring");
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [compliance, setCompliance] = useState(false);
  const [integrations, setIntegrations] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<SubmissionState>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user?.email) setEmail(data.user.email);
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmission(null);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const context = [
      `Organization: ${organization.trim()}`,
      `Estimated Rooms: ${estimatedRooms}`,
      `Estimated members per Room: ${membersPerRoom}`,
      `Room model or use case: ${initialModel || "Not specified"}`,
      `Current Room plan: ${currentPlan || "Not specified"}`,
      `Existing Room id: ${roomId || "None"}`,
      `Timeline: ${timeline}`,
      `White-label interest: ${whiteLabel ? "Yes" : "No"}`,
      `Compliance or data requirements: ${compliance ? "Yes" : "No"}`,
      `Integrations or migration support: ${integrations ? "Yes" : "No"}`,
      "",
      "Use case:",
      useCase.trim(),
      "",
      "Requirements and notes:",
      requirements.trim() || "No additional notes provided.",
    ].join("\n");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email,
          category: "billing",
          subject: `Organization Enterprise inquiry: ${organization.trim()}`,
          message: context.slice(0, 4000),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmission({
          tone: "error",
          message: result.error ?? "The Enterprise inquiry could not be submitted.",
        });
        return;
      }
      setSubmission({
        tone: "success",
        message:
          "Enterprise inquiry submitted. The request is now in the Loombus support queue for review.",
      });
    } catch {
      setSubmission({
        tone: "error",
        message: "The Enterprise inquiry could not be submitted. Check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="rooms-v2-page rooms-enterprise-page">
      <div className="rooms-v2-shell rooms-enterprise-shell">
        <div className="rooms-v2-builder-topbar">
          <Link href="/rooms/new" className="rooms-v2-back-button">
            <ArrowLeft aria-hidden="true" size={16} /> Back to Room plans
          </Link>
          <span className="rooms-enterprise-private-badge">
            <LockKeyhole aria-hidden="true" size={15} /> Private sales inquiry
          </span>
        </div>

        <header className="rooms-v2-builder-hero rooms-enterprise-hero">
          <div>
            <p className="rooms-v2-eyebrow">Organization Enterprise</p>
            <h1>Design the Room structure around the organization.</h1>
            <p>
              Enterprise removes the self-service ceiling. Define the Room count,
              membership capacity, controls, integrations, onboarding, and support
              model through a custom agreement.
            </p>
          </div>
          <span className="rooms-v2-draft-badge">
            <ShieldCheck aria-hidden="true" size={15} /> Custom agreement
          </span>
        </header>

        <section className="rooms-enterprise-value-grid" aria-label="Enterprise capabilities">
          <article>
            <Building2 aria-hidden="true" />
            <h2>Custom Room structure</h2>
            <p>Set the number of Rooms, capacity per Room, ownership model, and shared administration.</p>
          </article>
          <article>
            <FileCheck2 aria-hidden="true" />
            <h2>Governance and requirements</h2>
            <p>Plan for domain controls, retention, data handling, white-label needs, and integrations.</p>
          </article>
          <article>
            <Headphones aria-hidden="true" />
            <h2>Onboarding and support</h2>
            <p>Coordinate migration, launch sequencing, training, and an appropriate support agreement.</p>
          </article>
        </section>

        <div className="rooms-enterprise-grid">
          <form className="rooms-enterprise-form" onSubmit={submit}>
            <div className="rooms-enterprise-section-heading">
              <p className="rooms-v2-eyebrow">Contact Enterprise sales</p>
              <h2>Describe the organization and expected scale.</h2>
              <p>No Room or Stripe subscription is created by this form.</p>
            </div>

            <div className="rooms-enterprise-fields">
              <label>
                <span>Organization name</span>
                <input
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  minLength={2}
                  maxLength={140}
                  required
                />
              </label>
              <label>
                <span>Contact email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={320}
                  required
                />
              </label>
              <label>
                <span>Estimated Rooms</span>
                <select value={estimatedRooms} onChange={(event) => setEstimatedRooms(event.target.value)}>
                  <option value="1-10">1 to 10</option>
                  <option value="11-25">11 to 25</option>
                  <option value="26-100">26 to 100</option>
                  <option value="100+">More than 100</option>
                  <option value="Custom">Not determined yet</option>
                </select>
              </label>
              <label>
                <span>Members per Room</span>
                <select value={membersPerRoom} onChange={(event) => setMembersPerRoom(event.target.value)}>
                  <option value="Under 500">Under 500</option>
                  <option value="500-2000">500 to 2,000</option>
                  <option value="2000+">More than 2,000</option>
                  <option value="Custom">Varies by Room</option>
                </select>
              </label>
              <label className="is-wide">
                <span>Primary use case</span>
                <textarea
                  value={useCase}
                  onChange={(event) => setUseCase(event.target.value)}
                  minLength={10}
                  maxLength={1000}
                  rows={5}
                  required
                  placeholder="Explain who will use the Rooms and what the organization needs to operate."
                />
              </label>
              <label>
                <span>Expected timeline</span>
                <select value={timeline} onChange={(event) => setTimeline(event.target.value)}>
                  <option>Exploring</option>
                  <option>Within 30 days</option>
                  <option>Within 90 days</option>
                  <option>Within 6 months</option>
                  <option>Long-term planning</option>
                </select>
              </label>
              <label className="is-wide">
                <span>Requirements and notes</span>
                <textarea
                  value={requirements}
                  onChange={(event) => setRequirements(event.target.value)}
                  maxLength={1600}
                  rows={6}
                  placeholder="Include controls, migration needs, integrations, support expectations, or other requirements."
                />
              </label>
            </div>

            <fieldset className="rooms-enterprise-checks">
              <legend>Areas to review</legend>
              <label><input type="checkbox" checked={whiteLabel} onChange={(event) => setWhiteLabel(event.target.checked)} /> White-label or branded experience</label>
              <label><input type="checkbox" checked={compliance} onChange={(event) => setCompliance(event.target.checked)} /> Compliance, retention, or data requirements</label>
              <label><input type="checkbox" checked={integrations} onChange={(event) => setIntegrations(event.target.checked)} /> Integrations, migration, or custom onboarding</label>
            </fieldset>

            {submission ? (
              <p className={`rooms-enterprise-message is-${submission.tone}`} role="status">
                {submission.tone === "success" ? <CheckCircle2 aria-hidden="true" /> : null}
                {submission.message}
              </p>
            ) : null}

            <button className="rooms-v2-button rooms-v2-button-primary rooms-enterprise-submit" disabled={submitting}>
              {submitting ? <Loader2 aria-hidden="true" className="is-spinning" /> : <Send aria-hidden="true" />}
              {submitting ? "Submitting inquiry…" : "Submit Enterprise inquiry"}
            </button>
          </form>

          <aside className="rooms-enterprise-summary">
            <p className="rooms-v2-eyebrow">Enterprise boundary</p>
            <h2>Sales-assisted, not self-service checkout.</h2>
            <ul>
              <li><Users aria-hidden="true" /> Custom Rooms and member capacity</li>
              <li><ShieldCheck aria-hidden="true" /> Enterprise controls and high-capacity operations</li>
              <li><FileCheck2 aria-hidden="true" /> Defined data, retention, and integration requirements</li>
              <li><Headphones aria-hidden="true" /> Dedicated onboarding and support terms</li>
            </ul>
            <p>
              Existing Enterprise subscriptions remain active under their current Stripe agreement.
              New Enterprise access begins only after commercial terms and provisioning are approved.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
