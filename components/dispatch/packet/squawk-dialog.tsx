"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Plus } from "lucide-react";
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

export interface SquawkDialogProps {
  aircraftId: string;
  tailNumber: string;
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
export function SquawkDialog({ aircraftId, tailNumber }: SquawkDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      severity: "minor",
      reported_at: nowAsLocalInput(),
    },
  });

  const severity = form.watch("severity");

  const closeAndReset = () => {
    setOpen(false);
    setError(null);
    form.reset({
      title: "",
      description: "",
      severity: "minor",
      reported_at: nowAsLocalInput(),
    });
  };

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const result = await createSquawkAction({
        aircraft_id: aircraftId,
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
        <Plus className="h-3.5 w-3.5" />
        Squawk
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => (isPending ? null : (o ? setOpen(true) : closeAndReset()))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New squawk · {tailNumber}</DialogTitle>
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
                  className="sm:col-span-2 flex items-start gap-2 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    This will block dispatch on{" "}
                    <span className="font-mono font-semibold">{tailNumber}</span>{" "}
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
