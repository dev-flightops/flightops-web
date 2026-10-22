"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertGlyph, PlusGlyph } from "@/components/ff/glyphs";
import { z } from "zod";

import { createSquawkAction } from "@/app/(app)/dispatch/maintenance-actions";
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

const schema = z.object({
  aircraft_id: z.string().min(1, "Pick the aircraft"),
  title: z
    .string()
    .min(1, "Required")
    .max(160, "Max 160 characters"),
  description: z.string().min(1, "Required"),
  severity: z.enum(["minor", "major", "grounding"], {
    errorMap: () => ({ message: "Required" }),
  }),
  reported_at: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

/** Treat a datetime-local string as UTC (matches edit-flight + MEL dialog). */
function localInputToIso(local: string): string {
  return `${local}:00Z`;
}

/** "now" rounded down to the minute, in datetime-local format (UTC). */
function nowAsLocalInput(): string {
  return new Date().toISOString().slice(0, 16);
}

export interface AircraftChoice {
  id: string;
  tail_number: string;
  model?: string | null;
}

export interface SquawkDialogProps {
  /** The aircraft the squawk is against: the flight's, on the dispatch
   *  packet and the preflight. */
  aircraftId?: string;
  tailNumber?: string;
  /** The pilot's home (#92): at the morning run-up there is often no
   *  flight yet, so the pilot picks the aircraft in the form. */
  choices?: AircraftChoice[];
}

/**
 * Modal form to file a new squawk against an aircraft.
 *
 * Severity drives airworthiness:
 *   - minor   → cosmetic / advisory; no dispatch impact
 *   - major   → surfaces on the maintenance panel as advisory
 *   - grounding → blocks dispatch until resolved (or deferred via MEL)
 *
 * A warning strip appears when severity=grounding is selected so the user
 * realises they're about to ground the aircraft from the dispatch side.
 */
export function SquawkDialog({ aircraftId, tailNumber, choices }: SquawkDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const blank = (): FormValues => ({
    aircraft_id: aircraftId ?? "",
    title: "",
    description: "",
    severity: "minor",
    reported_at: nowAsLocalInput(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      aircraft_id: aircraftId ?? "",
      title: "",
      description: "",
      severity: "minor",
      reported_at: nowAsLocalInput(),
    },
  });

  const severity = form.watch("severity");
  const chosenId = form.watch("aircraft_id");
  const tail =
    tailNumber ?? choices?.find((a) => a.id === chosenId)?.tail_number ?? "the aircraft";

  const closeAndReset = () => {
    setOpen(false);
    setError(null);
    form.reset(blank());
  };

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const result = await createSquawkAction({
        aircraft_id: values.aircraft_id,
        reported_at: localInputToIso(values.reported_at),
        title: values.title,
        description: values.description,
        severity: values.severity,
      });
      if (result.ok) {
        closeAndReset();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <PlusGlyph className="h-3.5 w-3.5" />
        Squawk
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => (isPending ? null : (o ? setOpen(true) : closeAndReset()))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {tailNumber ? `New squawk · ${tailNumber}` : "New squawk"}
            </DialogTitle>
            <DialogDescription>
              File a maintenance discrepancy. Reporter is auto-set from your
              login. Severity drives whether the squawk blocks dispatch.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-3 sm:grid-cols-2"
            >
              {choices && (
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
                          <option value="">Select…</option>
                          {choices.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.tail_number}
                              {a.model ? ` · ${a.model}` : ""}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder="e.g. Left main gear tire wear approaching limits"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem className="sm:col-span-2">
                <Label htmlFor="squawk-description">Description</Label>
                <FormControl>
                  <textarea
                    id="squawk-description"
                    rows={4}
                    placeholder="What did you observe? Where? Under what conditions?"
                    {...form.register("description")}
                    className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                </FormControl>
                <FormMessage>
                  {form.formState.errors.description?.message}
                </FormMessage>
              </FormItem>

              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      >
                        <option value="minor">Minor — cosmetic / advisory</option>
                        <option value="major">Major — fix by next scheduled mx</option>
                        <option value="grounding">Grounding — blocks dispatch</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reported_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reported at (UTC)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {severity === "grounding" && (
                <div
                  role="alert"
                  className="notice notice-red sm:col-span-2 flex items-start gap-2"
                >
                  <AlertGlyph className="mt-0.5 h-4 w-4 shrink-0 text-status-red" />
                  <span>
                    This will block dispatch on{" "}
                    <span className="font-mono font-semibold">{tail}</span>{" "}
                    until the squawk is resolved or the item is deferred via a
                    new MEL entry.
                  </span>
                </div>
              )}

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
                  onClick={closeAndReset}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Filing…" : "File squawk"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
