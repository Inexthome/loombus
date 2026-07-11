"use client";

import { useEffect, useState } from "react";

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function getYearOptions() {
  const currentYear = new Date().getFullYear();
  const earliestBirthYear = currentYear - 120;

  return Array.from(
    { length: currentYear - earliestBirthYear + 1 },
    (_, index) => String(currentYear - index)
  );
}

function getDaysInMonth(year: string, month: string) {
  if (!year || !month) {
    return 31;
  }

  return new Date(Number(year), Number(month), 0).getDate();
}

function getDateParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return { year: "", month: "", day: "" };
  }

  return {
    year: match[1],
    month: match[2],
    day: match[3],
  };
}

function padDay(value: string) {
  return value.padStart(2, "0");
}

type DateOfBirthSelectProps = {
  value: string;
  onChange: (value: string) => void;
  idPrefix?: string;
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
};

export function DateOfBirthSelect({
  value,
  onChange,
  idPrefix = "date-of-birth",
  disabled = false,
  className = "grid gap-3 sm:grid-cols-3",
  selectClassName = "w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60",
}: DateOfBirthSelectProps) {
  const [parts, setParts] = useState(() => getDateParts(value));
  const yearOptions = getYearOptions();
  const daysInMonth = getDaysInMonth(parts.year, parts.month);
  const dayOptions = Array.from({ length: daysInMonth }, (_, index) =>
    padDay(String(index + 1))
  );

  useEffect(() => {
    if (value) {
      setParts(getDateParts(value));
    }
  }, [value]);

  function updateDate(next: Partial<{ year: string; month: string; day: string }>) {
    setParts((currentParts) => {
      const nextParts = {
        ...currentParts,
        ...next,
      };

      const nextDaysInMonth = getDaysInMonth(nextParts.year, nextParts.month);

      if (nextParts.day && Number(nextParts.day) > nextDaysInMonth) {
        nextParts.day = padDay(String(nextDaysInMonth));
      }

      if (nextParts.year && nextParts.month && nextParts.day) {
        onChange(`${nextParts.year}-${nextParts.month}-${nextParts.day}`);
      } else if (value) {
        onChange("");
      }

      return nextParts;
    });
  }

  return (
    <div className={className}>
      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          Month
        </span>
        <select
          id={`${idPrefix}-month`}
          value={parts.month}
          disabled={disabled}
          required
          onChange={(event) => updateDate({ month: event.target.value })}
          className={selectClassName}
        >
          <option value="">Month</option>
          {MONTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          Day
        </span>
        <select
          id={`${idPrefix}-day`}
          value={parts.day}
          disabled={disabled}
          required
          onChange={(event) => updateDate({ day: event.target.value })}
          className={selectClassName}
        >
          <option value="">Day</option>
          {dayOptions.map((option) => (
            <option key={option} value={option}>
              {Number(option)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          Year
        </span>
        <select
          id={`${idPrefix}-year`}
          value={parts.year}
          disabled={disabled}
          required
          onChange={(event) => updateDate({ year: event.target.value })}
          className={selectClassName}
        >
          <option value="">Year</option>
          {yearOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
