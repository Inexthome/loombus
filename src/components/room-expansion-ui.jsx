"use client";

export function formatDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatBytes(bytes) {
  const value = Number(bytes ?? 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${value} bytes`;
}

export function displayName(profile, fallback = "Room member") {
  return profile?.full_name?.trim() || profile?.username?.trim() || fallback;
}

export function parseFieldLines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label, type = "text", required = "no", options = ""] = line.split("|").map((item) => item.trim());
    return { label, type, required: ["yes", "required", "true"].includes(required.toLowerCase()), options: options.split(";").map((item) => item.trim()).filter(Boolean) };
  });
}

export function Empty({ Icon, title, text }) {
  return <div className="room-expansion-empty"><Icon aria-hidden="true" /><h3>{title}</h3><p>{text}</p></div>;
}
