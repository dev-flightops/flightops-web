"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { z } from "zod";

import { createMelDeferralAction } from "@/app/(app)/dispatch/maintenance-actions";
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
import type { MelCategory } from "@/lib/api/types";

// Category caps drive the default "due_at" suggestion. These mirror the
// FAA-approved MMEL/MEL document categories enforced by the backend
// MelItem validator (services/maintenance/app/routes/mel_items.py).
const CATEGORY_MAX_DAYS: Record<MelCategory, number> = {
  A: 1,   // "as specified per item" — varies by entry; 1 is the conservative default
  B: 3,
  C: 10,
  D: 120,
};

const schema = z
  .object({
    ata_chapter: z
      .string()
      .min(1, "Required")
      .max(10, "Max 10 characters"),
    description: z.string().min(1, "Required"),
    category: z.enum(["A", "B", "C", "D"], {
      errorMap: () => ({ message: "Required" }),
    }),
    deferred_at: z.string().min(1, "Required"),
    due_at: z.string().min(1, "Required"),
    notes: z.string().max(2000, "Max 2000 characters"),
  })
  .refine(
    (v) => {
      const dep = new Date(`${v.deferred_at}:00Z`).getTime();
      const due = new Date(`${v.due_at}:00Z`).getTime();
      return due > dep;
    },
    {
      path: ["due_at"],
      message: "Due date must be after the deferred-at date",
    },
  );

type FormValues = z.infer<typeof schema>;

/** Treat a datetime-local string as UTC (matches dispatch's edit dialog). */
function localInputToIso(local: string): string {
  return `${local}:00Z`;
}

/** ISO 8601 UTC → "YYYY-MM-DDTHH:MM" for use as a datetime-local input value. */
function isoToLocalInput(iso: string): string {
  return iso.slice(0, 16);
}

/** "now" rounded down to the minute, in datetime-local format (UTC). */
function nowAsLocalInput(): string {
  return new Date().toISOString().slice(0, 16);
}

/** Add `days` to a datetime-local string. */
function addDays(local: string, days: number): string {
  const dt = new Date(`${local}:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoToLocalInput(dt.toISOString());
}

export interface MelDeferralDialogProps {
  aircraftId: string;
  tailNumber: string;
}

/**
 * Modal form to file a new MEL deferral against an aircraft.
 *
 * Auto-suggests a `due_at` based on the chosen category (A: +1 day, B: +3,
 * C: +10, D: +120). Suggestion only fires when the user hasn't manually
 * touched the due_at field — once they edit it, we stop overriding.
 *
 * The form keeps deferred_at + due_at in UTC the same way edit-flight-dialog
 * does — a datetime-local input value treated as UTC. The label makes it
 * explicit.
 */
export function MelDeferralDialog({
  aircraftId,
  tailNumber,
}: MelDeferralDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Track whether the user has manually edited due_at — once they have, the
  // category change handler stops overwriting their value.
  const [dueAtTouched, setDueAtTouched] = useState(false);

  const initialDeferred = nowAsLocalInput();
  const initialCategory: MelCategory = "C";
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ata_chapter: "",
      description: "",
      category: initialCategory,
      deferred_at: initialDeferred,
      due_at: addDays(initialDeferred, CATEGORY_MAX_DAYS[initialCategory]),
      notes: "",
    },
  });

  const onCategoryChange = (next: MelCategory) => {
    form.setValue("category", next, { shouldValidate: true });
    if (!dueAtTouched) {
      const deferred = form.getValues("deferred_at") || nowAsLocalInput();
      form.setValue("due_at", addDays(deferred, CATEGORY_MAX_DAYS[next]), {
        shouldValidate: false,
      });
    }
  };

  const onDeferredAtChange = (next: string) => {
    form.setValue("deferred_at", next, { shouldValidate: true });
    if (!dueAtTouched) {
      const cat = form.getValues("category");
      form.setValue("due_at", addDays(next, CATEGORY_MAX_DAYS[cat]), {
        shouldValidate: false,
      });
    }
  };

  const closeAndReset = () => {
    setOpen(false);
    setError(null);
    setDueAtTouched(false);
    form.reset({
      ata_chapter: "",
      description: "",
      category: initialCategory,
      deferred_at: initialDeferred,
      due_at: addDays(initialDeferred, CATEGORY_MAX_DAYS[initialCategory]),
      notes: "",
    });
  };

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const result = await createMelDeferralAction({
        aircraft_id: aircraftId,
        ata_chapter: values.ata_chapter,
        description: values.description,
        category: values.category,
        deferred_at: localInputToIso(values.deferred_at),
        due_at: localInputToIso(values.due_at),
        notes: values.notes.trim() || null,
      });
      if (result.ok) {
        closeAndReset();
        // revalidatePath already happens server-side; this kicks the RSC
        // refresh on the current page so the MaintenancePanel re-renders
        // with the new MEL row.
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
        MEL deferral
      </Button>

      <Dialog open={open} onOpenChange={(o) => (isPending ? null : (o ? setOpen(true) : closeAndReset()))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New MEL deferral · {tailNumber}</DialogTitle>
            <DialogDescription>
              Defer an inoperative item under the approved MEL. Times are UTC.
              Due date auto-suggests from the category cap (A:1d, B:3d, C:10d,
              D:120d) — adjust as needed.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-3 sm:grid-cols-2"
            >
              <FormField
                control={form.control}
                name="ata_chapter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ATA chapter</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder="21-30"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        onChange={(e) =>
                          onCategoryChange(e.target.value as MelCategory)
                        }
                        className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      >
                        <option value="A">A — as specified (~1d)</option>
                        <option value="B">B — 3 days</option>
                        <option value="C">C — 10 days</option>
                        <option value="D">D — 120 days</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem className="sm:col-span-2">
                <Label htmlFor="mel-description">Description</Label>
                <FormControl>
                  <textarea
                    id="mel-description"
                    rows={3}
                    placeholder="e.g. Cabin pressurization controller intermittent — verified on ground, placard installed."
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
                name="deferred_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deferred at (UTC)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        onChange={(e) => onDeferredAtChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due by (UTC)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        onChange={(e) => {
                          setDueAtTouched(true);
                          field.onChange(e);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem className="sm:col-span-2">
                <Label htmlFor="mel-notes">Notes (optional)</Label>
                <FormControl>
                  <textarea
                    id="mel-notes"
                    rows={2}
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
                  onClick={closeAndReset}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Filing…" : "File deferral"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
