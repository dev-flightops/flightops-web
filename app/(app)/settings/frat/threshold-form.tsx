"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { FratThresholdConfigResponse } from "@/lib/api/types";

import type { SaveThresholdsState } from "./actions";

/**
 * The three numbers, with a live picture of what they do.
 *
 * A threshold form without a preview asks somebody to hold four bands
 * and a 0–90 scale in their head. The bar below the inputs redraws as
 * they type, so moving EXTREME from 35 to 28 is visible as the red
 * band growing rather than as a number changing.
 *
 * Validated here as well as in the action and in the database. Three
 * places sounds excessive for one ordering rule until you note what
 * each is for: the form disables the button so a mistake never
 * becomes a round trip, the action answers a caller that bypassed the
 * form, and the CHECK constraint answers anything that bypassed the
 * service.
 */

const BANDS = [
  { key: "low", label: "Low", tone: "bg-status-green" },
  { key: "medium", label: "Medium", tone: "bg-status-yellow" },
  { key: "high", label: "High", tone: "bg-status-orange" },
  { key: "extreme", label: "Extreme", tone: "bg-status-red" },
] as const;

function Field({
  name,
  label,
  hint,
  value,
  max,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={1}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums text-foreground focus:border-status-blue focus:outline-none"
      />
      <p className="mt-1 text-[0.65rem] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function ThresholdForm({
  config,
  saveAction,
}: {
  config: FratThresholdConfigResponse;
  saveAction: (
    medium: number,
    high: number,
    extreme: number,
    rationale: string,
  ) => Promise<SaveThresholdsState>;
}) {
  const router = useRouter();
  const [state, setState] = useState<SaveThresholdsState | null>(null);
  const [pending, setPending] = useState(false);

  const [medium, setMedium] = useState(config.medium_entry_score);
  const [high, setHigh] = useState(config.high_entry_score);
  const [extreme, setExtreme] = useState(config.extreme_entry_score);
  const [rationale, setRationale] = useState(config.rationale ?? "");

  const max = config.max_total_score;
  const ordered = medium >= 1 && medium < high && high < extreme && extreme <= max;

  const isDefault =
    medium === config.default_medium_entry_score &&
    high === config.default_high_entry_score &&
    extreme === config.default_extreme_entry_score;

  // Widths as percentages of the reachable maximum, so the bar is to
  // scale rather than four equal blocks.
  const widths = {
    low: (medium / max) * 100,
    medium: ((high - medium) / max) * 100,
    high: ((extreme - high) / max) * 100,
    extreme: ((max - extreme) / max) * 100,
  };

  const submit = async () => {
    setPending(true);
    setState(null);
    const next = await saveAction(medium, high, extreme, rationale);
    setPending(false);
    setState(next);
    if (next.status === "saved") router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          name="medium_entry_score"
          label="Medium starts at"
          hint="Below this, a flight is Low."
          value={medium}
          max={max}
          onChange={setMedium}
        />
        <Field
          name="high_entry_score"
          label="High starts at"
          hint="Dispatch reviews the packet and may hold the release."
          value={high}
          max={max}
          onChange={setHigh}
        />
        <Field
          name="extreme_entry_score"
          label="Extreme starts at"
          hint="Cannot depart without Chief Pilot or DO authorisation."
          value={extreme}
          max={max}
          onChange={setExtreme}
        />
      </div>

      <div>
        <p className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          How a total score lands
        </p>
        {ordered ? (
          <>
            <div
              className="flex h-6 overflow-hidden rounded-md"
              role="img"
              aria-label={`Low below ${medium}, Medium ${medium} to ${high - 1}, High ${high} to ${extreme - 1}, Extreme ${extreme} and above, out of ${max}`}
            >
              {BANDS.map((band) => (
                <div
                  key={band.key}
                  data-testid={`band-${band.key}`}
                  className={band.tone}
                  style={{ width: `${widths[band.key]}%` }}
                  title={band.label}
                />
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] text-muted-foreground">
              <span>Low 0–{medium - 1}</span>
              <span>Medium {medium}–{high - 1}</span>
              <span>High {high}–{extreme - 1}</span>
              <span>Extreme {extreme}–{max}</span>
            </div>
          </>
        ) : (
          <p className="text-[0.7rem] text-status-red">
            Each band must start above the one before it, and Extreme
            cannot start above {max} — the highest total the
            questionnaire can produce. A band starting past that never
            fires.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="rationale"
          className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Why these numbers
        </label>
        <textarea
          id="rationale"
          name="rationale"
          rows={2}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Chief Pilot review, September 2026 — tightened the Extreme band after two flights that should have routed to the DO."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-status-blue focus:outline-none"
        />
        <p className="mt-1 text-[0.65rem] text-muted-foreground">
          Optional. Recorded with your name and the date, because
          nothing in the regulations sets these numbers — whoever signs
          the manual does.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !ordered}
          className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
        >
          {pending
            ? "Saving…"
            : config.adopted_at
              ? "Save thresholds"
              : "Adopt these thresholds"}
        </button>
        {!config.adopted_at && isDefault && (
          <p className="text-[0.7rem] text-muted-foreground">
            Saving unchanged still records that you reviewed and
            accepted them.
          </p>
        )}
      </div>

      {state?.status === "error" && (
        <p role="alert" className="text-[0.7rem] text-status-red">
          {state.message}
        </p>
      )}
      {state?.status === "saved" && (
        <p role="status" className="text-[0.7rem] text-status-green">
          Saved.
        </p>
      )}
    </div>
  );
}
