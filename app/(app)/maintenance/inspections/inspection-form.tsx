"use client";

import Link from "next/link";
import { useActionState } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import type { InspectionDetail } from "@/lib/api/inspections";

import { startInspectionAction, updateInspectionAction, type InspectionFormState } from "./actions";

type Option = { value: string; label: string };

/**
 * Start an inspection, or edit its details (#178), legacy's
 * inspection_form.html. The aircraft and the start date are set when it
 * starts; the aircraft's total time is taken then.
 */
export function InspectionForm({
  inspection,
  aircraft,
  types,
  staff,
  vendors,
  today,
  defaultAircraftId,
}: {
  inspection: InspectionDetail | null;
  aircraft: Option[];
  types: Option[];
  staff: Option[];
  vendors: Option[];
  today: string;
  defaultAircraftId?: string;
}) {
  const [state, action, pending] = useActionState<InspectionFormState, FormData>(
    inspection
      ? updateInspectionAction.bind(null, inspection.id, inspection.work_order_id)
      : startInspectionAction,
    { status: "idle" },
  );
  const errors = state.status === "field-errors" ? state.errors : {};
  const error = (name: string) =>
    errors[name] ? (
      <p role="alert" className="field-error">
        {errors[name]}
      </p>
    ) : null;
  const select = (name: string, label: string, options: Option[], value: string, blank?: string) => (
    <div>
      <label htmlFor={`insp-${name}`} className="field-label">
        {label}
      </label>
      <select id={`insp-${name}`} name={name} defaultValue={value} className="ff-input px-3 py-2 text-sm">
        {blank !== undefined ? <option value="">{blank}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error(name)}
    </div>
  );

  return (
    <form action={action} className="space-y-4">
      {state.status === "api-error" ? (
        <p role="alert" className="notice notice-red">
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {inspection ? (
          <div>
            <p className="field-label">Aircraft</p>
            <p className="py-2 font-mono text-sm font-semibold">{inspection.tail_number}</p>
          </div>
        ) : (
          select("aircraft_id", "Aircraft *", aircraft, defaultAircraftId ?? "", "Pick the aircraft")
        )}
        {select("inspection_type", "Type", types, inspection?.inspection_type ?? "annual")}
      </div>
      <div>
        <label htmlFor="insp-title" className="field-label">
          Title<span className="text-status-red"> *</span>
        </label>
        <input
          id="insp-title"
          name="title"
          required
          maxLength={300}
          defaultValue={inspection?.title ?? ""}
          placeholder="e.g. Annual 2026"
          aria-invalid={errors.title ? "true" : undefined}
          className="ff-input px-3 py-2 text-sm"
        />
        {error("title")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {inspection ? (
          <div>
            <p className="field-label">Started</p>
            <p className="py-2 text-sm">{inspection.started_on}</p>
          </div>
        ) : (
          <div>
            <label htmlFor="insp-started_on" className="field-label">
              Started
            </label>
            <input id="insp-started_on" name="started_on" type="date" defaultValue={today} className="ff-input px-3 py-2 text-sm" />
            {error("started_on")}
          </div>
        )}
        <div>
          <label htmlFor="insp-target_on" className="field-label">
            Target Date
          </label>
          <input
            id="insp-target_on"
            name="target_on"
            type="date"
            defaultValue={inspection?.target_on ?? ""}
            className="ff-input px-3 py-2 text-sm"
          />
          {error("target_on")}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {select("assigned_to_user_id", "Assigned To", staff, inspection?.assigned_to_user_id ?? "", "No one yet")}
        {select("vendor_id", "Done By Vendor", vendors, inspection?.vendor_id ?? "", "In house")}
      </div>
      <div>
        <label htmlFor="insp-notes" className="field-label">
          Notes
        </label>
        <textarea id="insp-notes" name="notes" rows={3} defaultValue={inspection?.notes ?? ""} className="ff-input px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" disabled={pending} className={buttonSolid}>
          {inspection ? "Save" : "Start Inspection"}
        </button>
        <Link
          href={inspection ? `/maintenance/inspections/${inspection.id}` : "/maintenance/inspections"}
          className={buttonOutline}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
