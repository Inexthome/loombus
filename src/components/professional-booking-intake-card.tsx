"use client";

import {
  ClipboardList,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppointmentService } from "@/lib/events";
import {
  PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT,
  type ProfessionalBookingIntakeQuestion,
  type ProfessionalBookingIntakeResponse,
} from "@/lib/professional-booking-intake";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";
import { requireSubscriptionEntitlement } from "@/lib/subscription-access-prompt";

type ManagePayload = {
  services?: AppointmentService[];
};

const fieldClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)] disabled:cursor-not-allowed disabled:opacity-60";

function newQuestion(): ProfessionalBookingIntakeQuestion {
  const fallback = `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : fallback;

  return {
    id,
    label: "",
    required: false,
  };
}

export default function ProfessionalBookingIntakeCard() {
  const [services, setServices] = useState<AppointmentService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [data, setData] = useState<ProfessionalBookingIntakeResponse | null>(null);
  const [questions, setQuestions] = useState<ProfessionalBookingIntakeQuestion[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const usableServices = useMemo(
    () => services.filter((service) => service.status !== "archived"),
    [services],
  );

  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    setNotice("");

    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments?manage=1",
        { cache: "no-store" },
        "/appointments/professional-intake",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load appointment services.");
      }

      const nextServices = Array.isArray((payload as ManagePayload).services)
        ? ((payload as ManagePayload).services as AppointmentService[])
        : [];
      setServices(nextServices);
      setSelectedServiceId((current) => {
        if (current && nextServices.some((service) => service.id === current && service.status !== "archived")) {
          return current;
        }
        return nextServices.find((service) => service.status !== "archived")?.id ?? "";
      });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load appointment services.",
      );
    } finally {
      setLoadingServices(false);
    }
  }, []);

  const loadForm = useCallback(async (serviceId: string) => {
    if (!serviceId) {
      setData(null);
      setQuestions([]);
      return;
    }

    setLoadingForm(true);
    setNotice("");

    try {
      const params = new URLSearchParams({ serviceId });
      const response = await scheduleAuthorizedFetch(
        `/api/appointments/professional-intake?${params.toString()}`,
        { cache: "no-store" },
        "/appointments/professional-intake",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load the client intake form.");
      }

      const next = payload as ProfessionalBookingIntakeResponse;
      setData(next);
      setQuestions(next.questions.map((question) => ({ ...question })));
    } catch (error) {
      setData(null);
      setQuestions([]);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load the client intake form.",
      );
    } finally {
      setLoadingForm(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  useEffect(() => {
    void loadForm(selectedServiceId);
  }, [loadForm, selectedServiceId]);

  const canEdit = data?.canUseProfessionalBooking === true;

  function requestAccess() {
    if (!data) return;

    if (!data.subscriptionResolutionAvailable) {
      setNotice(
        "Loombus cannot verify Premium Pro access right now. Retry before changing client intake forms.",
      );
      return;
    }

    requireSubscriptionEntitlement({
      plan: data.subscriptionPlan,
      entitlement: "professional_booking",
      featureLabel: "Professional Booking client intake forms",
    });
  }

  function addQuestion() {
    if (!canEdit) {
      requestAccess();
      return;
    }

    if (questions.length >= PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT) {
      setNotice(
        `Professional Booking supports up to ${PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT} client intake questions per service.`,
      );
      return;
    }

    setQuestions((current) => [...current, newQuestion()]);
    setNotice("");
  }

  function updateQuestion(
    id: string,
    patch: Partial<ProfessionalBookingIntakeQuestion>,
  ) {
    if (!canEdit) {
      requestAccess();
      return;
    }

    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, ...patch } : question,
      ),
    );
  }

  function removeQuestion(id: string) {
    if (!canEdit) {
      requestAccess();
      return;
    }

    setQuestions((current) => current.filter((question) => question.id !== id));
  }

  async function save() {
    if (!data || !selectedServiceId) return;

    if (!canEdit) {
      requestAccess();
      return;
    }

    if (saving) return;

    const normalizedQuestions = questions.map((question) => ({
      ...question,
      label: question.label.trim(),
    }));

    if (normalizedQuestions.some((question) => question.label.length < 3)) {
      setNotice("Each client intake question must be at least 3 characters.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/professional-intake",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: selectedServiceId,
            questions: normalizedQuestions,
          }),
        },
        "/appointments/professional-intake",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save the client intake form.");
      }

      const updated = payload as ProfessionalBookingIntakeResponse;
      setData(updated);
      setQuestions(updated.questions.map((question) => ({ ...question })));
      setNotice(
        updated.hasSavedForm
          ? "Client intake form saved."
          : "Client intake form cleared.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to save the client intake form.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
              Professional Booking
            </p>
            <span className="rounded-full border border-[color:var(--loombus-gold)]/40 bg-[color:var(--loombus-gold-soft)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--loombus-gold)]">
              Premium Pro
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em]">
            Client intake forms
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Configure up to five service-specific questions for Professional Booking. Required questions are stored now; client-facing collection will be activated only after this configuration foundation is validated.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadServices()}
          disabled={loadingServices || loadingForm || saving}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={loadingServices || loadingForm ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-[color:var(--loombus-border-muted)] bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
        <div className="flex gap-3">
          <ClipboardList
            className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]"
            aria-hidden="true"
          />
          <p>
            This slice configures intake questions only. It does not yet show questions to requesters, require answers, or alter ordinary Appointment requests.
          </p>
        </div>
      </div>

      {notice ? (
        <div
          className="mt-4 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4 text-sm"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      {loadingServices ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-6 text-center text-sm text-[color:var(--loombus-text-muted)]">
          Loading appointment services…
        </div>
      ) : usableServices.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-6 text-center text-sm text-[color:var(--loombus-text-muted)]">
          Create an appointment service first, then return here to add a Professional Booking intake form.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Appointment service</span>
            <select
              value={selectedServiceId}
              onChange={(event) => setSelectedServiceId(event.target.value)}
              className={fieldClass}
              disabled={loadingForm || saving}
            >
              {usableServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.businessName} · {service.name}
                </option>
              ))}
            </select>
          </label>

          {loadingForm ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-6 text-center text-sm text-[color:var(--loombus-text-muted)]">
              Loading client intake form…
            </div>
          ) : data ? (
            <>
              {!canEdit ? (
                <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4">
                  <p className="text-sm font-semibold">
                    {data.hasSavedForm
                      ? "Saved intake questions are preserved read-only."
                      : "Premium Pro is required to configure client intake forms."}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Downgrading does not delete saved configuration. It becomes editable again when Professional Booking access returns.
                  </p>
                  <button
                    type="button"
                    onClick={requestAccess}
                    className="mt-3 rounded-full border border-[color:var(--loombus-gold)] px-4 py-2 text-sm font-semibold text-[color:var(--loombus-gold)]"
                  >
                    View Premium Pro
                  </button>
                </div>
              ) : null}

              <div className="space-y-3">
                {questions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-5 text-sm text-[color:var(--loombus-text-muted)]">
                    No client intake questions configured for this service.
                  </div>
                ) : (
                  questions.map((question, index) => (
                    <div
                      key={question.id}
                      className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <label className="min-w-0 flex-1">
                          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-muted)]">
                            Question {index + 1}
                          </span>
                          <input
                            maxLength={200}
                            value={question.label}
                            disabled={!canEdit || saving}
                            onChange={(event) =>
                              updateQuestion(question.id, { label: event.target.value })
                            }
                            className={fieldClass}
                            placeholder="What should the client answer before requesting?"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeQuestion(question.id)}
                          disabled={!canEdit || saving}
                          className="mt-7 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-500/30 text-red-500 disabled:opacity-40"
                          aria-label={`Remove question ${index + 1}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={question.required}
                          disabled={!canEdit || saving}
                          onChange={(event) =>
                            updateQuestion(question.id, { required: event.target.checked })
                          }
                        />
                        Require an answer
                      </label>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addQuestion}
                  disabled={!canEdit || saving || questions.length >= PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-4 py-2.5 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"
                >
                  <Plus size={15} /> Add question
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!canEdit || saving}
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--loombus-primary-bg)] px-5 py-2.5 text-sm font-semibold text-[color:var(--loombus-primary-text)] disabled:opacity-50"
                >
                  <Save size={15} /> {saving ? "Saving…" : "Save intake form"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
