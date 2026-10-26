"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VillageAirportResponse } from "@/lib/api/types";

import {
  editVillageAirportAction,
  retireVillageAirportAction,
} from "@/app/(app)/village-wx/actions";

type Values = { icao: string; name: string; region: string; notes: string };

const valuesOf = (a: VillageAirportResponse): Values => ({
  icao: a.icao,
  name: a.name,
  region: a.region ?? "",
  notes: a.notes ?? "",
});

/**
 * Correct a village airport, or take it off the board (#130). Levelock
 * was on the board as PAAI, a code no airport has; it is 9Z8. Its reports
 * stay with it either way. The village weather reporters' (#110), as
 * adding one is.
 */
export function EditAirportDialog({ airport }: { airport: VillageAirportResponse }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(() => valuesOf(airport));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [retiring, setRetiring] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const show = () => {
    setValues(valuesOf(airport));
    setErrors({});
    setError(null);
    setRetiring(false);
    setOpen(true);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await editVillageAirportAction(airport.id, values);
      if (result.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      setErrors(result.errors ?? {});
      setError(result.errors ? null : result.error);
    });
  };

  const retire = () => {
    setError(null);
    startTransition(async () => {
      const result = await retireVillageAirportAction(airport.id);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else setError(result.error);
    });
  };

  const field = (key: keyof Values, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`airport-${airport.id}-${key}`} className="field-label">
        {label}
      </label>
      <input
        id={`airport-${airport.id}-${key}`}
        value={values[key]}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        aria-invalid={errors[key] ? true : undefined}
        className="ff-input"
        {...extra}
      />
      {errors[key] ? <p className="field-error">{errors[key]}</p> : null}
    </div>
  );

  return (
    <>
      <button type="button" onClick={show} className={`${linkCaps} mt-2`}>
        {`Edit ${airport.icao}`}
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{`Edit ${airport.name}`}</DialogTitle>
            <DialogDescription>
              Correct the identifier, name or region. Its reports stay with it.
            </DialogDescription>
          </DialogHeader>

          {retiring ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                {`Retire ${airport.name} (${airport.icao})? It comes off the board, and its reports are kept.`}
              </p>
              {error ? (
                <p role="alert" className="field-error">
                  {error}
                </p>
              ) : null}
              <DialogFooter>
                <button type="button" className={buttonOutline} onClick={() => setRetiring(false)} disabled={pending}>
                  Keep it
                </button>
                <button type="button" className={buttonSolid} onClick={retire} disabled={pending}>
                  {pending ? "Retiring…" : "Retire"}
                </button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                {field("icao", "Identifier", { autoCapitalize: "characters", spellCheck: false })}
                {field("name", "Name")}
              </div>
              {field("region", "Region")}
              {field("notes", "Notes")}
              {error ? (
                <p role="alert" className="field-error">
                  {error}
                </p>
              ) : null}
              <DialogFooter className="sm:justify-between">
                <button type="button" className={buttonOutline} onClick={() => setRetiring(true)} disabled={pending}>
                  Retire…
                </button>
                <div className="flex gap-2">
                  <button type="button" className={buttonOutline} onClick={() => setOpen(false)} disabled={pending}>
                    Cancel
                  </button>
                  <button type="submit" className={buttonSolid} disabled={pending}>
                    {pending ? "Saving…" : "Save"}
                  </button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
