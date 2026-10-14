"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
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
import type { FlightUpdatePayload } from "@/lib/api/ops";
import type { AircraftListItem, FlightDetail } from "@/lib/api/types";
import {
  DEFAULT_ZONE_TABLE,
  localToUtcIso,
  utcToLocalInput,
  type ZoneTable,
  zoneAbbreviation,
  zoneFor,
  zuluHint,
} from "@/lib/format/local-time";
import { routeText } from "@/lib/route";

// ICAO airport codes are 3-4 alphanumeric chars (legacy used 3 too).
const icaoPattern = /^[A-Z0-9]{3,4}$/;

// `datetime-local` input values are wall-clock times without a zone. They are
// local at the departure base (#68), with Zulu shown under each, and saved in
// UTC. Round-tripping ISO → "YYYY-MM-DDTHH:MM" loses seconds, which is fine
// for our minute-granularity schedules.
const schema = z.object({
  flight_number: z
    .string()
    .min(1, "Required")
    .max(12, "Max 12 characters"),
  aircraft_id: z.string().min(1, "Required"),
  origin: z
    .string()
    .min(3, "3–4 characters")
    .max(4, "3–4 characters")
    .regex(icaoPattern, "Letters/numbers only"),
  destination: z
    .string()
    .min(3, "3–4 characters")
    .max(4, "3–4 characters")
    .regex(icaoPattern, "Letters/numbers only"),
  scheduled_departure_at: z.string().min(1, "Required"),
  scheduled_arrival_at: z.string().min(1, "Required"),
  pax_count: z.coerce.number().int().nonnegative("Cannot be negative"),
  cargo_lbs: z.coerce.number().int().nonnegative("Cannot be negative"),
  notes: z.string().max(500, "Max 500 characters"),
});

type FormValues = z.infer<typeof schema>;

interface EditFlightDialogProps {
  flight: FlightDetail;
  aircraft: AircraftListItem[];
  /** Each base's zone, for the departure base the times are typed in. */
  zones?: ZoneTable;
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

/** Returns only the keys whose form value differs from the seeded flight. */
function buildPatch(
  flight: FlightDetail,
  values: FormValues,
  timeZone: string,
): FlightUpdatePayload {
  const patch: FlightUpdatePayload = {};
  if (values.flight_number !== flight.flight_number)
    patch.flight_number = values.flight_number;
  if (values.aircraft_id !== flight.aircraft.id)
    patch.aircraft_id = values.aircraft_id;
  // A multi-leg flight's endpoints and times are its first and last
  // legs'; the API refuses to move them on their own (flight_has_legs).
  if (!isMultiLeg(flight)) {
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
  }
  if (values.pax_count !== flight.pax_count) patch.pax_count = values.pax_count;
  if (values.cargo_lbs !== flight.cargo_lbs) patch.cargo_lbs = values.cargo_lbs;
  const notesNormalized = values.notes.trim() || null;
  if (notesNormalized !== (flight.notes ?? null))
    patch.notes = notesNormalized;
  return patch;
}

export function EditFlightDialog({
  flight,
  aircraft,
  zones = DEFAULT_ZONE_TABLE,
}: EditFlightDialogProps) {
  const router = useRouter();
  const storedZone = zoneFor(zones, flight.origin);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      flight_number: flight.flight_number,
      aircraft_id: flight.aircraft.id,
      origin: flight.origin,
      destination: flight.destination,
      scheduled_departure_at: utcToLocalInput(flight.scheduled_departure_at, storedZone),
      scheduled_arrival_at: utcToLocalInput(flight.scheduled_arrival_at, storedZone),
      pax_count: flight.pax_count,
      cargo_lbs: flight.cargo_lbs,
      notes: flight.notes ?? "",
    },
  });

  // The times follow the departure base: a new origin in another zone
  // reads them in its zone, and the labels say which.
  const timeZone = zoneFor(zones, form.watch("origin"));
  const tz = zoneAbbreviation(
    timeZone,
    new Date(localToUtcIso(form.watch("scheduled_departure_at"), timeZone) ?? Date.now()),
  );

  const onSubmit = (values: FormValues) => {
    setError(null);
    const patch = buildPatch(flight, values, zoneFor(zones, values.origin));
    if (Object.keys(patch).length === 0) {
      // Nothing changed — just close. Backend would no-op anyway.
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await updateFlightAction(flight.id, patch);
      if (result.ok) {
        setOpen(false);
        form.reset(values); // Make the just-saved values the new "baseline".
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {flight.flight_number}</DialogTitle>
            <DialogDescription>
              Amend the scheduled flight. Times are local at the departure base
              ({tz}). Each save is recorded in the audit log with a field-level
              diff.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
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
                    <FormLabel>Origin (ICAO)</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        readOnly={isMultiLeg(flight)}
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
                    <FormLabel>Destination (ICAO)</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        readOnly={isMultiLeg(flight)}
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
                        readOnly={isMultiLeg(flight)}
                        {...field}
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
                        readOnly={isMultiLeg(flight)}
                        {...field}
                      />
                    </FormControl>
                    <ZuluHint value={field.value} timeZone={timeZone} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isMultiLeg(flight) && (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  This flight has {flight.legs?.length} legs ({routeText(flight)}):
                  its route and times are its legs&apos;.
                </p>
              )}

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
