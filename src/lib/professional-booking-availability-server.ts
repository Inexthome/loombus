import "server-only";

import type { NextRequest } from "next/server";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import {
  PROFESSIONAL_BOOKING_DEFAULT_SETTINGS,
  type ProfessionalBookingAvailabilityResponse,
  type ProfessionalBookingAvailabilityWindow,
  type ProfessionalBookingSettings,
} from "@/lib/professional-booking";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import {
  evaluateSubscriptionEntitlement,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";
import { getMemberAgeSafety } from "@/lib/teen-safety-server";

type Row = Record<string, unknown>;
type Service = ReturnType<typeof createRoomServiceSupabase>;

export class ProfessionalBookingAvailabilityError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "professional_booking_error",
  ) {
    super(message);
  }
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integerInRange(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new ProfessionalBookingAvailabilityError(
      `${label} must be a whole number between ${minimum} and ${maximum}.`,
      400,
      "invalid_professional_booking_settings",
    );
  }

  return value;
}

function storedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function normalizeStoredWindow(
  value: unknown,
): ProfessionalBookingAvailabilityWindow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Row;
  const dayOfWeek = Number(row.dayOfWeek);
  const startMinute = Number(row.startMinute);
  const endMinute = Number(row.endMinute);

  if (
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6 ||
    !Number.isInteger(startMinute) ||
    startMinute < 0 ||
    startMinute > 1439 ||
    !Number.isInteger(endMinute) ||
    endMinute < 1 ||
    endMinute > 1440 ||
    startMinute >= endMinute
  ) {
    return null;
  }

  return { dayOfWeek, startMinute, endMinute };
}

function normalizeStoredSettings(
  row: Row | null | undefined,
): ProfessionalBookingSettings {
  const rawWindows = Array.isArray(row?.weekly_availability)
    ? row.weekly_availability
    : [];

  const weeklyAvailability = rawWindows
    .map(normalizeStoredWindow)
    .filter(
      (
        window,
      ): window is ProfessionalBookingAvailabilityWindow => Boolean(window),
    )
    .slice(0, 28)
    .sort(
      (left, right) =>
        left.dayOfWeek - right.dayOfWeek ||
        left.startMinute - right.startMinute ||
        left.endMinute - right.endMinute,
    );

  const timezone =
    cleanText(row?.timezone, 100) ||
    PROFESSIONAL_BOOKING_DEFAULT_SETTINGS.timezone;

  return {
    timezone,
    weeklyAvailability,
    minimumNoticeMinutes: storedInteger(
      row?.minimum_notice_minutes,
      0,
      43200,
      PROFESSIONAL_BOOKING_DEFAULT_SETTINGS.minimumNoticeMinutes,
    ),
    maximumAdvanceDays: storedInteger(
      row?.maximum_advance_days,
      1,
      365,
      PROFESSIONAL_BOOKING_DEFAULT_SETTINGS.maximumAdvanceDays,
    ),
  };
}

function validateSettingsInput(
  input: Record<string, unknown>,
): ProfessionalBookingSettings {
  const timezone = cleanText(input.timezone, 100);

  if (!timezone) {
    throw new ProfessionalBookingAvailabilityError(
      "Choose a booking timezone.",
      400,
      "professional_booking_timezone_required",
    );
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new ProfessionalBookingAvailabilityError(
      "Choose a valid IANA timezone, such as America/New_York.",
      400,
      "invalid_professional_booking_timezone",
    );
  }

  if (!Array.isArray(input.weeklyAvailability)) {
    throw new ProfessionalBookingAvailabilityError(
      "Weekly availability must be a list of booking windows.",
      400,
      "invalid_professional_booking_availability",
    );
  }

  if (input.weeklyAvailability.length > 28) {
    throw new ProfessionalBookingAvailabilityError(
      "Professional Booking supports up to four recurring windows per day.",
      400,
      "professional_booking_window_limit",
    );
  }

  const weeklyAvailability =
    input.weeklyAvailability.map((value, index) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new ProfessionalBookingAvailabilityError(
          `Availability window ${index + 1} is invalid.`,
          400,
          "invalid_professional_booking_availability",
        );
      }

      const row = value as Record<string, unknown>;
      const dayOfWeek = integerInRange(
        row.dayOfWeek,
        "Availability day",
        0,
        6,
      );
      const startMinute = integerInRange(
        row.startMinute,
        "Availability start minute",
        0,
        1439,
      );
      const endMinute = integerInRange(
        row.endMinute,
        "Availability end minute",
        1,
        1440,
      );

      if (startMinute >= endMinute) {
        throw new ProfessionalBookingAvailabilityError(
          "Each availability window must end after it starts.",
          400,
          "invalid_professional_booking_availability",
        );
      }

      return { dayOfWeek, startMinute, endMinute };
    });

  weeklyAvailability.sort(
    (left, right) =>
      left.dayOfWeek - right.dayOfWeek ||
      left.startMinute - right.startMinute ||
      left.endMinute - right.endMinute,
  );

  const perDay = new Map<number, number>();

  for (let index = 0; index < weeklyAvailability.length; index += 1) {
    const current = weeklyAvailability[index];
    const count = (perDay.get(current.dayOfWeek) ?? 0) + 1;
    perDay.set(current.dayOfWeek, count);

    if (count > 4) {
      throw new ProfessionalBookingAvailabilityError(
        "Professional Booking supports up to four recurring windows per day.",
        400,
        "professional_booking_window_limit",
      );
    }

    const previous = weeklyAvailability[index - 1];
    if (
      previous &&
      previous.dayOfWeek === current.dayOfWeek &&
      current.startMinute < previous.endMinute
    ) {
      throw new ProfessionalBookingAvailabilityError(
        "Recurring availability windows cannot overlap.",
        400,
        "professional_booking_window_overlap",
      );
    }
  }

  const minimumNoticeMinutes = integerInRange(
    input.minimumNoticeMinutes,
    "Minimum notice",
    0,
    43200,
  );

  const maximumAdvanceDays = integerInRange(
    input.maximumAdvanceDays,
    "Maximum advance window",
    1,
    365,
  );

  if (minimumNoticeMinutes > maximumAdvanceDays * 1440) {
    throw new ProfessionalBookingAvailabilityError(
      "Minimum notice cannot be longer than the maximum advance booking window.",
      400,
      "professional_booking_window_conflict",
    );
  }

  return {
    timezone,
    weeklyAvailability,
    minimumNoticeMinutes,
    maximumAdvanceDays,
  };
}

async function resolveViewer(request: NextRequest) {
  const access = await verifyRequestAccountAccess(
    createRequestSupabase(request),
  );

  if (!access.ok) {
    throw new ProfessionalBookingAvailabilityError(
      access.error,
      access.status,
      access.code ?? "account_access_denied",
    );
  }

  return {
    userId: access.user.id,
    isAdmin: access.profile.is_admin === true,
    service: createRoomServiceSupabase(),
  };
}

async function requireAdultProvider(
  service: Service,
  userId: string,
) {
  const ageSafety = await getMemberAgeSafety(service, userId);

  if (!ageSafety.lookupAvailable) {
    throw new ProfessionalBookingAvailabilityError(
      "Loombus could not verify age-safety eligibility. Try again later.",
      503,
      "age_safety_unavailable",
    );
  }

  if (
    ageSafety.ageBand === "under_13" ||
    ageSafety.guardianRequired
  ) {
    throw new ProfessionalBookingAvailabilityError(
      "This account is not eligible to use Loombus.",
      403,
      "under_13_not_allowed",
    );
  }

  if (ageSafety.ageBand === "unknown") {
    throw new ProfessionalBookingAvailabilityError(
      "Complete age safety before configuring Professional Booking.",
      403,
      "age_gate_required",
    );
  }

  if (ageSafety.ageBand === "teen") {
    throw new ProfessionalBookingAvailabilityError(
      "Professional Booking configuration is currently limited to adult accounts while Loombus verifies teen-safe commercial controls.",
      403,
      "teen_action_restricted",
    );
  }
}

type ProfessionalBookingAccess = {
  plan: SubscriptionPlanId;
  allowed: boolean;
  resolutionAvailable: boolean;
};

async function resolveProfessionalBookingAccess(
  userId: string,
  isAdmin: boolean,
): Promise<ProfessionalBookingAccess> {
  if (isAdmin) {
    return {
      plan: "free",
      allowed: true,
      resolutionAvailable: true,
    };
  }

  try {
    const subscription =
      await getResolvedGeneralSubscriptionForUser(userId);

    return {
      plan: subscription.plan,
      allowed:
        subscription.isAdminOverride ||
        evaluateSubscriptionEntitlement(
          subscription.plan,
          "professional_booking",
        ).allowed,
      resolutionAvailable: true,
    };
  } catch (error) {
    console.error(
      "Professional Booking subscription resolution failed:",
      {
        userId,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );

    return {
      plan: "free",
      allowed: false,
      resolutionAvailable: false,
    };
  }
}

function throwSettingsReadError(error: { message?: string } | null) {
  if (
    error &&
    /professional_booking_settings|schema cache/i.test(
      error.message ?? "",
    )
  ) {
    throw new ProfessionalBookingAvailabilityError(
      "The Professional Booking migration has not been applied.",
      503,
      "professional_booking_schema_unavailable",
    );
  }

  throw new ProfessionalBookingAvailabilityError(
    "Unable to load Professional Booking availability.",
    503,
    "professional_booking_unavailable",
  );
}

export async function getProfessionalBookingAvailability(
  request: NextRequest,
): Promise<ProfessionalBookingAvailabilityResponse> {
  const viewer = await resolveViewer(request);

  const [access, settingsResult] = await Promise.all([
    resolveProfessionalBookingAccess(
      viewer.userId,
      viewer.isAdmin,
    ),
    viewer.service
      .from("professional_booking_settings")
      .select(
        "timezone, weekly_availability, minimum_notice_minutes, maximum_advance_days",
      )
      .eq("provider_id", viewer.userId)
      .maybeSingle(),
  ]);

  if (settingsResult.error) {
    throwSettingsReadError(settingsResult.error);
  }

  return {
    subscriptionPlan: access.plan,
    canUseProfessionalBooking: access.allowed,
    subscriptionResolutionAvailable:
      access.resolutionAvailable,
    hasSavedSettings: Boolean(settingsResult.data),
    settings: normalizeStoredSettings(
      settingsResult.data as Row | null,
    ),
  };
}

export async function saveProfessionalBookingAvailability(
  request: NextRequest,
  input: Record<string, unknown>,
): Promise<ProfessionalBookingAvailabilityResponse> {
  const viewer = await resolveViewer(request);

  await requireAdultProvider(
    viewer.service,
    viewer.userId,
  );

  const access = await resolveProfessionalBookingAccess(
    viewer.userId,
    viewer.isAdmin,
  );

  if (!access.resolutionAvailable) {
    throw new ProfessionalBookingAvailabilityError(
      "Unable to verify Premium Pro Professional Booking access.",
      503,
      "professional_booking_access_unavailable",
    );
  }

  if (!access.allowed) {
    throw new ProfessionalBookingAvailabilityError(
      "Premium Pro is required to configure Professional Booking availability.",
      403,
      "professional_booking_required",
    );
  }

  const settings = validateSettingsInput(input);
  const now = new Date().toISOString();

  const { error } = await viewer.service
    .from("professional_booking_settings")
    .upsert(
      {
        provider_id: viewer.userId,
        timezone: settings.timezone,
        weekly_availability:
          settings.weeklyAvailability,
        minimum_notice_minutes:
          settings.minimumNoticeMinutes,
        maximum_advance_days:
          settings.maximumAdvanceDays,
        updated_at: now,
      },
      { onConflict: "provider_id" },
    );

  if (error) {
    if (
      /professional_booking_settings|schema cache/i.test(
        error.message ?? "",
      )
    ) {
      throw new ProfessionalBookingAvailabilityError(
        "The Professional Booking migration has not been applied.",
        503,
        "professional_booking_schema_unavailable",
      );
    }

    throw new ProfessionalBookingAvailabilityError(
      "Unable to save Professional Booking availability.",
      503,
      "professional_booking_save_failed",
    );
  }

  return {
    subscriptionPlan: access.plan,
    canUseProfessionalBooking: true,
    subscriptionResolutionAvailable: true,
    hasSavedSettings: true,
    settings,
  };
}
