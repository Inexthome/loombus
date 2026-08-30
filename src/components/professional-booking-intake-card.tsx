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
  "min-h-11 w-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-3 py-2.5 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] hover:border-[color:var(--loombus-text-subtle)] focus-visible:border-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold-soft)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60";

const actionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-1 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold-soft)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50";

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
        if (
          current &&
          nextServices.some(
            (service) => service.id === current && service.status !== "archived",
          )
        ) {
          return current;
        }
        return (
          nextServices.find((service) => service.status !== "archived")?.id ?? ""
        );
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

    setQuestions((current) =>
      current.filter((question) => question.id !== id),
    );
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
    <section
      data-professional-booking-intake-editorial="root"
      className="border-t border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)]"
    >
      <header className="border-b border-[color:var(--loombus-border)] py-6 sm:py-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                Professional Booking
              </p>
              <span className="border-l border-[color:var(--loombus-border)] pl-4 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">
                Premium Pro
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              Client intake forms
            </h1>
            <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)] sm:text-base">
              Configure up to five service-specific questions for Professional Booking. Required questions are stored now; client-facing collection will be activated only after this configuration foundation is validated.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadServices()}
            disabled={loadingServices || loadingForm || saving}
            className={actionClass}
          >
            <RefreshCw
              size={15}
              className={loadingServices || loadingForm ? "animate-spin motion-reduce:animate-none" : ""}
            />
            Refresh
          </button>
        </div>
      </header>

      <div className="border-b border-[color:var(--loombus-border)] py-5 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
        <div className="flex max-w-3xl gap-3">
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
          className="border-b border-[color:var(--loombus-border)] py-4 text-sm"
          role="status"
        >
          <span className="border-l-2 border-[color:var(--loombus-gold)] pl-3">
            {notice}
          </span>
        </div>
      ) : null}

      {loadingServices ? (
        <div className="border-b border-dashed border-[color:var(--loombus-border)] py-8 text-sm text-[color:var(--loombus-text-muted)]">
          Loading appointment services…
        </div>
      ) : usableServices.length === 0 ? (
        <div className="border-b border-dashed border-[color:var(--loombus-border)] py-8 text-sm text-[color:var(--loombus-text-muted)]">
          Create an appointment service first, then return here to add a Professional Booking intake form.
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--loombus-border)]">
          <div className="py-6">
            <label className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-center">
              <span className="text-sm font-semibold">Appointment service</span>
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
          </div>

          {loadingForm ? (
            <div className="py-8 text-sm text-[color:var(--loombus-text-muted)]">
              Loading client intake form…
            </div>
          ) : data ? (
            <>
              {!canEdit ? (
                <div className="grid gap-4 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="max-w-3xl border-l-2 border-[color:var(--loombus-gold)] pl-4">
                    <p className="text-sm font-semibold">
                      {data.hasSavedForm
                        ? "Saved intake questions are preserved read-only."
                        : "Premium Pro is required to configure client intake forms."}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                      Downgrading does not delete saved configuration. It becomes editable again when Professional Booking access returns.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={requestAccess}
                    className={`${actionClass} text-[color:var(--loombus-gold)]`}
                  >
                    View Premium Pro
                  </button>
                </div>
              ) : null}

              <div className="py-2">
                {questions.length === 0 ? (
                  <div className="border-b border-dashed border-[color:var(--loombus-border)] py-8 text-sm text-[color:var(--loombus-text-muted)]">
                    No client intake questions configured for this service.
                  </div>
                ) : (
                  <div className="divide-y divide-[color:var(--loombus-border)]">
                    {questions.map((question, index) => (
                      <div
                        key={question.id}
                        className="grid gap-4 py-6 lg:grid-cols-[7rem_minmax(0,1fr)_auto] lg:items-start"
                      >
                        <p className="pt-3 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-gold)]">
                          Question {index + 1}
                        </p>
                        <div className="min-w-0">
                          <label className="block">
                            <span className="sr-only">Question {index + 1}</span>
                            <input
                              maxLength={200}
                              value={question.label}
                              disabled={!canEdit || saving}
                              onChange={(event) =>
                                updateQuestion(question.id, {
                                  label: event.target.value,
                                })
                              }
                              className={fieldClass}
                              placeholder="What should the client answer before requesting?"
                            />
                          </label>

                          <label className="mt-3 inline-flex min-h-11 items-center gap-3 text-sm font-semibold">
                            <input
                              type="checkbox"
                              checked={question.required}
                              disabled={!canEdit || saving}
                              onChange={(event) =>
                                updateQuestion(question.id, {
                                  required: event.target.checked,
                                })
                              }
                              className="h-4 w-4 accent-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold-soft)]"
                            />
                            Require an answer
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQuestion(question.id)}
                          disabled={!canEdit || saving}
                          className="inline-flex min-h-11 items-center gap-2 self-start border-b border-red-500/40 px-1 text-sm font-semibold text-red-500 transition hover:border-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold-soft)] motion-reduce:transition-none disabled:opacity-40"
                          aria-label={`Remove question ${index + 1}`}
                        >
                          <Trash2 size={16} />
                          <span>Remove</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={addQuestion}
                  disabled={
                    !canEdit ||
                    saving ||
                    questions.length >= PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT
                  }
                  className={actionClass}
                >
                  <Plus size={15} /> Add question
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!canEdit || saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-[color:var(--loombus-gold)] bg-transparent px-5 text-sm font-semibold text-[color:var(--loombus-gold)] transition hover:bg-[color:var(--loombus-gold-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold-soft)] motion-reduce:transition-none disabled:opacity-50"
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
