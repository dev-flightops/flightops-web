"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import type { MorningResponse } from "@/lib/api/ops";
import { DEFAULT_TIME_ZONE, localClock } from "@/lib/format/local-time";

import { pickAircraftAction, recordPreflightAction } from "./actions";

/**
 * Your aircraft today (#93).
 *
 * The client, 21 Oct: "Pilots usually duty in for the day, go the airplane
 * to perform the preflight checks. Once run up in the morning, they can
 * then accept flights." After duty in the pilot takes an aircraft (only
 * those airworthy, at their base and not taken by another pilot today are
 * offered; the rest say why), then records its preflight and run-up. A
 * flight in an aircraft nobody has preflighted that day can't be accepted.
 */
export function MorningAircraft({ morning }: { morning: MorningResponse | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState("");

  if (morning === null) {
    return (
      <p className="text-xs text-muted-foreground">
        Your aircraft for today couldn&apos;t be read. Refresh to try again.
      </p>
    );
  }
  const mine = morning.mine;
  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.ok) router.refresh();
      else setError(result.error ?? "Something went wrong.");
    });
  };

  if (mine?.preflight_at) {
    const at = localClock(mine.preflight_at, DEFAULT_TIME_ZONE);
    const amounts = [
      mine.fuel_gallons != null ? `${Number(mine.fuel_gallons)} gal` : null,
      mine.oil_quarts != null ? `${Number(mine.oil_quarts)} qt oil` : null,
    ].filter(Boolean);
    return (
      <p className="text-sm text-foreground">
        <span className="font-mono font-semibold">{mine.tail_number}</span>
        {`: preflight and run-up recorded at ${at}${amounts.length ? ` (${amounts.join(", ")})` : ""}.`}
        {` Flights in it can be accepted today.`}
      </p>
    );
  }

  if (!morning.on_duty && !mine) {
    return (
      <p className="text-sm text-muted-foreground">
        Duty in, then take your aircraft for the day. Record its preflight and run-up here
        before you accept a flight in it.
      </p>
    );
  }

  const record = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mine) return;
    const form = new FormData(event.currentTarget);
    const num = (key: string) => {
      const value = String(form.get(key) ?? "").trim();
      return value === "" ? null : Number(value);
    };
    run(() =>
      recordPreflightAction(mine.id, {
        fuel_gallons: num("fuel_gallons"),
        oil_quarts: num("oil_quarts"),
        notes: String(form.get("notes") ?? "").trim() || null,
      }),
    );
  };

  return (
    <div className="space-y-4">
      {mine ? (
        <form onSubmit={record} className="grid gap-3 sm:grid-cols-2">
          <p className="text-sm text-foreground sm:col-span-2">
            <span className="font-mono font-semibold">{mine.tail_number}</span>
            {` is yours today. Record its preflight and run-up:`}
          </p>
          <label>
            <span className="field-label">Fuel on board (gal)</span>
            <input name="fuel_gallons" type="number" min={0} step="0.1" className="ff-input" />
          </label>
          <label>
            <span className="field-label">Oil (qt)</span>
            <input name="oil_quarts" type="number" min={0} step="0.5" className="ff-input" />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Notes</span>
            <input name="notes" type="text" maxLength={2000} className="ff-input" placeholder="Run-up normal" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={buttonSolid} disabled={pending}>
              {pending ? "Recording…" : "Record preflight and run-up"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[14rem] flex-1">
          <span className="field-label">{mine ? "Take another instead" : "Take an aircraft"}</span>
          <select className="ff-input" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="" disabled>
              — Choose —
            </option>
            {morning.options.map((o) => (
              <option key={o.aircraft_id} value={o.aircraft_id} disabled={!o.available}>
                {o.tail_number}
                {o.model ? ` · ${o.model}` : ""}
                {o.available ? "" : ` (${o.reason})`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={mine ? buttonOutline : buttonSolid}
          disabled={pending || !choice}
          onClick={() => run(() => pickAircraftAction(choice))}
        >
          {mine ? "Switch" : "Take it"}
        </button>
      </div>

      {error ? <Notice tone="red">{error}</Notice> : null}
    </div>
  );
}
