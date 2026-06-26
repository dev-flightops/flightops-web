"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import type { FlightLogUpdateRequest } from "@/lib/api/types";

import { updateSummaryAction } from "./summary-actions";

/**
 * Editable pilot-writable currency counters on Tab 4 (Spec 4
 * §"Flight Summary"). Save model matches the other elog tabs:
 * per-input local state, PATCH on blur with a diff against the
 * original, rollback on error.
 *
 * Empty input writes `null` (clears the field). The pilot can
 * distinguish "didn't enter yet" from "explicitly zero today" by
 * typing 0 vs leaving blank — the M2-M-9b currency recompute
 * treats those differently.
 *
 * Submitted-log mode disables all inputs so the pilot can read
 * what was reported without editing.
 */
export interface CurrencyCounters {
  night_takeoffs: number | null;
  approach_precision: number | null;
  approach_non_precision: number | null;
  holds: number | null;
  ifr_actual_minutes: number | null;
  ifr_simulated_minutes: number | null;
}

const FIELDS: ReadonlyArray<{
  key: keyof CurrencyCounters;
  label: string;
  hint?: string;
}> = [
  { key: "night_takeoffs", label: "Night T/O" },
  { key: "approach_precision", label: "Appr Precision", hint: "ILS / LPV" },
  {
    key: "approach_non_precision",
    label: "Appr Non-Prec",
    hint: "LNAV / VOR",
  },
  { key: "holds", label: "Holds" },
  { key: "ifr_actual_minutes", label: "IFR Actual", hint: "minutes" },
  { key: "ifr_simulated_minutes", label: "IFR Simulated", hint: "minutes" },
];

export function CurrencyCountersField({
  logId,
  initial,
  readOnly,
}: {
  logId: string;
  initial: CurrencyCounters;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = initial[f.key];
      seed[f.key] = v === null || v === undefined ? "" : String(v);
    }
    return seed;
  });

  function commit(key: keyof CurrencyCounters) {
    const raw = values[key];
    const originalRaw =
      initial[key] === null || initial[key] === undefined
        ? ""
        : String(initial[key]);
    if (raw === originalRaw) return; // no change → skip PATCH

    let payload: number | null;
    if (raw.trim() === "") {
      payload = null;
    } else {
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError("Counters must be 0 or a positive whole number.");
        setValues((v) => ({ ...v, [key]: originalRaw }));
        return;
      }
      payload = parsed;
    }

    startTransition(async () => {
      setError(null);
      const body: FlightLogUpdateRequest = { [key]: payload };
      const result = await updateSummaryAction(logId, body);
      if (result.status === "error") {
        setError(result.message);
        setValues((v) => ({ ...v, [key]: originalRaw }));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Pilot Entries — Currency Counters
        </div>
        {pending && (
          <span className="inline-flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
            <Spinner size="xs" /> Saving…
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <div className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {f.label}
              {f.hint ? (
                <span className="ml-1 font-normal text-muted-foreground/60">
                  ({f.hint})
                </span>
              ) : null}
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={values[f.key]}
              disabled={readOnly || pending}
              placeholder="—"
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
              onBlur={() => commit(f.key)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-center font-mono text-sm tabular-nums text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60"
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-[0.65rem] text-muted-foreground">
        Approaches, holds, and IFR time feed Spec 5 IFR currency. Leave
        blank if not flown / not yet entered.
      </p>
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
