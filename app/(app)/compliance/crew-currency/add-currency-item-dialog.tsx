"use client";

import { useActionState, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import {
  createCurrencyItemAction,
  type CreateCurrencyItemState,
} from "./add-currency-item-actions";

/**
 * M2-C-2 — "Add Currency Item" affordance on the compliance board.
 *
 * Opens an inline dialog with the fields the backend accepts:
 *   code, name, regulation, interval_type, optional rolling_days +
 *   rolling_threshold when interval_type='rolling_days', plus two
 *   flags (requires_examiner, is_check_event).
 *
 * The rolling pair is conditionally required — the form hides those
 * inputs when the interval type is calendar-based and shows them
 * when it flips to rolling_days. Backend rejects mismatches too, so
 * this UI guard is UX only, not a validation gate.
 *
 * Non-chief-pilot users still see the button — the server action
 * returns a friendly 403 message rather than the button hiding based
 * on session role (matches Log Completion behaviour, keeps role
 * checks server-authoritative).
 */
export function AddCurrencyItemDialog() {
  const [open, setOpen] = useState(false);
  const [interval, setInterval_] = useState<
    "annual" | "semi_annual" | "medical_hard_expiry" | "rolling_days"
  >("annual");
  const [state, action, pending] = useActionState<
    CreateCurrencyItemState,
    FormData
  >(createCurrencyItemAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "ok") {
      setOpen(false);
      setInterval_("annual");
    }
  }, [state.status]);

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-status-blue/40 bg-status-blue/10 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
      >
        + Add Currency Item
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add currency item</DialogTitle>
            <DialogDescription>
              Add a company-specific requirement (fire drill, quarterly training,
              etc.). Applies to every pilot in this tenant.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-3">
            {state.status === "api-error" && (
              <div
                role="alert"
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {state.message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field
                name="code"
                label="Code"
                placeholder="co_fire_drill"
                required
                autoComplete="off"
                spellCheck={false}
                error={fieldError("code")}
              />
              <Field
                name="regulation"
                label="Regulation / source"
                placeholder="Company Policy"
                required
                autoComplete="off"
                error={fieldError("regulation")}
              />
            </div>

            <Field
              name="name"
              label="Display name"
              placeholder="Annual Fire Drill"
              required
              autoComplete="off"
              error={fieldError("name")}
            />

            <div>
              <label
                htmlFor="interval_type"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Interval type <span className="text-status-red">*</span>
              </label>
              <select
                id="interval_type"
                name="interval_type"
                value={interval}
                onChange={(e) =>
                  setInterval_(
                    e.target.value as
                      | "annual"
                      | "semi_annual"
                      | "medical_hard_expiry"
                      | "rolling_days",
                  )
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
              >
                <option value="annual">Annual (calendar-month)</option>
                <option value="semi_annual">Semi-annual</option>
                <option value="medical_hard_expiry">
                  Medical / hard expiry
                </option>
                <option value="rolling_days">Rolling days</option>
              </select>
            </div>

            {interval === "rolling_days" && (
              <div className="grid grid-cols-2 gap-3">
                <Field
                  name="rolling_days"
                  label="Rolling window (days)"
                  type="number"
                  min={1}
                  placeholder="180"
                  required
                  error={fieldError("rolling_days")}
                />
                <Field
                  name="rolling_threshold"
                  label="Threshold count"
                  type="number"
                  min={1}
                  placeholder="6"
                  required
                  error={fieldError("rolling_threshold")}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" name="requires_examiner" />
                Requires examiner
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" name="is_check_event" />
                Is check event
              </label>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Adding…" : "Add currency item"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  name,
  label,
  error,
  type = "text",
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
        {inputProps.required && <span className="text-status-red"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
        {...inputProps}
      />
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
