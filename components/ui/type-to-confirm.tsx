"use client";

import { useState } from "react";

/** Type-to-confirm input for destructive actions. The user must type
 *  `expected` (case-insensitive, trimmed) before submit is enabled.
 *
 *  Usage:
 *    const { input, isConfirmed } = useTypeToConfirm({
 *      expected: booking.origin_icao + "-" + booking.destination_icao,
 *      label: "Type the route to confirm",
 *    });
 *    ...
 *    {input}
 *    <button disabled={!isConfirmed || pending}>Cancel Booking</button>
 *
 *  The comparison lowercases + trims both sides so pilots don't have
 *  to match capitalization when typing e.g. "PANC-PABE".
 */
export function useTypeToConfirm({
  expected,
  label,
  placeholder,
}: {
  expected: string;
  label: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const normalized = value.trim().toLowerCase();
  const expectedNorm = expected.trim().toLowerCase();
  const isConfirmed = normalized === expectedNorm && normalized.length > 0;

  const input = (
    <label className="block">
      <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label} —{" "}
        <span className="font-mono text-foreground">{expected}</span>
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? expected}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={value.length > 0 && !isConfirmed}
        className={
          "w-full rounded-md border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none " +
          (isConfirmed
            ? "border-status-green/60 focus:border-status-green"
            : value.length > 0
              ? "border-status-red/40 focus:border-status-red"
              : "border-border focus:border-status-blue")
        }
      />
    </label>
  );

  return { input, isConfirmed, value };
}
