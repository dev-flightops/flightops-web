"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  PAY_EVENT_TYPES,
  PAY_EVENT_TYPE_LABELS,
  type PayEventType,
} from "@/lib/api/payroll";
import type { UserResponse } from "@/lib/api/types";

import {
  createPayEventAction,
  type PayEventActionState,
} from "../actions";

const INITIAL: PayEventActionState = { status: "idle" };

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function NewPayEventForm({ employees }: { employees: UserResponse[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createPayEventAction,
    INITIAL,
  );

  useEffect(() => {
    if (state.status === "ok") {
      // Small delay so the "created" toast is visible before we
      // jump back to the list.
      const t = setTimeout(() => router.push("/payroll"), 400);
      return () => clearTimeout(t);
    }
  }, [state.status, router]);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Employee
          </span>
          <select
            name="employee_user_id"
            required
            defaultValue=""
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select an employee…
            </option>
            {employees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} {u.emp_number ? `(${u.emp_number})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Event Type
          </span>
          <select
            name="event_type"
            required
            defaultValue=""
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select a type…
            </option>
            {(PAY_EVENT_TYPES as readonly PayEventType[]).map((t) => (
              <option key={t} value={t}>
                {PAY_EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Event Date
          </span>
          <input
            type="date"
            name="event_date"
            required
            defaultValue={todayIso()}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Hours
          </span>
          <input
            type="number"
            name="hours"
            step="0.01"
            min="0"
            placeholder="e.g. 3.50"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Amount ($)
          </span>
          <input
            type="number"
            name="amount"
            step="0.01"
            min="0"
            placeholder="e.g. 250.00"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <p className="text-xs text-muted-foreground/70">
        Enter Hours for time-based events (flight/duty/training), Amount
        for dollar events (per diem, expense, deduction), or both if
        the event carries both a rate and a fixed adjustment.
      </p>

      <label className="block">
        <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Description
        </span>
        <input
          type="text"
          name="description"
          maxLength={200}
          placeholder="e.g. GV101 PADU → PANC"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Notes
        </span>
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}
      {state.status === "ok" && state.message ? (
        <div
          role="status"
          className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          {state.message} — redirecting…
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <a
          href="/payroll"
          className="rounded-md border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/30"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Pay Event"}
        </button>
      </div>
    </form>
  );
}
