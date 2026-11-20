"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { linkCaps } from "@/components/ff/controls";
import { EditGlyph } from "@/components/ff/glyphs";
import { z } from "zod";

import { updateFlightAction } from "@/app/(app)/dispatch/[flightId]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OffRouteReport } from "@/components/dispatch/off-route-report";
import type { FlightLegPayload, FlightUpdatePayload, OffRoute } from "@/lib/api/ops";
import type { AircraftListItem, FlightDetail } from "@/lib/api/types";
import { addMinutes, minutesBetween } from "@/lib/flights/leg-times";
import {
  DEFAULT_ZONE_TABLE,
  localToUtcIso,
  utcToLocalInput,
  type ZoneTable,
  zoneAbbreviation,
  zoneFor,
  zuluHint,
} from "@/lib/format/local-time";

// ICAO or FAA airport codes: 3-4 letters and digits (9Z8, #105).
const airportCode = z
  .string()
  .regex(/^[A-Z0-9]{3,4}$/, "3- or 4-character airport code (ICAO or FAA)");

/** Legacy's cap, as on the new-flight form. */
const MAX_LEGS = 9;

// `datetime-local` input values are wall-clock times without a zone. They are
// local at the departure base (#68), with Zulu shown under each, and saved in
// UTC. Round-tripping ISO → "YYYY-MM-DDTHH:MM" loses seconds, which is fine
// for our minute-granularity schedules. Every leg's times are read in the
// departure base's zone, as the new-flight form reads them.
const schema = z
  .object({
    flight_number: z
      .string()
      .min(1, "Required")
      .max(12, "Max 12 characters"),
    aircraft_id: z.string().min(1, "Required"),
    origin: airportCode,
    destination: airportCode,
    scheduled_departure_at: z.string().min(1, "Required"),
    scheduled_arrival_at: z.string().min(1, "Required"),
    // The legs after the first, each from where the one before it landed.
    stops: z
      .array(
        z.object({
          destination: airportCode,
          departure: z.string().min(1, "Required"),
          arrival: z.string().min(1, "Required"),
        }),
      )
      .max(MAX_LEGS - 1, `A flight can have at most ${MAX_LEGS} legs.`),
    pax_count: z.coerce.number().int().nonnegative("Cannot be negative"),
    cargo_lbs: z.coerce.number().int().nonnegative("Cannot be negative"),
    notes: z.string().max(500, "Max 500 characters"),
    is_ifr: z.boolean(),
    // #201: an IFR flight's alternate, for its fuel. Blank is none yet;
    // checked below, only while IFR is ticked (the box is hidden for VFR).
    alternate_ident: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.is_ifr && !/^([A-Z0-9]{3,4})?$/.test(v.alternate_ident.trim())) {
      ctx.addIssue({
        code: "custom",
        path: ["alternate_ident"],
        message: "3- or 4-character airport code (ICAO or FAA)",
      });
    }
    // The same zone throughout, so the local strings compare in order.
    if (v.scheduled_arrival_at && v.scheduled_arrival_at <= v.scheduled_departure_at) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduled_arrival_at"],
        message: "Arrival must be after departure",
      });
    }
    let landed = v.scheduled_arrival_at;
    v.stops.forEach((stop, i) => {
      if (stop.departure && landed && stop.departure < landed) {
        ctx.addIssue({
          code: "custom",
          path: ["stops", i, "departure"],
          message: "Departs before the leg before it lands",
        });
      }
      if (stop.arrival && stop.departure && stop.arrival <= stop.departure) {
        ctx.addIssue({
          code: "custom",
          path: ["stops", i, "arrival"],
          message: "Arrival must be after departure",
        });
      }
      landed = stop.arrival;
    });
  });

const OVER_A_DAY = "The last leg lands more than 24 hours after this. Check the dates.";

/** Whether the last leg lands more than 24 hours after the first leaves,
 *  the typed local times read in the departure base's zone (so a night
 *  across a clock change counts its real hours). Ops refuses such a flight;
 *  the client's BK-59414132 (18 Nov) had its first leg saved as leaving
 *  Nov 12 and landing Nov 18. */
function overADay(v: FormValues, timeZone: string): boolean {
  const last = v.stops.length > 0 ? v.stops[v.stops.length - 1].arrival : v.scheduled_arrival_at;
  const from = localToUtcIso(v.scheduled_departure_at, timeZone);
  const to = localToUtcIso(last, timeZone);
  return from !== null && to !== null && Date.parse(to) - Date.parse(from) > 24 * 3_600_000;
}

type FormValues = z.infer<typeof schema>;

/** A time on the form after the first departure (#202). */
type TimeField = "scheduled_arrival_at" | `stops.${number}.departure` | `stops.${number}.arrival`;

interface EditFlightDialogProps {
  flight: FlightDetail;
  aircraft: AircraftListItem[];
  /** Each base's zone, for the departure base the times are typed in. */
  zones?: ZoneTable;
  /** Open on arrival: the board's Edit link (#132). */
  defaultOpen?: boolean;
}

/** The typed local time as a UTC instant, if it differs from `stored`. */
function changedUtc(local: string, timeZone: string, stored: string): string | null {
  const iso = localToUtcIso(local, timeZone);
  if (!iso) return null;
  return new Date(iso).getTime() === new Date(stored).getTime() ? null : iso;
}

function isMultiLeg(flight: FlightDetail): boolean {
  return (flight.legs?.length ?? 0) > 1;
}

type RouteValues = Pick<
  FormValues,
  "origin" | "destination" | "scheduled_departure_at" | "scheduled_arrival_at" | "stops"
>;

/** The route as the form shows it: the first leg's fields, then the
 *  later legs as stops, all in the departure base's zone. */
function routeDefaults(flight: FlightDetail, timeZone: string): RouteValues {
  const legs = [...(flight.legs ?? [])].sort((a, b) => a.sequence - b.sequence);
  if (legs.length > 1) {
    const [first, ...rest] = legs;
    return {
      origin: first.origin,
      destination: first.destination,
      scheduled_departure_at: utcToLocalInput(first.scheduled_departure_at, timeZone),
      scheduled_arrival_at: utcToLocalInput(first.scheduled_arrival_at, timeZone),
      stops: rest.map((leg) => ({
        destination: leg.destination,
        departure: utcToLocalInput(leg.scheduled_departure_at, timeZone),
        arrival: utcToLocalInput(leg.scheduled_arrival_at, timeZone),
      })),
    };
  }
  return {
    origin: flight.origin,
    destination: flight.destination,
    scheduled_departure_at: utcToLocalInput(flight.scheduled_departure_at, timeZone),
    scheduled_arrival_at: utcToLocalInput(flight.scheduled_arrival_at, timeZone),
    stops: [],
  };
}

/** Compared as typed, so a stored time with seconds that the form can't
 *  hold doesn't read as a change of route. */
function routeKey(route: RouteValues): string {
  return [
    route.origin,
    route.destination,
    route.scheduled_departure_at,
    route.scheduled_arrival_at,
    ...route.stops.flatMap((s) => [s.destination, s.departure, s.arrival]),
  ].join("|");
}

/** The typed route as legs in UTC: each stop departs where the leg
 *  before it landed. */
function legsFrom(values: RouteValues, timeZone: string): FlightLegPayload[] {
  const utc = (local: string) => localToUtcIso(local, timeZone) ?? "";
  const legs: FlightLegPayload[] = [
    {
      origin: values.origin,
      destination: values.destination,
      scheduled_departure_at: utc(values.scheduled_departure_at),
      scheduled_arrival_at: utc(values.scheduled_arrival_at),
    },
  ];
  for (const stop of values.stops) {
    legs.push({
      origin: legs[legs.length - 1].destination,
      destination: stop.destination,
      scheduled_departure_at: utc(stop.departure),
      scheduled_arrival_at: utc(stop.arrival),
    });
  }
  return legs;
}

/** Returns only the keys whose form value differs from the seeded flight. */
function buildPatch(
  flight: FlightDetail,
  values: FormValues,
  timeZone: string,
  storedZone: string,
): FlightUpdatePayload {
  const patch: FlightUpdatePayload = {};
  if (values.flight_number !== flight.flight_number)
    patch.flight_number = values.flight_number;
  if (values.aircraft_id !== flight.aircraft.id)
    patch.aircraft_id = values.aircraft_id;
  if (!isMultiLeg(flight) && values.stops.length === 0) {
    // One leg before and after: the fields that changed, as always.
    if (values.origin !== flight.origin) patch.origin = values.origin;
    if (values.destination !== flight.destination)
      patch.destination = values.destination;
    const depIso = changedUtc(
      values.scheduled_departure_at,
      timeZone,
      flight.scheduled_departure_at,
    );
    if (depIso) patch.scheduled_departure_at = depIso;
    const arrIso = changedUtc(values.scheduled_arrival_at, timeZone, flight.scheduled_arrival_at);
    if (arrIso) patch.scheduled_arrival_at = arrIso;
  } else if (routeKey(values) !== routeKey(routeDefaults(flight, storedZone))) {
    // A route with stops is replaced whole (#106): the client could not
    // change one once it was planned. Taking every stop off makes it
    // one leg again.
    const legs = legsFrom(values, timeZone);
    if (legs.length > 1) {
      patch.legs = legs;
    } else {
      patch.legs = [];
      patch.origin = legs[0].origin;
      patch.destination = legs[0].destination;
      patch.scheduled_departure_at = legs[0].scheduled_departure_at;
      patch.scheduled_arrival_at = legs[0].scheduled_arrival_at;
    }
  }
  if (values.pax_count !== flight.pax_count) patch.pax_count = values.pax_count;
  if (values.cargo_lbs !== flight.cargo_lbs) patch.cargo_lbs = values.cargo_lbs;
  const notesNormalized = values.notes.trim() || null;
  if (notesNormalized !== (flight.notes ?? null))
    patch.notes = notesNormalized;
  if (values.is_ifr !== Boolean(flight.is_ifr)) patch.is_ifr = values.is_ifr;
  // #201: only an IFR flight keeps an alternate; ops clears it for VFR.
  const alternate = values.is_ifr ? values.alternate_ident.trim() || null : null;
  if (values.is_ifr && alternate !== (flight.alternate_ident ?? null)) patch.alternate_ident = alternate;
  return patch;
}

export function EditFlightDialog({
  flight,
  aircraft,
  zones = DEFAULT_ZONE_TABLE,
  defaultOpen = false,
}: EditFlightDialogProps) {
  const router = useRouter();
  const storedZone = zoneFor(zones, flight.origin);
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);
  // What the saved route no longer flies (#208), shown before closing.
  const [offRoute, setOffRoute] = useState<OffRoute | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      flight_number: flight.flight_number,
      aircraft_id: flight.aircraft.id,
      ...routeDefaults(flight, storedZone),
      pax_count: flight.pax_count,
      cargo_lbs: flight.cargo_lbs,
      notes: flight.notes ?? "",
      is_ifr: Boolean(flight.is_ifr),
      alternate_ident: flight.alternate_ident ?? "",
    },
  });
  const stops = useFieldArray({ control: form.control, name: "stops" });

  // #202: the times after the departure follow it, as on Open Flight. The
  // client changed BK-FD6204DD's departure and the arrival stayed where it
  // was. Each leg keeps its length and each stop its time on the ground; a
  // time typed here by hand stays; and a new date moves nothing (that's
  // Move to Another Day, and a mistyped date is caught by the span check,
  // as on BK-59414132).
  const typedByHand = useRef(new Set<string>());
  const lastDeparture = useRef(form.getValues("scheduled_departure_at"));
  const followDeparture = (next: string) => {
    const before = lastDeparture.current;
    if (!next) return; // mid-typing: the last whole time stands
    lastDeparture.current = next;
    if (!before || before.slice(0, 10) !== next.slice(0, 10)) return;
    const zone = zoneFor(zones, form.getValues("origin"));
    const moved = minutesBetween(before, next, zone);
    if (!moved) return;
    const later: { key: string; name: TimeField }[] = [
      { key: "arrival", name: "scheduled_arrival_at" },
      ...stops.fields.flatMap((stop, i) => [
        { key: `${stop.id}:departure`, name: `stops.${i}.departure` as TimeField },
        { key: `${stop.id}:arrival`, name: `stops.${i}.arrival` as TimeField },
      ]),
    ];
    for (const { key, name } of later) {
      const current = form.getValues(name);
      if (typedByHand.current.has(key) || !current) continue;
      const shifted = addMinutes(current, moved, zone);
      if (shifted) form.setValue(name, shifted, { shouldDirty: true });
    }
  };

  // The times follow the departure base: a new origin in another zone
  // reads them in its zone, and the labels say which.
  const timeZone = zoneFor(zones, form.watch("origin"));
  const tz = zoneAbbreviation(
    timeZone,
    new Date(localToUtcIso(form.watch("scheduled_departure_at"), timeZone) ?? Date.now()),
  );

  const onSubmit = (values: FormValues) => {
    setError(null);
    const zone = zoneFor(zones, values.origin);
    const patch = buildPatch(flight, values, zone, storedZone);
    if (Object.keys(patch).length === 0) {
      // Nothing changed — just close. Backend would no-op anyway.
      setOpen(false);
      return;
    }
    // Only when the times go out, as ops checks them.
    const retimed = "legs" in patch || "scheduled_departure_at" in patch || "scheduled_arrival_at" in patch;
    if (retimed && overADay(values, zone)) {
      form.setError("scheduled_departure_at", { type: "custom", message: OVER_A_DAY });
      return;
    }
    startTransition(async () => {
      const result = await updateFlightAction(flight.id, patch);
      if (result.ok) {
        form.reset(values); // Make the just-saved values the new "baseline".
        if (result.offRoute) {
          setOffRoute(result.offRoute);
          return;
        }
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const close = () => {
    // The form stays open while it saves. Once the report is up the save is
    // done, though the page's refresh may still count as pending.
    if (isPending && !offRoute) return;
    setOpen(false);
    if (offRoute) {
      setOffRoute(null);
      router.refresh();
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <EditGlyph className="h-4 w-4" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {offRoute ? (
            <OffRouteReport flightNumber={flight.flight_number} offRoute={offRoute} onClose={close} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Edit {flight.flight_number}</DialogTitle>
                <DialogDescription>
                  Amend the scheduled flight, its route and stops included. Times are
                  local at the departure base ({tz}). A new date moves it to another
                  day: its FRAT, acknowledgments and check-in start over. Each save is
                  recorded in the audit log with a field-level diff.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form
                  method="post"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <FormField
                    control={form.control}
                    name="flight_number"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Flight number</FormLabel>
                        <FormControl>
                          <Input autoComplete="off" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aircraft_id"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Aircraft</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                          >
                            {aircraft.map((a) => (
                              <option
                                key={a.id}
                                value={a.id}
                                disabled={!a.is_active}
                              >
                                {a.tail_number} — {a.model}
                                {!a.is_active ? " (inactive)" : ""}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="origin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origin</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="off"
                            className="font-mono uppercase"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value.toUpperCase())
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="destination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{stops.fields.length > 0 ? "Leg 1 Destination" : "Destination"}</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="off"
                            className="font-mono uppercase"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value.toUpperCase())
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduled_departure_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{`Departure (${tz})`}</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              followDeparture(e.target.value);
                            }}
                          />
                        </FormControl>
                        <ZuluHint value={field.value} timeZone={timeZone} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduled_arrival_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{`Arrival (${tz})`}</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            onChange={(e) => {
                              typedByHand.current.add("arrival");
                              field.onChange(e);
                            }}
                          />
                        </FormControl>
                        <ZuluHint value={field.value} timeZone={timeZone} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {stops.fields.map((stop, i) => {
                    const from =
                      i === 0 ? form.watch("destination") : form.watch(`stops.${i - 1}.destination`);
                    return (
                      <div
                        key={stop.id}
                        role="group"
                        aria-label={`Leg ${i + 2}`}
                        className="grid gap-3 border-t border-border pt-3 sm:col-span-2 sm:grid-cols-2"
                      >
                        <div className="flex items-baseline justify-between sm:col-span-2">
                          <span className="eyebrow">{`Leg ${i + 2} · from ${from || "?"}`}</span>
                          <button
                            type="button"
                            className={linkCaps}
                            onClick={() => stops.remove(i)}
                            aria-label={`Remove leg ${i + 2}`}
                          >
                            Remove
                          </button>
                        </div>
                        <FormField
                          control={form.control}
                          name={`stops.${i}.destination`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>{`Leg ${i + 2} Destination`}</FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete="off"
                                  className="font-mono uppercase"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {(["departure", "arrival"] as const).map((when) => (
                          <FormField
                            key={when}
                            control={form.control}
                            name={`stops.${i}.${when}`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {`Leg ${i + 2} ${when === "departure" ? "Departure" : "Arrival"} (${tz})`}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="datetime-local"
                                    {...field}
                                    onChange={(e) => {
                                      typedByHand.current.add(`${stop.id}:${when}`);
                                      field.onChange(e);
                                    }}
                                  />
                                </FormControl>
                                <ZuluHint value={field.value} timeZone={timeZone} />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    );
                  })}

                  {stops.fields.length + 1 < MAX_LEGS ? (
                    <div className="sm:col-span-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const all = form.getValues("stops");
                          const landed =
                            all.length > 0 ? all[all.length - 1].arrival : form.getValues("scheduled_arrival_at");
                          stops.append({ destination: "", departure: landed, arrival: "" });
                        }}
                      >
                        + Add Stop
                      </Button>
                    </div>
                  ) : null}

                  <FormField
                    control={form.control}
                    name="pax_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Passengers</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cargo_lbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* #123: VFR unless ticked, and then held to the company's
                      dispatch minimums at every stop. */}
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-xs text-foreground">
                      <input type="checkbox" {...form.register("is_ifr")} className="accent-primary" />
                      Flown IFR
                    </label>
                  </div>

                  {/* #201: the fuel estimate flies an IFR flight on to its
                      alternate, so it asks for one when IFR is ticked. */}
                  {form.watch("is_ifr") && (
                    <FormField
                      control={form.control}
                      name="alternate_ident"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alternate</FormLabel>
                          <FormControl>
                            <Input
                              autoComplete="off"
                              placeholder="e.g. PABE"
                              className="font-mono uppercase"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            The fuel estimate adds the flight to it.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormItem className="sm:col-span-2">
                    <Label htmlFor="edit-notes">Notes</Label>
                    <FormControl>
                      <textarea
                        id="edit-notes"
                        rows={3}
                        {...form.register("notes")}
                        className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.notes?.message}
                    </FormMessage>
                  </FormItem>

                  {error && (
                    <p
                      role="alert"
                      className="sm:col-span-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {error}
                    </p>
                  )}

                  <DialogFooter className="sm:col-span-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Saving…" : "Save changes"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** What a typed local time is in Zulu, under its input. */
function ZuluHint({ value, timeZone }: { value: string; timeZone: string }) {
  const hint = zuluHint(value, timeZone);
  return hint ? <p className="font-mono text-[0.65rem] text-muted-foreground">{hint}</p> : null;
}
