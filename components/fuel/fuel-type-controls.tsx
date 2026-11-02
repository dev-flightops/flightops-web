"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addFuelTypeAction, setFuelTypeActiveAction } from "@/app/(app)/fuel/types/actions";
import { buttonOutline, buttonSolid } from "@/components/ff/controls";

/** A fuel type's Switch off / Switch on, as legacy's Disable / Enable (#134). */
export function FuelTypeSwitch({ typeId, label, active }: { typeId: string; label: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={buttonOutline}
        disabled={pending}
        aria-label={`${active ? "Switch off" : "Switch on"} ${label}`}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await setFuelTypeActiveAction(typeId, !active);
            if (result.ok) router.refresh();
            else setError(result.error ?? "Something went wrong.");
          });
        }}
      >
        {active ? "Switch off" : "Switch on"}
      </button>
      {error ? (
        <span role="alert" className="field-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Legacy's Add Fuel Type: a label, a code made from it when left blank,
 *  and the sort order. */
export function AddFuelTypeForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      aria-label="Add a fuel type"
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const text = (key: string) => String(data.get(key) ?? "");
        setError(null);
        start(async () => {
          const result = await addFuelTypeAction({
            label: text("label"),
            code: text("code"),
            sort_order: text("sort_order"),
          });
          if (result.ok) {
            form.reset();
            router.refresh();
          } else {
            setError(result.error ?? "Something went wrong.");
          }
        });
      }}
    >
      <label>
        <span className="field-label">Label</span>
        <input name="label" required maxLength={100} placeholder="Jet A + Prist" className="ff-input" />
      </label>
      <label>
        <span className="field-label">Code</span>
        <input name="code" maxLength={30} placeholder="Made from the label" className="ff-input font-mono" />
      </label>
      <label>
        <span className="field-label">Sort order</span>
        <input name="sort_order" type="number" step={1} defaultValue={100} className="ff-input" />
      </label>
      {error ? (
        <p role="alert" className="field-error sm:col-span-3">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end sm:col-span-3">
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Adding…" : "Add fuel type"}
        </button>
      </div>
    </form>
  );
}
