"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { FratThresholdConfigResponse } from "@/lib/api/types";

import type { FratPolicyInput, SaveThresholdsState } from "./actions";

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
  min = 1,
  step,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  value: number;
  max: number;
  /** The near-limit margin is legitimately 0 — no margin means only a
   *  wind over the limit scores the top band — so min is not always 1. */
  min?: number;
  /** Visibility is in miles and reads in halves; everything else is
   *  whole units. */
  step?: number;
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
        min={min}
        max={max}
        step={step}
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
  saveAction: (input: FratPolicyInput) => Promise<SaveThresholdsState>;
}) {
  const router = useRouter();
  const [state, setState] = useState<SaveThresholdsState | null>(null);
  const [pending, setPending] = useState(false);

  const [medium, setMedium] = useState(config.medium_entry_score);
  const [high, setHigh] = useState(config.high_entry_score);
  const [extreme, setExtreme] = useState(config.extreme_entry_score);
  const [crosswindSingleKt, setCrosswindSingleKt] = useState(
    config.crosswind_single_engine_kt,
  );
  const [crosswindMultiKt, setCrosswindMultiKt] = useState(
    config.crosswind_multi_engine_kt,
  );
  const [nearMarginKt, setNearMarginKt] = useState(
    config.crosswind_near_margin_kt,
  );
  const [vfrMinCeilingFt, setVfrMinCeilingFt] = useState(
    config.vfr_min_ceiling_ft,
  );
  const [vfrMinVisibilitySm, setVfrMinVisibilitySm] = useState(
    config.vfr_min_visibility_sm,
  );
  const [blockValidityHours, setBlockValidityHours] = useState(
    config.block_validity_hours,
  );
  const [rationale, setRationale] = useState(config.rationale ?? "");

  const max = config.max_total_score;
  const ordered = medium >= 1 && medium < high && high < extreme && extreme <= max;

  // One margin serves both limits, so it has to clear the tighter one.
  const tighterLimit = Math.min(crosswindSingleKt, crosswindMultiKt);
  const marginFits = nearMarginKt >= 0 && nearMarginKt < tighterLimit;
  const limitsInRange =
    crosswindSingleKt >= 1 &&
    crosswindSingleKt <= 60 &&
    crosswindMultiKt >= 1 &&
    crosswindMultiKt <= 60 &&
    vfrMinCeilingFt >= 0 &&
    vfrMinCeilingFt <= 10000 &&
    vfrMinVisibilitySm >= 0 &&
    vfrMinVisibilitySm <= 10 &&
    blockValidityHours >= 0 &&
    blockValidityHours <= 24;
  const savable = ordered && marginFits && limitsInRange;

  const isDefault =
    medium === config.default_medium_entry_score &&
    high === config.default_high_entry_score &&
    extreme === config.default_extreme_entry_score &&
    crosswindSingleKt === config.default_crosswind_single_engine_kt &&
    crosswindMultiKt === config.default_crosswind_multi_engine_kt &&
    nearMarginKt === config.default_crosswind_near_margin_kt &&
    vfrMinCeilingFt === config.default_vfr_min_ceiling_ft &&
    vfrMinVisibilitySm === config.default_vfr_min_visibility_sm &&
    blockValidityHours === config.default_block_validity_hours;

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
    const next = await saveAction({
      medium,
      high,
      extreme,
      crosswindSingleKt,
      crosswindMultiKt,
      nearMarginKt,
      vfrMinCeilingFt,
      vfrMinVisibilitySm,
      blockValidityHours,
      rationale,
    });
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

      {/* Company operating limits.
          These are a different kind of number from the bands above: a
          band scores the total, a limit scores one factor. They sit on
          the same screen because they are one operator policy with one
          adoption record, and the server takes them in one save.

          The operator, 22 Sep 2026: "demonstrated does not limit us...
          Our single engine x wind limits are 30kts multi engines are
          35kts. That's a company limit." */}
      <div className="border-t border-border pt-5">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Company operating limits
        </p>
        <p className="mt-1 text-[0.68rem] text-muted-foreground">
          What individual factors are scored against. These are your
          limits, not the aircraft&rsquo;s demonstrated figures &mdash;
          a demonstrated crosswind is what a test pilot showed in
          certification, not a ceiling you are bound by.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field
            name="crosswind_single_engine_kt"
            label="Single-engine crosswind (kt)"
            hint="Your company limit for single-engine aircraft."
            value={crosswindSingleKt}
            min={1}
            max={60}
            onChange={setCrosswindSingleKt}
          />
          <Field
            name="crosswind_multi_engine_kt"
            label="Multi-engine crosswind (kt)"
            hint="Applies to anything with more than one engine."
            value={crosswindMultiKt}
            min={1}
            max={60}
            onChange={setCrosswindMultiKt}
          />
          <Field
            name="crosswind_near_margin_kt"
            label="&ldquo;Near the limit&rdquo; margin (kt)"
            hint="How close to the limit counts as near."
            value={nearMarginKt}
            min={0}
            max={59}
            onChange={setNearMarginKt}
          />
        </div>

        {marginFits && limitsInRange ? (
          <p className="mt-2 text-[0.68rem] text-muted-foreground">
            A single-engine flight scores near the limit from{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {crosswindSingleKt - nearMarginKt} kt
            </span>{" "}
            and over it above{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {crosswindSingleKt} kt
            </span>
            ; multi-engine from{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {crosswindMultiKt - nearMarginKt} kt
            </span>{" "}
            and above{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {crosswindMultiKt} kt
            </span>
            .
          </p>
        ) : (
          <p className="mt-2 text-[0.7rem] text-status-red">
            The margin has to be smaller than the lower crosswind limit
            ({tighterLimit} kt). Subtracting it from the limit is what
            finds where &ldquo;near&rdquo; begins, so a margin that big
            would make every wind &mdash; calm included &mdash; count as
            near the limit.
          </p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            name="vfr_min_ceiling_ft"
            label="VFR ceiling floor (ft)"
            hint="Below this, a VFR flight is elevated risk."
            value={vfrMinCeilingFt}
            min={0}
            max={10000}
            step={100}
            onChange={setVfrMinCeilingFt}
          />
          <Field
            name="vfr_min_visibility_sm"
            label="VFR visibility floor (sm)"
            hint="Either one alone is enough to elevate it."
            value={vfrMinVisibilitySm}
            min={0}
            max={10}
            step={0.5}
            onChange={setVfrMinVisibilitySm}
          />
        </div>

        <p className="mt-2 text-[0.65rem] text-muted-foreground/80">
          IFR flights below approach minimums are elevated risk too, and
          are not scored here: approach minima are per airport and per
          procedure from your ops specs, and the system holds none. A
          single company-wide number would be wrong at every airport it
          was applied to.
        </p>
      </div>

      {/* Block validity. Its own block rather than a sixth cell in the
          limits grid: a limit scores one factor of one assessment,
          this decides how long a whole assessment stays usable. */}
      <div className="rounded-lg border border-border bg-background/40 px-4 py-3">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Carrying a FRAT across legs
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field
            name="block_validity_hours"
            label="Block validity (hours)"
            hint="0 turns blocks off — every leg gets its own."
            value={blockValidityHours}
            min={0}
            max={24}
            step={1}
            onChange={setBlockValidityHours}
          />
          <p className="self-center text-[0.68rem] text-muted-foreground">
            {blockValidityHours === 0 ? (
              <>
                Blocks are off. Every leg gets its own assessment, and
                no pilot is offered a carry-forward.
              </>
            ) : (
              <>
                A filed FRAT can be carried to a later leg for{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {blockValidityHours}{" "}
                  {blockValidityHours === 1 ? "hour" : "hours"}
                </span>
                , and only while nothing the system scores has worsened.
              </>
            )}
          </p>
        </div>
        <p className="mt-2 text-[0.65rem] text-muted-foreground/80">
          An aircraft swap, a crew change and new NOTAMs are not
          checked &mdash; the system cannot score them yet, so the pilot
          is told what was compared rather than told the block is safe.
        </p>
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
          disabled={pending || !savable}
          className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
        >
          {pending
            ? "Saving…"
            : config.adopted_at
              ? "Save FRAT policy"
              : "Adopt this FRAT policy"}
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
