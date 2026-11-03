"use client";

import { useActionState } from "react";

import { buttonSolid } from "@/components/ff/controls";
import { Spinner } from "@/components/ui/spinner";
import { WO_PRIORITIES, WO_TYPES } from "@/lib/api/maintenance";
import type { AircraftListItem, SquawkResponse } from "@/lib/api/types";

import { createWorkOrderAction, type NewWorkOrderState } from "../actions";

const SEVERITY_PRIORITY = { grounding: "aog", major: "high", minor: "normal" } as const;

export function NewWorkOrderForm({
  aircraft,
  squawk,
  aircraftId,
  today,
}: {
  aircraft: AircraftListItem[];
  squawk: SquawkResponse | null;
  aircraftId: string | null;
  today: string;
}) {
  const [state, action, pending] = useActionState<NewWorkOrderState, FormData>(
    createWorkOrderAction,
    { status: "idle" },
  );
  const errors = state.status === "field-errors" ? state.errors : {};

  return (
    <form action={action} className="space-y-4">
      {state.status === "api-error" && (
        <p role="alert" className="notice notice-red">
          {state.message}
        </p>
      )}
      {squawk && <input type="hidden" name="squawk_id" value={squawk.id} />}
      <div>
        <label htmlFor="aircraft_id" className="field-label">
          Aircraft<span className="text-status-red"> *</span>
        </label>
        {squawk ? (
          <>
            <input type="hidden" name="aircraft_id" value={squawk.aircraft.id} />
            <p id="aircraft_id" className="font-mono text-sm font-semibold">
              {squawk.aircraft.tail_number}
              <span className="ml-2 font-sans font-normal text-muted-foreground">{squawk.aircraft.model}</span>
            </p>
          </>
        ) : (
          <select
            id="aircraft_id"
            name="aircraft_id"
            required
            defaultValue={aircraftId ?? ""}
            aria-invalid={errors.aircraft_id ? "true" : undefined}
            className="ff-input px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Pick the aircraft
            </option>
            {aircraft.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tail_number}
                {a.model ? ` · ${a.model}` : ""}
              </option>
            ))}
          </select>
        )}
        {errors.aircraft_id && (
          <p role="alert" className="field-error">
            {errors.aircraft_id}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="title" className="field-label">
          Title<span className="text-status-red"> *</span>
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={squawk ? `Squawk: ${squawk.title}` : ""}
          aria-invalid={errors.title ? "true" : undefined}
          className="ff-input px-3 py-2 text-sm"
        />
        {errors.title && (
          <p role="alert" className="field-error">
            {errors.title}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="description" className="field-label">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={4000}
          defaultValue={squawk?.description ?? ""}
          className="ff-input px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wo_type" className="field-label">
            Type
          </label>
          <select id="wo_type" name="wo_type" defaultValue="corrective" className="ff-input px-3 py-2 text-sm">
            {WO_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="priority" className="field-label">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={squawk ? SEVERITY_PRIORITY[squawk.severity] : "normal"}
            className="ff-input px-3 py-2 text-sm"
          >
            {WO_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="opened_date" className="field-label">
            Opened<span className="text-status-red"> *</span>
          </label>
          <input
            id="opened_date"
            name="opened_date"
            type="date"
            required
            defaultValue={today}
            className="ff-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="due_date" className="field-label">
            Due (optional)
          </label>
          <input id="due_date" name="due_date" type="date" className="ff-input px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={buttonSolid}>
          {pending && <Spinner size="xs" />}
          {pending ? "Opening…" : "Open work order"}
        </button>
      </div>
    </form>
  );
}
