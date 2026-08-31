"use client";

import { useEffect, useState } from "react";

function formatDisplayDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "";
  }

  return `${match[2]}/${match[3]}/${match[1]}`;
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDisplayDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return "";
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }

  return `${match[3]}-${match[1]}-${match[2]}`;
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
  className = "block",
  selectClassName = "w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60",
}: DateOfBirthSelectProps) {
  const [displayValue, setDisplayValue] = useState(() => formatDisplayDate(value));

  useEffect(() => {
    setDisplayValue(formatDisplayDate(value));
  }, [value]);

  function handleChange(nextValue: string) {
    const formatted = formatDateInput(nextValue);
    setDisplayValue(formatted);
    onChange(parseDisplayDate(formatted));
  }

  return (
    <div className={className}>
      <input
        id={idPrefix}
        type="text"
        value={displayValue}
        disabled={disabled}
        required
        inputMode="numeric"
        autoComplete="bday"
        placeholder="MM/DD/YYYY"
        maxLength={10}
        aria-label="Date of birth in month day year format"
        onChange={(event) => handleChange(event.target.value)}
        className={selectClassName}
      />
    </div>
  );
}
