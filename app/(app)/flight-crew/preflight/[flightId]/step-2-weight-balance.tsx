"use client";

import { useState, useTransition } from "react";

import type { FlightDetail } from "@/lib/api/types";

import { completeStepAction } from "./actions";

interface Props {
  flightId: string;
  flight: FlightDetail;
}

/**
 * Step 2 — Weight and Balance Review (Spec 4 §"The 8 steps / 2").
 *
 * Spec gate: pilot checks "I confirm the aircraft is within limits
 * for this flight." If any value exceeds limits the spec calls for
 * a RED WARNING + supervisor acknowledgment. For this MVP we don't
 * yet have the W&B math (lives with the elog Tab 3 logic), so we
 * render a placeholder W&B summary using the flight + aircraft
 * payload values that ARE on hand, and surface an "Over limits?"
 * toggle that switches the ack flow to require a supervisor name
 * + override note.
 *
 * The full W&B math (CG calc, fuel weight conversion, APE III gross
 * weight, ramp/takeoff/landing/zero-fuel limit checking) lands
 * alongside Spec 4 §"ELECTRONIC FLIGHT LOG / Tab 3 — Weight and
 * Balance" because the calculation engine + envelope graph is
 * shared between this step and the elog.
 */
export function WeightAndBalanceStep({ flightId, flight }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [overLimits, setOverLimits] = useState(false);
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorNote, setSupervisorNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const overrideOk =
    !overLimits ||
    (supervisorName.trim().length > 0 && supervisorNote.trim().length > 10);
  const canSubmit = confirmed && overrideOk && !pending;

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeStepAction(flightId, 2, {
        confirmed_within_limits: confirmed && !overLimits,
        over_limits: overLimits,
        supervisor_name: overLimits ? supervisorName.trim() : null,
        supervisor_note: overLimits ? supervisorNote.trim() : null,
        acknowledged_at: new Date().toISOString(),
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save — try again.");
      }
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
          Confirm the aircraft is within weight + balance limits for
          this flight. The full W&amp;B calculation engine lands with
          the electronic flight log (Tab 3); for now this step
          surfaces the planned payload and asks for your
          acknowledgment.
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

        <label className="flex items-start gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-status-blue"
          />
          <span>
            I confirm the aircraft is within limits for this flight.
          </span>
        </label>

        {/* Over-limits switch — when on, supervisor name + note required.
            Spec 4: "If any value exceeds limits: RED WARNING — weight
            exceeds limits. Contact dispatch. Over limits needs
            supervisor acknowledgment." */}
        <div className="rounded-md border border-status-yellow/40 bg-status-yellow/5 px-3 py-2 text-xs">
          <label className="flex items-center gap-2 text-status-yellow">
            <input
              type="checkbox"
              checked={overLimits}
              onChange={(e) => setOverLimits(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-status-yellow"
            />
            <span>
              <strong className="uppercase tracking-[0.04em]">
                Over limits
              </strong>{" "}
              — supervisor acknowledgment required
            </span>
          </label>

          {overLimits && (
            <div className="mt-3 space-y-2 border-t border-status-yellow/20 pt-3">
              <Field
                label="Supervisor name"
                value={supervisorName}
                onChange={setSupervisorName}
                placeholder="Director of Ops or Chief Pilot"
              />
              <Field
                label="Override note (min 10 chars)"
                value={supervisorNote}
                onChange={setSupervisorNote}
                placeholder="Why this exceedance is acceptable for the flight"
                multiline
              />
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="inline-flex w-full items-center justify-center rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Continue to Step 3 →"}
        </button>

        {error && (
          <p role="alert" className="text-xs text-status-red">
            {error}
          </p>
        )}
      </div>
    </section>
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-status-yellow focus:outline-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-status-yellow focus:outline-none"
        />
      )}
    </div>
  );
}
