"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { findAirport } from "@/lib/airports";
import type { AircraftListItem } from "@/lib/api/types";
import type { ScheduleRoute } from "@/lib/api/master-schedule";
import { legSummary, planLegs } from "@/lib/flights/leg-times";
import { type ZoneTable, zoneFor, zoneName } from "@/lib/format/local-time";
import { DAY_LABELS, isRoundTrip } from "@/lib/schedule/master";

import { saveRouteAction, type ScheduleFormState } from "../actions";

const _initial: ScheduleFormState = { status: "idle", attempt: 0 };

/** Any day, for the planner's arithmetic: only the clock is kept. UTC, so
 *  no clock change falls in the middle of a leg. */
const ANY_DAY = "2026-01-15";

const AIRPORT = /^[A-Z0-9]{3,4}$/;

interface LegRow {
  destination: string;
  departs: string;
  arrives: string;
  /** The way home on a round trip: it follows the origin. */
  returning?: boolean;
}

function clockOf(local: string | null): string | null {
  return local ? local.slice(11, 16) : null;
}

/**
 * Add a flight to a schedule, or change one. Legacy's fields, less PIC, SIC and
 * seats (app/master_schedule.py in ops says why), and built as + New Flight is:
 * a round trip by default, and the times filled in from the aircraft's cruise
 * speed (#108). A time typed by hand is never overwritten.
 */
export function RouteForm({
  templateId,
  route,
  aircraft,
  zones,
  groundMinutes,
  onDone,
}: {
  templateId: string;
  /** The flight to change; none to add one. */
  route?: ScheduleRoute;
  aircraft: AircraftListItem[];
  zones: ZoneTable;
  groundMinutes: number;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveRouteAction, _initial);
  const [flightNumber, setFlightNumber] = useState(route?.flight_number ?? "");
  const [aircraftId, setAircraftId] = useState(route?.aircraft.id ?? "");
  const [origin, setOrigin] = useState(route?.legs[0]?.origin ?? "");
  const [roundTrip, setRoundTrip] = useState(route ? isRoundTrip(route.legs) : true);
  const [legs, setLegs] = useState<LegRow[]>(() =>
    route
      ? route.legs.map((leg, i, all) => ({
          destination: leg.destination,
          departs: leg.departs,
          arrives: leg.arrives,
          returning: i === all.length - 1 && isRoundTrip(all),
        }))
      : [{ destination: "", departs: "", arrives: "" }],
  );
  const [days, setDays] = useState<number[]>(route?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6]);
  const [isIfr, setIsIfr] = useState(route?.is_ifr ?? false);
  const [notes, setNotes] = useState(route?.notes ?? "");

  // Closing the form on a save, not on a failed one.
  const handled = useRef(0);
  useEffect(() => {
    if (state.status === "ok" && state.attempt !== handled.current) {
      handled.current = state.attempt;
      onDone();
    }
  }, [state, onDone]);

  // The way home: a last leg back to the origin once there is somewhere to
  // come back from, and off again when Round trip is unticked. It follows the
  // origin as the origin is typed, as on + New Flight (#132).
  const firstDestination = legs[0]?.destination ?? "";
  useEffect(() => {
    setLegs((current) => {
      const home = current.find((leg) => leg.returning);
      if (!roundTrip) return home ? current.filter((leg) => leg !== home) : current;
      if (!AIRPORT.test(origin) || !AIRPORT.test(firstDestination) || firstDestination === origin) return current;
      if (home) {
        return home.destination === origin
          ? current
          : current.map((leg) => (leg === home ? { ...leg, destination: origin } : leg));
      }
      return [...current, { destination: origin, departs: "", arrives: "", returning: true }];
    });
  }, [roundTrip, origin, firstDestination]);

  const plane = aircraft.find((a) => a.id === aircraftId) ?? null;
  const speed = plane?.cruise_speed_kt ?? null;
  const routeKey = [origin, ...legs.map((leg) => leg.destination)].join(",");
  const firstDeparts = legs[0]?.departs ?? "";
  const plan = useMemo(
    () =>
      planLegs({
        airports: routeKey.split(","),
        etd: firstDeparts ? `${ANY_DAY}T${firstDeparts}` : "",
        speedKt: speed,
        groundMinutes,
        timeZone: "UTC",
      }),
    [routeKey, firstDeparts, speed, groundMinutes],
  );

  // Each arrival and later departure from the plan. A time the dispatcher
  // typed differs from the one filled in, and stays.
  const filled = useRef<Record<string, string>>({});
  useEffect(() => {
    const take = (key: string, current: string, next: string | null): string => {
      if (!next) return current;
      if (current !== "" && current !== filled.current[key]) return current;
      filled.current[key] = next;
      return next;
    };
    setLegs((current) => {
      let changed = false;
      const next = current.map((leg, i) => {
        const planned = plan[i];
        if (!planned) return leg;
        const departs = i === 0 ? leg.departs : take(`departs-${i}`, leg.departs, clockOf(planned.departure));
        const arrives = take(`arrives-${i}`, leg.arrives, clockOf(planned.arrival));
        if (departs === leg.departs && arrives === leg.arrives) return leg;
        changed = true;
        return { ...leg, departs, arrives };
      });
      return changed ? next : current;
    });
  }, [plan]);

  function setLeg(i: number, patch: Partial<LegRow>) {
    setLegs((current) => current.map((leg, n) => (n === i ? { ...leg, ...patch } : leg)));
  }

  /** Sending the way home somewhere else, or taking it off, unticks Round trip:
   *  what is left is an ordinary stop. */
  function setDestination(i: number, destination: string) {
    if (legs[i]?.returning && destination !== origin) {
      setRoundTrip(false);
      setLeg(i, { destination, returning: false });
      return;
    }
    setLeg(i, { destination });
  }

  function removeLeg(i: number) {
    if (legs[i]?.returning) setRoundTrip(false);
    setLegs((current) => current.filter((_, n) => n !== i));
  }

  /** A new stop goes before the way home. */
  function addStop() {
    setLegs((current) => {
      const blank: LegRow = { destination: "", departs: "", arrives: "" };
      const home = current.find((leg) => leg.returning);
      return home ? [...current.filter((leg) => leg !== home), blank, home] : [...current, blank];
    });
  }

  const timeZone = zoneFor(zones, origin);
  const airportHint = (code: string, leg: number): string | undefined => {
    if (!AIRPORT.test(code)) return undefined;
    const found = findAirport(code);
    const summary = legSummary(plan[leg]);
    if (!found) return "Not on the Alaska airport list: type the times";
    return summary ? `${found.name} · ${summary}` : found.name;
  };
  const timesNote = !plane
    ? "Pick the aircraft to fill in the times from its cruise speed."
    : speed
      ? `Times fill in at ${speed} kt, ${groundMinutes} min on the ground at each stop. Change any of them.`
      : `${plane.tail_number} has no cruise speed, so type the times.`;

  return (
    <form
      method="post"
      action={action}
      aria-label={route ? `Change ${route.flight_number}` : "Add flight"}
      className="space-y-4"
    >
      <input type="hidden" name="template_id" value={templateId} />
      {route ? <input type="hidden" name="route_id" value={route.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label>
          <span className="field-label">Flight number</span>
          <input
            name="flight_number"
            required
            maxLength={12}
            value={flightNumber}
            onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
            placeholder="GV101"
            autoCapitalize="characters"
            spellCheck={false}
            className="ff-input px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="field-label">Aircraft</span>
          <select
            name="aircraft_id"
            required
            value={aircraftId}
            onChange={(e) => setAircraftId(e.target.value)}
            className="ff-input px-3 py-2 text-sm"
          >
            <option value="">Select aircraft…</option>
            {route && !aircraft.some((a) => a.id === route.aircraft.id) ? (
              <option value={route.aircraft.id}>{route.aircraft.tail_number} — not active</option>
            ) : null}
            {aircraft.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tail_number} — {a.model}
                {a.cruise_speed_kt == null ? " · no cruise speed: type the times" : ""}
              </option>
            ))}
          </select>
        </label>
        <div>
          <label>
            <span className="field-label">From</span>
            <input
              name="origin"
              required
              maxLength={4}
              value={origin}
              onChange={(e) => setOrigin(e.target.value.toUpperCase())}
              placeholder="PANC"
              autoCapitalize="characters"
              spellCheck={false}
              className="ff-input px-3 py-2 font-mono text-sm"
            />
          </label>
          {findAirport(origin) ? (
            <p className="mt-1 text-[0.65rem] text-muted-foreground">{findAirport(origin)?.name}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {legs.map((leg, i) => {
          const from = (i === 0 ? origin : legs[i - 1].destination) || "the previous stop";
          return (
            <fieldset key={i} aria-label={`Leg ${i + 1}`} className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="eyebrow">
                  Leg {i + 1} · from <span className="font-mono">{from}</span>
                </p>
                {legs.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeLeg(i)}
                    className="text-[0.65rem] font-semibold text-muted-foreground hover:text-status-red"
                  >
                    Remove<span className="sr-only"> leg {i + 1}</span>
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label>
                    <span className="field-label">To</span>
                    <input
                      name="leg_destination"
                      required
                      maxLength={4}
                      value={leg.destination}
                      onChange={(e) => setDestination(i, e.target.value.toUpperCase())}
                      placeholder="PABE"
                      autoCapitalize="characters"
                      spellCheck={false}
                      className="ff-input px-3 py-2 font-mono text-sm"
                    />
                  </label>
                  {airportHint(leg.destination, i) ? (
                    <p className="mt-1 text-[0.65rem] text-muted-foreground">{airportHint(leg.destination, i)}</p>
                  ) : null}
                </div>
                <label>
                  <span className="field-label">Departs</span>
                  <input
                    name="leg_departs"
                    type="time"
                    required
                    value={leg.departs}
                    onChange={(e) => setLeg(i, { departs: e.target.value })}
                    className="ff-input px-3 py-2 text-sm"
                  />
                </label>
                <label>
                  <span className="field-label">Arrives</span>
                  <input
                    name="leg_arrives"
                    type="time"
                    required
                    value={leg.arrives}
                    onChange={(e) => setLeg(i, { arrives: e.target.value })}
                    className="ff-input px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </fieldset>
          );
        })}
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={addStop} className={`${buttonOutline} px-3 py-1.5`}>
            + Add stop
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} />
            Round trip
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_ifr" checked={isIfr} onChange={(e) => setIsIfr(e.target.checked)} />
            Flown IFR
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {timesNote} Times are the clock at the departure base ({zoneName(timeZone)}), and hold through a clock change.
          An arrival earlier than its departure lands the next day.
        </p>
      </div>

      <fieldset>
        <legend className="field-label">Operates on</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {DAY_LABELS.map((label, day) => (
            <label key={label} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="dow"
                value={day}
                checked={days.includes(day)}
                onChange={(e) =>
                  setDays((current) => (e.target.checked ? [...current, day] : current.filter((d) => d !== day)))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="field-label">Notes</span>
        <input
          name="notes"
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional. Copied to each flight."
          className="ff-input px-3 py-2 text-sm"
        />
      </label>

      {state.status === "error" ? (
        <p role="alert" className="field-error">
          {state.message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={buttonOutline}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={`${buttonSolid} disabled:opacity-60`}>
          {pending ? "Saving…" : route ? "Save Flight" : "Add Flight"}
        </button>
      </div>
    </form>
  );
}
