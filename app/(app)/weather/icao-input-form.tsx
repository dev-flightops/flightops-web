"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { parseIcaos } from "@/lib/weather/icaos";

/**
 * ICAO input form on /weather (M2-G-24).
 *
 * The form is intentionally a client component so the typed input
 * stays alive across navigations (the server page reads the result
 * from the URL). On submit it does:
 *   1. Split + uppercase + dedupe ICAOs
 *   2. push(/weather?icaos=A,B,C) — server component re-renders
 *
 * `useTransition` makes the submit button pending while the server
 * component re-fetches, which avoids a jarring blank state between
 * the click and the new render.
 */
export function IcaoInputForm({
  initialIcaos,
}: {
  initialIcaos: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialIcaos.join(" "));
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const icaos = parseIcaos(value);
    if (icaos.length === 0) {
      setError("Enter at least one ICAO code.");
      return;
    }
    if (icaos.length > 10) {
      setError(
        `Maximum 10 airports per lookup (you entered ${icaos.length}).`,
      );
      return;
    }
    const qs = new URLSearchParams({ icaos: icaos.join(",") }).toString();
    startTransition(() => {
      router.push(`/weather?${qs}`);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <label
        htmlFor="icaos"
        className="block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        Airports (ICAO codes, space or comma separated)
      </label>
      <div className="flex gap-2">
        <input
          id="icaos"
          name="icaos"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="PANC PAEN PADU"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-status-blue focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending && <Spinner size="xs" />}
          {pending ? "Loading…" : "Get Weather"}
        </button>
      </div>
      <p className="text-[0.65rem] text-muted-foreground/70">
        Origin · destination · alternates. Up to 10 airports.
      </p>
      {error && (
        <p role="alert" className="text-[0.7rem] text-status-red">
          {error}
        </p>
      )}
    </form>
  );
}

