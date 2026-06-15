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
import type { CompanyBaseResponse } from "@/lib/api/types";

import {
  updateBaseAction,
  type BasesActionState,
} from "@/app/(app)/settings/bases/actions";

export function EditBaseDialog({ base }: { base: CompanyBaseResponse }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BasesActionState, FormData>(
    updateBaseAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state.status]);

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-card px-2.5 py-1 text-[0.7rem] font-semibold text-foreground hover:bg-muted/40"
      >
        Edit
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit {base.icao}</DialogTitle>
            <DialogDescription>
              ICAO is fixed once a base is created — only display + ops metadata
              can be edited.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <input type="hidden" name="base_id" value={base.id} />

            {state.status === "api-error" && (
              <div
                role="alert"
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {state.message}
              </div>
            )}

            <Field
              name="display_name"
              label="Display name"
              required
              defaultValue={base.display_name}
              error={fieldError("display_name")}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                name="city"
                label="City"
                defaultValue={base.city ?? ""}
                error={fieldError("city")}
              />
              <Field
                name="state"
                label="State"
                defaultValue={base.state ?? ""}
                error={fieldError("state")}
              />
              <Field
                name="timezone"
                label="Timezone"
                defaultValue={base.timezone ?? ""}
                error={fieldError("timezone")}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="is_hub"
                defaultChecked={base.is_hub}
                className="h-4 w-4 rounded border-border bg-background text-status-blue focus:ring-status-blue"
              />
              Hub base
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="manager_name"
                label="Base manager"
                defaultValue={base.manager_name ?? ""}
                error={fieldError("manager_name")}
              />
              <Field
                name="manager_phone"
                label="Manager phone"
                defaultValue={base.manager_phone ?? ""}
                error={fieldError("manager_phone")}
              />
            </div>
            <Field
              name="manager_email"
              label="Manager email"
              type="email"
              defaultValue={base.manager_email ?? ""}
              error={fieldError("manager_email")}
            />

            <div>
              <label
                htmlFor="notes"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={base.notes ?? ""}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
              />
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
                {pending ? "Saving…" : "Save"}
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
