import "server-only";

import type { NextRequest } from "next/server";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import { createRequestSupabase, createRoomServiceSupabase } from "@/lib/room-operations";
import { evaluateSubscriptionEntitlement } from "@/lib/subscription-entitlements";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

export type ProfessionalBookingRequestViolation = {
  message: string;
  status: number;
  code: string;
};

type Row = Record<string, unknown>;
type Service = ReturnType<typeof createRoomServiceSupabase>;

type AvailabilityWindow = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

type StoredProfessionalBookingSettings = {
  timezone: string;
  weeklyAvailability: AvailabilityWindow[];
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
};

type LocalWallClock = {
  dayOfWeek: number;
  minuteOfDay: number;
  dateSerial: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function uuid(value: unknown) {
  const result = text(value, 60);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)
    ? result
    : null;
}

function integerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function normalizeSettings(row: Row): StoredProfessionalBookingSettings | null {
  const timezone = text(row.timezone, 100);
  const minimumNoticeMinutes = integerInRange(
    row.minimum_notice_minutes,
    0,
    43200,
  );
  const maximumAdvanceDays = integerInRange(
    row.maximum_advance_days,
    1,
    365,
  );
  const rawWindows = row.weekly_availability;

  if (
    !timezone ||
    minimumNoticeMinutes === null ||
    maximumAdvanceDays === null ||
    minimumNoticeMinutes > maximumAdvanceDays * 1440 ||
    !Array.isArray(rawWindows) ||
    rawWindows.length > 28
  ) {
    return null;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    return null;
  }

  const weeklyAvailability: AvailabilityWindow[] = [];

  for (const rawWindow of rawWindows) {
    if (
      !rawWindow ||
      typeof rawWindow !== "object" ||
      Array.isArray(rawWindow)
    ) {
      return null;
    }

    const window = rawWindow as Row;
    const dayOfWeek = integerInRange(window.dayOfWeek, 0, 6);
    const startMinute = integerInRange(window.startMinute, 0, 1439);
    const endMinute = integerInRange(window.endMinute, 1, 1440);

    if (
      dayOfWeek === null ||
      startMinute === null ||
      endMinute === null ||
      startMinute >= endMinute
    ) {
      return null;
    }

    weeklyAvailability.push({
      dayOfWeek,
      startMinute,
      endMinute,
    });
  }

  return {
    timezone,
    weeklyAvailability,
    minimumNoticeMinutes,
    maximumAdvanceDays,
  };
}

function localWallClock(
  instant: Date,
  timezone: string,
): LocalWallClock | null {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  const dayOfWeek = WEEKDAY_INDEX[part("weekday")];
  const year = Number(part("year"));
  const month = Number(part("month"));
  const day = Number(part("day"));
  const hour = Number(part("hour"));
  const minute = Number(part("minute"));

  if (
    !Number.isInteger(dayOfWeek) ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null;
  }

  return {
    dayOfWeek,
    minuteOfDay: hour * 60 + minute,
    dateSerial: Math.floor(Date.UTC(year, month - 1, day) / 86_400_000),
  };
}

function fitsAvailabilityWindow(
  window: AvailabilityWindow,
  start: LocalWallClock,
  end: LocalWallClock,
) {
  if (window.dayOfWeek !== start.dayOfWeek) return false;
  if (start.minuteOfDay < window.startMinute) return false;

  if (start.dateSerial === end.dateSerial) {
    return (
      end.minuteOfDay > start.minuteOfDay &&
      end.minuteOfDay <= window.endMinute
    );
  }

  return (
    end.dateSerial === start.dateSerial + 1 &&
    end.minuteOfDay === 0 &&
    window.endMinute === 1440
  );
}

function noticeLabel(minutes: number) {
  if (minutes > 0 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  if (minutes > 0 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

async function providerCanUseProfessionalBooking(
  service: Service,
  providerId: string,
) {
  const { data: profile } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", providerId)
    .maybeSingle();

  if (profile?.is_admin === true) return true;

  try {
    const subscription =
      await getResolvedGeneralSubscriptionForUser(providerId);

    return (
      subscription.isAdminOverride ||
      evaluateSubscriptionEntitlement(
        subscription.plan,
        "professional_booking",
      ).allowed
    );
  } catch (error) {
    console.error(
      "Professional Booking request entitlement resolution failed:",
      {
        providerId,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );
    return false;
  }
}

export async function getProfessionalBookingRequestViolation(
  request: NextRequest,
  input: Record<string, unknown>,
): Promise<ProfessionalBookingRequestViolation | null> {
  const serviceId = uuid(input.serviceId);
  const requestedStartRaw = text(input.requestedStart, 100);
  const requestedStartMs = Date.parse(requestedStartRaw);

  if (!serviceId || !Number.isFinite(requestedStartMs)) {
    return null;
  }

  let access;
  let service: Service;

  try {
    access = await verifyRequestAccountAccess(
      createRequestSupabase(request),
    );
    service = createRoomServiceSupabase();
  } catch {
    return null;
  }

  if (!access.ok) return null;

  const { data: appointmentService, error: serviceError } = await service
    .from("business_appointment_services")
    .select("owner_id, duration_minutes")
    .eq("id", serviceId)
    .eq("status", "active")
    .maybeSingle();

  if (serviceError || !appointmentService) {
    return null;
  }

  const providerId = text(appointmentService.owner_id, 60);
  const durationMinutes = integerInRange(
    appointmentService.duration_minutes,
    15,
    480,
  );

  if (
    !providerId ||
    providerId === access.user.id ||
    durationMinutes === null
  ) {
    return null;
  }

  const { data: settingsRow, error: settingsError } = await service
    .from("professional_booking_settings")
    .select(
      "timezone, weekly_availability, minimum_notice_minutes, maximum_advance_days",
    )
    .eq("provider_id", providerId)
    .maybeSingle();

  if (settingsError) {
    console.error(
      "Professional Booking request settings lookup failed:",
      {
        providerId,
        error: settingsError.message,
      },
    );
    return null;
  }

  if (!settingsRow) return null;

  if (!(await providerCanUseProfessionalBooking(service, providerId))) {
    return null;
  }

  const settings = normalizeSettings(settingsRow as Row);
  if (!settings) {
    console.error(
      "Professional Booking request settings are invalid:",
      { providerId },
    );
    return null;
  }

  const requestedEndMs =
    requestedStartMs + durationMinutes * 60_000;
  const nowMs = Date.now();
  const minimumStartMs =
    nowMs + settings.minimumNoticeMinutes * 60_000;
  const maximumStartMs =
    nowMs + settings.maximumAdvanceDays * 86_400_000;

  if (requestedStartMs < minimumStartMs) {
    return {
      message: `Choose a time that gives this provider at least ${noticeLabel(settings.minimumNoticeMinutes)} of notice.`,
      status: 400,
      code: "professional_booking_minimum_notice",
    };
  }

  if (requestedStartMs > maximumStartMs) {
    return {
      message: `This provider accepts Professional Booking requests up to ${settings.maximumAdvanceDays} day${settings.maximumAdvanceDays === 1 ? "" : "s"} in advance.`,
      status: 400,
      code: "professional_booking_maximum_advance",
    };
  }

  const start = localWallClock(
    new Date(requestedStartMs),
    settings.timezone,
  );
  const end = localWallClock(
    new Date(requestedEndMs),
    settings.timezone,
  );

  if (!start || !end) return null;

  if (
    !settings.weeklyAvailability.some((window) =>
      fitsAvailabilityWindow(window, start, end),
    )
  ) {
    return {
      message:
        "Choose a time within this provider's Professional Booking availability.",
      status: 409,
      code: "professional_booking_outside_availability",
    };
  }

  return null;
}
