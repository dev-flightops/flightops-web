"use client";

import { useState, useTransition } from "react";

import { linkCaps } from "@/components/ff/controls";
import type { FlightDetail, WeightReturn } from "@/lib/api/types";
import { payloadAllowance } from "@/lib/preflight/payload-allowance";

import { completeStepAction, returnFlightOverWeightAction } from "./actions";

interface Props {
  flightId: string;
  flight: FlightDetail;
  /** An existing open return, if the pilot already handed this back. */
  openReturn: WeightReturn | null;
}

type Verdict = "within" | "over";

/**
 * Step 2 — Weight and Balance Review.
 *
 * Pass/fail. There is deliberately no override.
 *
 * This step used to offer an "over limits" toggle that collected a
 * supervisor name and a justification note and then let the flight
 * continue. The operator asked for that to go (bug report 8/24, restated
 * 8/25) and they are right: nothing signs an aircraft above max gross
 * weight into compliance under Part 135 — the weight comes off, or the
 * flight doesn't go. Spec 4 called for supervisor acknowledgment; that
 * part of the spec is wrong and the deviation is deliberate.
 *
 * On fail the pilot states the payload they CAN take, which is the number
 * dispatch needs to re-plan the load, and the flight goes back to them.
 * Step 2 stays open until dispatch resolves it — enforced server-side too,
 * so a stale tab can't walk past it.
 *
 * The full W&B math (CG calc, fuel weight conversion, gross weight,
 * ramp/takeoff/landing/zero-fuel limits) still lands with the electronic
 * flight log Tab 3, which shares the calculation engine. Until then the
 * pilot runs the numbers and records the verdict.
 */
export function WeightAndBalanceStep({ flightId, flight, openReturn }: Props) {
  // What the operator's payload limit leaves for passengers, once the
  // cargo is off it. Null when the aircraft has no recorded limit.
  const allowance = payloadAllowance({
    maxPayloadLbs: flight.max_payload_lbs,
    paxCount: flight.pax_count,
    cargoLbs: flight.cargo_lbs,
  });
  const [verdict, setVerdict] = useState<Verdict | null>(
    openReturn ? "over" : null,
  );
  const [maxPayload, setMaxPayload] = useState(
    openReturn ? String(Number(openReturn.max_payload_lbs)) : "",
  );
  const [note, setNote] = useState(openReturn?.note ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [returned, setReturned] = useState<WeightReturn | null>(openReturn);

  const payloadLbs = Number(maxPayload);
  const payloadValid =
    maxPayload.trim() !== "" && Number.isFinite(payloadLbs) && payloadLbs > 0;

  const canContinue = verdict === "within" && !pending;
  const canReturn = verdict === "over" && payloadValid && !pending;

  const handleContinue = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeStepAction(flightId, 2, {
        confirmed_within_limits: true,
        acknowledged_at: new Date().toISOString(),
      });
      if (!result.ok) setError(result.error ?? "Couldn't save — try again.");
    });
  };

  const handleReturn = () => {
    setError(null);
    startTransition(async () => {
      const result = await returnFlightOverWeightAction(flightId, {
        max_payload_lbs: payloadLbs,
        note: note.trim() || null,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't send — try again.");
        return;
      }
      setReturned(result.weightReturn ?? null);
    });
  };

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="eyebrow">Step 2</p>
        <h2 className="caption-caps mt-1 text-lg text-foreground">Weight and Balance Review</h2>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        <p className="text-muted-foreground">
          Run the weight &amp; balance for this flight and record the
          result. If the aircraft is over limits it goes back to dispatch
          to be re-planned — there is no override.
        </p>

        <div className="rounded-md border border-border px-4 py-3 text-xs">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <Item label="Aircraft" value={flight.aircraft.tail_number} />
            <Item
              label="Max payload"
              value={
                flight.max_payload_lbs != null
                  ? `${flight.max_payload_lbs.toLocaleString()} lbs`
                  : "—"
              }
            />
            <Item label="Pax" value={String(flight.pax_count ?? 0)} />
            <Item
              label="Cargo"
              value={`${(flight.cargo_lbs ?? 0).toLocaleString()} lbs`}
            />
          </dl>

          {/* The arithmetic, done. These four numbers were shown and
              the pilot was left to combine them on a ramp. What is NOT
              done is totalling the load: that needs a weight per
              passenger, and the only honest sources are a manifest
              (none on most flights) or the operator's standard weight
              from their ops specs (which we do not hold). Inventing
              190 lb inside a weight-and-balance decision is the trade
              the manifest model already refuses — "default weights are
              legacy behavior we skip in favor of explicit-only". */}
          {allowance ? (
            <p className="mt-3 border-t border-border pt-2 text-[0.7rem] leading-relaxed">
              {allowance.cargoAloneExceedsPayload ? (
                <span className="text-status-red">
                  Cargo alone is{" "}
                  <span className="font-semibold tabular-nums">
                    {Math.abs(allowance.remainingForPaxLbs).toLocaleString()} lbs
                  </span>{" "}
                  over the payload, before any passengers.
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Leaves{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {allowance.remainingForPaxLbs.toLocaleString()} lbs
                  </span>{" "}
                  for passengers
                  {allowance.perPassengerLbs != null ? (
                    <>
                      {" — "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {allowance.perPassengerLbs} lbs
                      </span>{" "}
                      average each across {flight.pax_count}.
                    </>
                  ) : (
                    "."
                  )}{" "}
                  <span className="text-muted-foreground">
                    Actual weights come from the manifest or your
                    loading schedule — this is what your payload limit
                    leaves room for, not a verdict.
                  </span>
                </span>
              )}
            </p>
          ) : null}
        </div>

        {returned ? (
          <ReturnedNotice
            weightReturn={returned}
            onRevise={() => setReturned(null)}
          />
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="eyebrow mb-2">
                Weight &amp; balance result
              </legend>

              <VerdictOption
                name="wb-verdict"
                checked={verdict === "within"}
                onSelect={() => setVerdict("within")}
                tone="green"
                title="Within limits"
                detail="The aircraft is within weight and balance for this flight as loaded."
              />
              <VerdictOption
                name="wb-verdict"
                checked={verdict === "over"}
                onSelect={() => setVerdict("over")}
                tone="red"
                title="Over limits — weight must come off"
                detail="Return the flight to dispatch with the payload you can accept."
              />
            </fieldset>

            {verdict === "over" && (
              <div className="notice notice-red space-y-3">
                <p className="text-xs font-semibold">
                  This flight cannot depart as loaded. Dispatch will
                  re-plan against the figure you give here.
                </p>
                <div>
                  <label
                    htmlFor="max-payload"
                    className="field-label"
                  >
                    Max payload you can accept (lbs)
                  </label>
                  <input
                    id="max-payload"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="0.1"
                    value={maxPayload}
                    onChange={(e) => setMaxPayload(e.target.value)}
                    placeholder="e.g. 1750"
                    className="ff-input px-2 py-1.5 text-sm focus:border-status-red"
                  />
                </div>
                <div>
                  <label
                    htmlFor="wb-note"
                    className="field-label"
                  >
                    Note for dispatch (optional)
                  </label>
                  <textarea
                    id="wb-note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything dispatch needs to know about the load"
                    className="ff-input px-2 py-1 text-xs focus:border-status-red"
                  />
                </div>
              </div>
            )}

            {verdict === "over" ? (
              <button
                type="button"
                disabled={!canReturn}
                onClick={handleReturn}
                className="btn-caps inline-flex w-full items-center justify-center rounded-md bg-status-red-fill px-4 py-2.5 text-white transition-opacity hover:brightness-95 disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send back to dispatch"}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canContinue}
                onClick={handleContinue}
                className="btn-caps inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-white transition-opacity hover:bg-brand-dark disabled:opacity-50"
              >
                {pending ? "Saving…" : "Continue to Step 3 →"}
              </button>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function ReturnedNotice({
  weightReturn,
  onRevise,
}: {
  weightReturn: WeightReturn;
  onRevise: () => void;
}) {
  return (
    <div className="notice notice-red space-y-3">
      <p className="notice-label">Returned to dispatch</p>
      <p className="text-sm text-foreground">
        You can accept{" "}
        <strong className="font-mono">
          {Number(weightReturn.max_payload_lbs).toLocaleString()} lbs
        </strong>
        . Dispatch has to re-plan the load before this flight can continue.
      </p>
      {weightReturn.note && (
        <p className="text-xs italic text-muted-foreground">
          “{weightReturn.note}”
        </p>
      )}
      <button
        type="button"
        onClick={onRevise}
        className={linkCaps}
      >
        Revise the figure
      </button>
    </div>
  );
}

function VerdictOption({
  name,
  checked,
  onSelect,
  tone,
  title,
  detail,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  tone: "green" | "red";
  title: string;
  detail: string;
}) {
  // The choice made shows on a 3px edge in its colour (#81), not a wash.
  const ring = checked
    ? tone === "green"
      ? "border-l-status-green bg-accent/40"
      : "border-l-status-red bg-accent/40"
    : "border-l-input";
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-md border border-border border-l-[3px] px-3 py-2.5 transition-colors hover:bg-accent/40 ${ring}`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className={`mt-0.5 h-4 w-4 cursor-pointer ${
          tone === "green" ? "accent-status-green" : "accent-status-red"
        }`}
      />
      <span>
        <span
          className={`block text-xs font-semibold ${
            tone === "green" ? "text-status-green" : "text-status-red"
          }`}
        >
          {title}
        </span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">
        {label}
      </dt>
      <dd className="m-0 font-mono text-foreground">{value}</dd>
    </div>
  );
}
