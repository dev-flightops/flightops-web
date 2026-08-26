"use client";

import { useState, useTransition } from "react";

import type { FlightDetail, WeightReturn } from "@/lib/api/types";

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
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Step 2
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Weight and Balance Review
        </h2>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        <p className="text-muted-foreground">
          Run the weight &amp; balance for this flight and record the
          result. If the aircraft is over limits it goes back to dispatch
          to be re-planned — there is no override.
        </p>

        <div className="rounded-lg border border-border bg-background px-4 py-3 text-xs">
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
        </div>

        {returned ? (
          <ReturnedNotice
            weightReturn={returned}
            onRevise={() => setReturned(null)}
          />
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
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
              <div className="space-y-3 rounded-md border border-status-red/40 bg-status-red/5 px-3 py-3">
                <p className="text-xs text-status-red">
                  This flight cannot depart as loaded. Dispatch will
                  re-plan against the figure you give here.
                </p>
                <div>
                  <label
                    htmlFor="max-payload"
                    className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
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
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-status-red focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="wb-note"
                    className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                  >
                    Note for dispatch (optional)
                  </label>
                  <textarea
                    id="wb-note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything dispatch needs to know about the load"
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-status-red focus:outline-none"
                  />
                </div>
              </div>
            )}

            {verdict === "over" ? (
              <button
                type="button"
                disabled={!canReturn}
                onClick={handleReturn}
                className="inline-flex w-full items-center justify-center rounded-md bg-status-red px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send back to dispatch"}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canContinue}
                onClick={handleContinue}
                className="inline-flex w-full items-center justify-center rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Continue to Step 3 →"}
              </button>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="text-xs text-status-red">
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
    <div className="space-y-3 rounded-md border border-status-red/40 bg-status-red/5 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-status-red">
        Returned to dispatch
      </p>
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
        className="text-xs font-semibold text-status-blue underline underline-offset-2 hover:brightness-110"
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
  const ring = checked
    ? tone === "green"
      ? "border-status-green/60 bg-status-green/5"
      : "border-status-red/60 bg-status-red/5"
    : "border-border bg-card/40";
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition ${ring}`}
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
      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 font-mono text-foreground">{value}</dd>
    </div>
  );
}
