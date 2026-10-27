"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { findAirport } from "@/lib/airports";
import type { AircraftListItem } from "@/lib/api/types";
import { legSummary, planLegs } from "@/lib/flights/leg-times";
import {
  localToUtcIso,
  type ZoneTable,
  zoneAbbreviation,
  zoneFor,
  zuluHint,
} from "@/lib/format/local-time";

import {
  createFlightAction,
  type CreateFlightFormState,
  type SubmittedStop,
} from "./actions";
import { StopsEditor } from "./stops-editor";

/**
 * "+ Open Flight" form (M2-G-14). Client component because we want
 * useActionState for inline field errors and a pending state on the
 * submit button without a router round-trip.
 *
 * The form mirrors the legacy `templates/flight_following/flight_form.html`
 * new-flight branch with two intentional differences:
 *   - Aircraft is a select bound to the tenant's active aircraft list
 *     (legacy was a free-text "n_number" input — easy to typo).
 *   - PIC name is omitted: crew is assigned on the dispatch packet.
 *   - The route is legs, not a free-text box: "+ Add stop" adds a leg
 *     from the previous destination (client, 27 Sep: "there is not a
 *     way to build a multi leg route"). Legacy's text Route field was
 *     never read by anything.
 *   - Times are local at the departure base, with Zulu shown under each
 *     (client, 11 Oct: "Our dispatchers will be using their local time
 *     to book and create flights", #68). Legacy read them as UTC.
 *   - A round trip by default, and the times filled in from the
 *     aircraft's cruise speed (client, 22 Oct, #108): "Input destination
 *     and it automatically reroutes back to bethel after the
 *     destination ... if the system can build the times enroute based
 *     of standard cruise speeds". A time typed by hand is never
 *     overwritten.
 */
export function OpenFlightForm({
  aircraft,
  zones,
}: {
  aircraft: AircraftListItem[];
  /** Each base's zone, for the departure base the times are typed in. */
  zones: ZoneTable;
}) {
  const [state, action, pending] = useActionState<
    CreateFlightFormState,
    FormData
  >(createFlightAction, { status: "idle" });

  const fieldError = (field: string): string | undefined =>
    state.status === "field-errors" ? state.errors[field] : undefined;

  /**
   * What the field should show after a failed submit.
   *
   * Client bug report 9/17: "all the data drops from whatever you are
   * inputting and you need to reenter it all." These inputs are
   * uncontrolled, and React resets a form's DOM once the action on it
   * resolves — so without a defaultValue to restore from, one mistyped
   * ICAO cost the dispatcher the whole form: flight number, both
   * airports, both datetimes, pax, cargo and the notes.
   *
   * The action echoes the submitted values back on every failure, and
   * `submitted` is keyed by field name so each input reads its own
   * back. Success redirects, so there is nothing to restore then.
   */
  const submitted = (field: string, fallback = ""): string =>
    state.status === "idle" ? fallback : (state.values[field] ?? fallback);

  /**
   * Counts completed submissions, to key the aircraft select on.
   *
   * Restoring the text inputs needed nothing but a defaultValue. The
   * select needed this: React applies defaultValue on mount only, and
   * the DOM reset it performs after an action leaves a select showing
   * its first option again — "Select aircraft…", as if nothing had been
   * picked. Re-keying forces a remount so the echoed value is applied.
   *
   * Same shape as the fix on the employee record form, where two
   * selects silently blanked on save for the same reason.
   */
  const [submitCount, setSubmitCount] = useState(0);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) setSubmitCount((n) => n + 1);
    wasPending.current = pending;
  }, [pending]);

  // The legs after the first. Controlled, and put back from what the
  // action echoes after a failed submit, like every other field here.
  const [stops, setStops] = useState<SubmittedStop[]>([]);
  const [firstDestination, setFirstDestination] = useState("");
  // The origin decides the zone the times are typed in; the times are
  // kept to show each one in Zulu as it is typed.
  const [origin, setOrigin] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");
  // #108: the aircraft for its cruise speed, the way home, and the time
  // on the ground at each stop.
  const [aircraftId, setAircraftId] = useState("");
  const [roundTrip, setRoundTrip] = useState(true);
  const [groundMinutes, setGroundMinutes] = useState("15");
  useEffect(() => {
    if (state.status !== "idle") {
      const echoedOrigin = (state.values.origin ?? "").toUpperCase();
      const echoedRoundTrip = state.values.round_trip === "on";
      setStops(
        state.stops.map((stop, i, all) => ({
          ...stop,
          returning:
            echoedRoundTrip && i === all.length - 1 && stop.destination === echoedOrigin,
        })),
      );
      setFirstDestination((state.values.destination ?? "").toUpperCase());
      setOrigin(echoedOrigin);
      setEtd(state.values.scheduled_departure_at ?? "");
      setEta(state.values.scheduled_arrival_at ?? "");
      setAircraftId(state.values.aircraft_id ?? "");
      setRoundTrip(echoedRoundTrip);
      setGroundMinutes(state.values.ground_minutes ?? "15");
    }
  }, [state]);

  // The way home on a round trip: a last leg back to the origin, added
  // once there is somewhere to come back from, and taken off when the
  // box is unticked. A new origin moves it, unless it was changed.
  const lastOrigin = useRef(origin);
  useEffect(() => {
    const previous = lastOrigin.current;
    lastOrigin.current = origin;
    setStops((current) => {
      const home = current.find((s) => s.returning);
      if (!roundTrip) return home ? current.filter((s) => s !== home) : current;
      if (!isAirportCode(origin) || !isAirportCode(firstDestination) || firstDestination === origin) {
        return current;
      }
      if (home) {
        return home.destination === previous && previous !== origin
          ? current.map((s) => (s === home ? { ...s, destination: origin } : s))
          : current;
      }
      return [...current, { destination: origin, departure: "", arrival: "", returning: true }];
    });
  }, [roundTrip, origin, firstDestination]);

  /** A stop added after the way home goes before it; taking the way home
   *  off unticks Round trip. */
  function changeStops(next: SubmittedStop[]) {
    const home = next.find((s) => s.returning);
    if (roundTrip && !home) setRoundTrip(false);
    setStops(home && next[next.length - 1] !== home ? [...next.filter((s) => s !== home), home] : next);
  }

  const timeZone = zoneFor(zones, origin);
  const plane = aircraft.find((a) => a.id === aircraftId) ?? null;
  const speed = plane?.cruise_speed_kt ?? null;
  const routeKey = [origin, firstDestination, ...stops.map((s) => s.destination)].join(",");
  const plan = useMemo(
    () =>
      planLegs({
        airports: routeKey.split(","),
        etd,
        speedKt: speed,
        groundMinutes: Math.max(0, Number(groundMinutes) || 0),
        timeZone,
      }),
    [routeKey, etd, speed, groundMinutes, timeZone],
  );

  // Each arrival, and each later departure, from the plan. A time the
  // dispatcher typed differs from the one filled in, and stays.
  const filled = useRef<Record<string, string>>({});
  useEffect(() => {
    const take = (key: string, current: string, next: string | null): string => {
      if (!next) return current;
      if (current !== "" && current !== filled.current[key]) return current;
      filled.current[key] = next;
      return next;
    };
    setEta((current) => take("eta", current, plan[0]?.arrival ?? null));
    setStops((current) => {
      let changed = false;
      const next = current.map((stop, i) => {
        const leg = plan[i + 1];
        if (!leg) return stop;
        const departure = take(`departure-${i}`, stop.departure, leg.departure);
        const arrival = take(`arrival-${i}`, stop.arrival, leg.arrival);
        if (departure === stop.departure && arrival === stop.arrival) return stop;
        changed = true;
        return { ...stop, departure, arrival };
      });
      return changed ? next : current;
    });
  }, [plan]);

  const airportHint = (code: string, leg?: number): string | undefined => {
    if (!isAirportCode(code)) return undefined;
    const found = findAirport(code);
    const summary = leg != null ? legSummary(plan[leg]) : null;
    if (!found) return "Not on the Alaska airport list: type the times";
    return summary ? `${found.name} · ${summary}` : found.name;
  };
  const timesNote = !plane
    ? "Pick the aircraft to fill in the times from its cruise speed."
    : speed
      ? `Times fill in at ${speed} kt, ${Math.max(0, Number(groundMinutes) || 0)} min on the ground at each stop. Change any of them.`
      : `Set ${plane.tail_number}’s cruise speed under Settings → Fleet to fill in the times.`;
  const departs = localToUtcIso(etd, timeZone);
  const tz = zoneAbbreviation(timeZone, departs ? new Date(departs) : new Date());
  const errors = state.status === "field-errors" ? state.errors : {};

  return (
    <form action={action} className="space-y-5">
      {state.status === "api-error" && (
        <div
          role="alert"
          className="notice notice-red"
        >
          {state.message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="flight_number"
          label="Flight number"
          required
          placeholder="GV101"
          defaultValue={submitted("flight_number")}
          error={fieldError("flight_number")}
        />
        <FieldSelect
          key={`aircraft_id-${submitCount}`}
          name="aircraft_id"
          label="Aircraft"
          required
          defaultValue={submitted("aircraft_id")}
          onChange={setAircraftId}
          error={fieldError("aircraft_id")}
        >
          <option value="">Select aircraft…</option>
          {aircraft.map((a) => (
            <option key={a.id} value={a.id}>
              {a.tail_number} — {a.model}
            </option>
          ))}
        </FieldSelect>
        <Field
          name="origin"
          label="Origin"
          required
          placeholder="PANC"
          defaultValue={submitted("origin")}
          onChange={(e) => setOrigin(e.target.value.toUpperCase())}
          maxLength={4}
          autoCapitalize="characters"
          spellCheck={false}
          hint={airportHint(origin)}
          error={fieldError("origin")}
        />
        <Field
          name="destination"
          label={stops.length > 0 ? "Leg 1 destination" : "Destination"}
          required
          placeholder="PAEN"
          defaultValue={submitted("destination")}
          onChange={(e) => setFirstDestination(e.target.value.toUpperCase())}
          maxLength={4}
          autoCapitalize="characters"
          spellCheck={false}
          hint={airportHint(firstDestination, 0)}
          error={fieldError("destination")}
        />
        <Field
          name="scheduled_departure_at"
          label={`ETD (${tz})`}
          type="datetime-local"
          required
          defaultValue={submitted("scheduled_departure_at")}
          onChange={(e) => setEtd(e.target.value)}
          hint={zuluHint(etd, timeZone)}
          error={fieldError("scheduled_departure_at")}
        />
        <Field
          name="scheduled_arrival_at"
          label={stops.length > 0 ? `Leg 1 ETA (${tz})` : `ETA (${tz})`}
          type="datetime-local"
          required
          value={eta}
          onChange={(e) => setEta(e.target.value)}
          hint={zuluHint(eta, timeZone)}
          error={fieldError("scheduled_arrival_at")}
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:col-span-2">
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              name="round_trip"
              checked={roundTrip}
              onChange={(e) => setRoundTrip(e.target.checked)}
            />
            {`Round trip: back to ${isAirportCode(origin) ? origin : "the origin"}`}
          </label>
          <label className="flex items-center gap-2 text-xs text-foreground">
            Ground time at each stop
            <input
              type="number"
              name="ground_minutes"
              min={0}
              max={240}
              value={groundMinutes}
              onChange={(e) => setGroundMinutes(e.target.value)}
              className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
            />
            min
          </label>
          <p className="text-[0.65rem] text-muted-foreground">{timesNote}</p>
        </div>
        <div className="md:col-span-2">
          <StopsEditor
            key={`stops-${submitCount}`}
            stops={stops}
            onChange={changeStops}
            firstDestination={firstDestination}
            errors={errors}
            timeZone={timeZone}
            hints={stops.map((stop, i) => airportHint(stop.destination, i + 1))}
          />
        </div>
        <Field
          name="pax_count"
          label="Passengers"
          type="number"
          min={0}
          defaultValue={submitted("pax_count", "0")}
          error={fieldError("pax_count")}
        />
        <Field
          name="cargo_lbs"
          label="Cargo (lbs)"
          type="number"
          min={0}
          defaultValue={submitted("cargo_lbs", "0")}
          error={fieldError("cargo_lbs")}
        />
        {/* #123: VFR unless ticked. A VFR flight is held to the company's
            dispatch minimums at every stop. */}
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              name="is_ifr"
              defaultChecked={submitted("is_ifr") === "on"}
              className="accent-primary"
            />
            Flown IFR
          </label>
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Leave it unticked for a VFR flight: below the company&apos;s dispatch minimums at any stop it isn&apos;t released.
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="field-label"
        >
          Ops notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          defaultValue={submitted("notes")}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-caps inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-50 text-[0.72rem]"
        >
          {pending && <Spinner size="xs" />}
          {pending ? "Opening…" : "Open Flight"}
        </button>
        <Link
          href="/flight-following"
          className="text-xs font-medium text-muted-foreground hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  error,
  required,
  hint,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  /** Under the input, e.g. a typed local time in Zulu. */
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="field-label"
      >
        {label}
        {required && <span className="text-status-red"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-status-red"
        {...inputProps}
      />
      {hint && <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

function FieldSelect({
  name,
  label,
  error,
  required,
  defaultValue,
  onChange,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  onChange?: (value: string) => void;
  /** Restores the picked option after a failed submit. A select is the
   *  field this matters most on: a wiped text input is visibly empty,
   *  a wiped select silently reads "Select aircraft…" again. */
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="field-label"
      >
        {label}
        {required && <span className="text-status-red"> *</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-status-red"
      >
        {children}
      </select>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** 3-4 letters and digits: an ICAO or FAA code once it's typed (#105). */
function isAirportCode(code: string): boolean {
  return /^[A-Z0-9]{3,4}$/.test(code);
}
