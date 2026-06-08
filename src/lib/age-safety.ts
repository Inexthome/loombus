export type AgeBand = "unknown" | "under_13" | "teen" | "adult";

export function getAgeFromDateOfBirth(dateOfBirth: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return null;
  }

  const birthDate = new Date(`${dateOfBirth}T00:00:00`);

  if (!Number.isFinite(birthDate.getTime())) {
    return null;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (birthDate > today) {
    return null;
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (
    monthDelta < 0 ||
    (monthDelta === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  if (age < 0 || age > 120) {
    return null;
  }

  return age;
}

export function getAgeBandFromDateOfBirth(dateOfBirth: string): AgeBand | null {
  const age = getAgeFromDateOfBirth(dateOfBirth);

  if (age === null) {
    return null;
  }

  if (age < 13) {
    return "under_13";
  }

  if (age < 18) {
    return "teen";
  }

  return "adult";
}

export function getTeenSafetyFlags(dateOfBirth: string) {
  const ageBand = getAgeBandFromDateOfBirth(dateOfBirth);

  if (!ageBand) {
    return null;
  }

  return {
    ageBand,
    teenSafetyMode: ageBand === "under_13" || ageBand === "teen",
    guardianRequired: ageBand === "under_13",
  };
}

export function getDateYearsAgo(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
}
