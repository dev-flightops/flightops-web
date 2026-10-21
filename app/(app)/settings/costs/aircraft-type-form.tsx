"use client";

import { useActionState, useState } from "react";

import type { AircraftCostRow } from "@/lib/api/auth";

import { saveAircraftCostAction, type CostFormState } from "./actions";

const _initial: CostFormState = { status: "idle", attempt: 0 };

const FIELDS: { name: Exclude<keyof AircraftCostRow, "id" | "aircraft_type" | "fuel_type_code">; label: string; placeholder: string }[] = [
  { name: "fuel_burn_gph", label: "Fuel burn (gal/h)", placeholder: "58" },
  { name: "engine_reserve_hr", label: "Engine reserve $/h", placeholder: "175" },
  { name: "prop_reserve_hr", label: "Prop reserve $/h", placeholder: "25" },
  { name: "maintenance_hr", label: "Mx reserve $/h", placeholder: "100" },
  { name: "oil_consumables_hr", label: "Oil & consumables $/h", placeholder: "12" },
  { name: "pilot_daily_rate", label: "Pilot pay $/day", placeholder: "350" },
  { name: "avg_duty_hrs", label: "Avg duty h/day", placeholder: "8" },
  { name: "insurance_hr", label: "Insurance $/h", placeholder: "0" },
];

const LABEL = "flex flex-col gap-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted-foreground";
const INPUT = "ff-input px-2 py-1.5 text-sm font-normal normal-case tracking-normal";

type Values = Record<string, string>;

function valuesOf(row: AircraftCostRow | undefined): Values {
  const v: Values = { fuel_type_code: row?.fuel_type_code ?? "" };
  for (const f of FIELDS) v[f.name] = row?.[f.name] ?? "";
  return v;
}

/**
 * Add an aircraft type's costs, or change one (#75): typing the name of a
 * type already on the list fills in its figures to edit. The type should be
 * the aircraft's airframe type (its model when it has none), which is how
 * costing and the manifest's fuel estimate find an aircraft's figures.
 */
export function AircraftTypeForm({
  rows,
  fuelTypes,
  fleetTypes,
}: {
  rows: AircraftCostRow[];
  fuelTypes: { code: string; label: string }[];
  fleetTypes: string[];
}) {
  const [state, formAction, pending] = useActionState(saveAircraftCostAction, _initial);
  const [type, setType] = useState("");
  const [values, setValues] = useState<Values>(valuesOf(undefined));
  // React resets a form when its action succeeds, and a reset puts a
  // <select> back on the option it was first rendered with, whatever the
  // state says: the fuel showed "Not set" after a save, and the next save
  // cleared it. So the select is uncontrolled and remounts on every save
  // and every fill-in, which makes its first render the current fuel.
  const [filled, setFilled] = useState(0);
  const existing = rows.find((r) => r.aircraft_type === type.trim());

  function onType(next: string) {
    setType(next);
    const row = rows.find((r) => r.aircraft_type === next.trim());
    if (row) {
      setValues(valuesOf(row));
      setFilled((n) => n + 1);
    }
  }

  const suggestions = [...new Set([...rows.map((r) => r.aircraft_type), ...fleetTypes])].sort((a, b) =>
    a.localeCompare(b),
  );
  return (
    <form action={formAction} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      <label className={`${LABEL} col-span-2`}>
        Aircraft type
        <input
          name="aircraft_type"
          list="aircraft-type-suggestions"
          value={type}
          onChange={(e) => onType(e.target.value)}
          placeholder="Cessna 208B Grand Caravan"
          className={INPUT}
          required
        />
        <datalist id="aircraft-type-suggestions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <label className={LABEL}>
        Fuel
        <select
          key={`${state.attempt}-${filled}`}
          name="fuel_type_code"
          defaultValue={values.fuel_type_code}
          onChange={(e) => setValues({ ...values, fuel_type_code: e.target.value })}
          className={INPUT}
        >
          <option value="">Not set</option>
          {fuelTypes.map((f) => (
            <option key={f.code} value={f.code.toLowerCase()}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      {FIELDS.map((f) => (
        <label key={f.name} className={LABEL}>
          {f.label}
          <input
            name={f.name}
            inputMode="decimal"
            value={values[f.name]}
            onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            placeholder={f.placeholder}
            className={INPUT}
          />
        </label>
      ))}
      <div className="col-span-2 flex items-end gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-caps rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
        >
          {pending ? "Saving…" : existing ? `Save ${existing.aircraft_type}` : "Add aircraft type"}
        </button>
      </div>
      {state.status === "error" && state.message ? (
        <p role="alert" className="col-span-full text-xs text-status-red">
          {state.message}
        </p>
      ) : null}
      {state.status === "ok" && state.message ? (
        <p role="status" className="col-span-full text-xs font-semibold text-status-green">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
