import "server-only";

import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import { createRoomServiceSupabase } from "@/lib/room-operations";
import { evaluateSubscriptionEntitlement } from "@/lib/subscription-entitlements";

export type ProfessionalBookingSlotGuidance = {
  active: boolean;
  providerTimezone: string | null;
  suggestedStarts: string[];
};

type Row = Record<string, unknown>;
type Service = ReturnType<typeof createRoomServiceSupabase>;

type AvailabilityWindow = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

type StoredSettings = {
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

const INACTIVE_GUIDANCE: ProfessionalBookingSlotGuidance = {
  active: false,
  providerTimezone: null,
  suggestedStarts: [],
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

function normalizeSettings(row: Row): StoredSettings | null {
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

    weeklyAvailability.push({ dayOfWeek, startMinute, endMinute });
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
      "Professional Booking slot-guidance entitlement resolution failed:",
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

function suggestedStarts(
  settings: StoredSettings,
  durationMinutes: number,
) {
  const nowMs = Date.now();
  const universalFloorMs = nowMs + 30 * 60_000;
  const professionalFloorMs =
    nowMs + settings.minimumNoticeMinutes * 60_000;
  const earliestStartMs = Math.max(
    universalFloorMs,
    professionalFloorMs,
  );
  const latestStartMs =
    nowMs + settings.maximumAdvanceDays * 86_400_000;
  const scanEndMs = Math.min(
    latestStartMs,
    nowMs + 31 * 86_400_000,
  );
  const stepMs = 15 * 60_000;
  const durationMs = durationMinutes * 60_000;
  const starts: string[] = [];

  let cursor = Math.ceil((earliestStartMs + 60_000) / stepMs) * stepMs;

  while (cursor <= scanEndMs && starts.length < 12) {
    const endMs = cursor + durationMs;
    const startWall = localWallClock(
      new Date(cursor),
      settings.timezone,
    );
    const endWall = localWallClock(
      new Date(endMs),
      settings.timezone,
    );

    if (
      startWall &&
      endWall &&
      settings.weeklyAvailability.some((window) =>
        fitsAvailabilityWindow(window, startWall, endWall),
      )
    ) {
      starts.push(new Date(cursor).toISOString());
    }

    cursor += stepMs;
  }

  return starts;
}

export async function getProfessionalBookingSlotGuidance(
  businessSlug: string,
  rawServiceId: string,
): Promise<ProfessionalBookingSlotGuidance> {
  const serviceId = uuid(rawServiceId);
  const slug = text(businessSlug, 120);

  if (!serviceId || !slug) return INACTIVE_GUIDANCE;

  let service: Service;
  try {
    service = createRoomServiceSupabase();
  } catch {
    return INACTIVE_GUIDANCE;
  }

  const { data: appointmentService, error: serviceError } = await service
    .from("business_appointment_services")
    .select("business_id, owner_id, duration_minutes")
    .eq("id", serviceId)
    .eq("status", "active")
    .maybeSingle();

  if (serviceError || !appointmentService) {
    return INACTIVE_GUIDANCE;
  }

  const providerId = text(appointmentService.owner_id, 60);
  const businessId = uuid(appointmentService.business_id);
  const durationMinutes = integerInRange(
    appointmentService.duration_minutes,
    15,
    480,
  );

  if (!providerId || !businessId || durationMinutes === null) {
    return INACTIVE_GUIDANCE;
  }

  const { data: business, error: businessError } = await service
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", providerId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (businessError || !business) {
    return INACTIVE_GUIDANCE;
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
      "Professional Booking slot-guidance settings lookup failed:",
      {
        providerId,
        error: settingsError.message,
      },
    );
    return INACTIVE_GUIDANCE;
  }

  if (!settingsRow) return INACTIVE_GUIDANCE;

  if (!(await providerCanUseProfessionalBooking(service, providerId))) {
    return INACTIVE_GUIDANCE;
  }

  const settings = normalizeSettings(settingsRow as Row);
  if (!settings) {
    console.error(
      "Professional Booking slot-guidance settings are invalid:",
      { providerId },
    );
    return INACTIVE_GUIDANCE;
  }

  return {
    active: true,
    providerTimezone: settings.timezone,
    suggestedStarts: suggestedStarts(settings, durationMinutes),
  };
}
