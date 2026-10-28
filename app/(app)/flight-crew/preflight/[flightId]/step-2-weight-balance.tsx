"use client";

import { useState, useTransition } from "react";

import { linkCaps } from "@/components/ff/controls";
import { SetupNotice } from "@/components/ff/setup-notice";
import type { FlightLoad } from "@/lib/api/manifest";
import type { FlightDetail, WeightReturn } from "@/lib/api/types";
import { crewWeightNote } from "@/lib/flights/crew-weight";
import { fuelEstimateLine, fuelPlanningNote } from "@/lib/flights/fuel-estimate";
import { payloadAllowance } from "@/lib/preflight/payload-allowance";

import { completeStepAction, returnFlightOverWeightAction } from "./actions";

interface Props {
  flightId: string;
  flight: FlightDetail;
  /** An existing open return, if the pilot already handed this back. */
  openReturn: WeightReturn | null;
  /** The flight's weight and balance (#111): useful load less crew,
   *  fuel and the manifest's payload. Null when it couldn't be read; the
   *  step then shows the aircraft's useful load, as before. */
  load?: FlightLoad | null;
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
export function WeightAndBalanceStep({ flightId, flight, openReturn, load = null }: Props) {
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

        {load ? (
          <LoadBreakdown flight={flight} data={load} />
        ) : (
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
        )}

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

const lbs = (value: string | number) => `${Math.round(Number(value)).toLocaleString("en-US")} lb`;

/**
 * The client's arithmetic (#111), 22 Oct: "9062lb (Max Gross Weight) -
 * 200lbs (pilot) - 1000lbs (fuel) - 5335lbs (plane empty weight) =
 * 2527lbs Max Payload", then what is on board against it: the checked-in
 * passengers at their weighed weights, anyone still to check in at their
 * booked weights, cargo and mail. The figures are the manifest's (#74,
 * #75); the pilot still runs the numbers and records the verdict below.
 */
function LoadBreakdown({ flight, data }: { flight: FlightDetail; data: FlightLoad }) {
  const { load } = data;
  const useful = load.useful_load_lbs;
  if (useful == null) {
    // #138: the same notice as the manifest's, which the assistant sees.
    return (
      <SetupNotice
        place="fleet"
        missing={`${flight.aircraft.tail_number}’s useful load (its max gross and empty weight)`}
        stops="its payload can’t be worked out here"
      />
    );
  }
  const crew = Number(load.crew_lbs);
  const fuel = load.fuel_lbs != null ? Number(load.fuel_lbs) : null;
  const maxPayload = useful - crew - (fuel ?? 0);
  const remaining = load.remaining_lbs != null ? Number(load.remaining_lbs) : null;
  const crewNote = crewWeightNote(load);
  const fuelNote =
    load.fuel_basis === "planned"
      ? "planned by dispatch"
      : load.fuel_basis === "estimated" && load.fuel_estimate
        ? `recommended. ${fuelEstimateLine(load.fuel_estimate)} ${fuelPlanningNote(load.fuel_estimate, flight)}`
        : load.fuel_estimate?.missing.length
          ? `not worked out: set ${load.fuel_estimate.missing.join(" and ")}`
          : "not worked out";

  return (
    <div className="rounded-md border border-border px-4 py-3 text-xs">
      <table className="w-full">
        <caption className="eyebrow mb-2 text-left">Payload</caption>
        <tbody className="divide-y divide-border">
          {load.max_gross_weight_lbs != null && load.empty_weight_lbs != null ? (
            <>
              <Line label="Max gross weight" value={lbs(load.max_gross_weight_lbs)} />
              <Line label="− Empty weight" value={lbs(load.empty_weight_lbs)} />
            </>
          ) : (
            <Line label="Useful load" value={lbs(useful)} note="max gross less empty weight, under Settings → Fleet" />
          )}
          <Line label="− Pilot and crew" value={lbs(crew)} note={crewNote} />
          <Line label="− Fuel" value={fuel != null ? lbs(fuel) : "—"} note={fuelNote} />
          <Line
            label={fuel != null ? "= Max payload" : "= Max payload, before fuel"}
            value={lbs(maxPayload)}
            strong
          />
        </tbody>
      </table>

      <table className="mt-3 w-full">
        <caption className="eyebrow mb-2 text-left">On Board</caption>
        <tbody className="divide-y divide-border">
          {data.has_manifest ? (
            <>
              <Line
                label="Passengers checked in"
                value={lbs(Number(data.checked_in.weight_lbs) + Number(data.checked_in.baggage_lbs))}
                note={`${data.checked_in.count} at their weighed weights, ${lbs(data.checked_in.baggage_lbs)} of it bags`}
              />
              {data.to_check_in.count > 0 ? (
                <Line
                  label="Still to check in"
                  value={lbs(Number(data.to_check_in.weight_lbs) + Number(data.to_check_in.baggage_lbs))}
                  note={`${data.to_check_in.count} at their booked weights`}
                />
              ) : null}
              <Line label="Cargo and mail" value={lbs(data.cargo_lbs)} />
              <Line label="= Load" value={lbs(load.payload_lbs)} strong />
            </>
          ) : (
            <Line
              label="Passengers"
              value="—"
              note={`${data.booked_passengers} booked; no manifest yet, so no weights`}
            />
          )}
        </tbody>
      </table>

      {data.has_manifest && remaining != null ? (
        <p
          className={`mt-3 border-t border-border pt-2 text-[0.75rem] font-semibold ${
            remaining < 0 ? "text-status-red" : "text-status-green"
          }`}
        >
          {remaining < 0
            ? `Over the max payload by ${lbs(-remaining)}.`
            : `${lbs(remaining)} under the max payload.`}
          {fuel == null ? " Fuel isn’t counted yet." : ""}
        </p>
      ) : null}
      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        The manifest’s figures. Your own weight and balance decides; record it below.
      </p>
    </div>
  );
}

function Line({
  label,
  value,
  note,
  strong = false,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
}) {
  return (
    <tr>
      <th scope="row" className={`py-1.5 pr-3 text-left align-top ${strong ? "font-semibold text-foreground" : "font-normal text-muted-foreground"}`}>
        {label}
        {note ? <span className="block text-[0.68rem] font-normal text-muted-foreground">{note}</span> : null}
      </th>
      <td className={`py-1.5 text-right align-top font-mono tabular-nums ${strong ? "font-semibold text-foreground" : "text-foreground"}`}>
        {value}
      </td>
    </tr>
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
