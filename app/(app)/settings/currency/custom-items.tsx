"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import type { CurrencyItemRef } from "@/lib/api/types";

import {
  addCustomItemAction,
  renameCustomItemAction,
  setCustomItemActiveAction,
  type CustomItemFormState,
} from "./actions";

const _initial: CustomItemFormState = { status: "idle", attempt: 0 };

const INPUT = "ff-input px-2 py-1.5 text-sm";

/**
 * Legacy's New Custom Item (templates/currency/item_manager.html), with what
 * this catalogue keeps: the roles and aircraft types legacy could narrow an
 * item to aren't kept here, so an item applies to every pilot.
 */
export function NewCustomItemForm() {
  const [state, formAction, pending] = useActionState(addCustomItemAction, _initial);
  const [intervalType, setIntervalType] = useState("annual");
  return (
    <section id="new-custom-item" className="mb-5 scroll-mt-20 rounded-lg border border-border bg-card p-5">
      <h2 className="panel-title mb-1">New Custom Item</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        It applies to every pilot from today. Until a completion is logged, a pilot&apos;s record reads Not started,
        which dispatch sees as a warning to acknowledge at release.
      </p>
      <form action={formAction} aria-label="New custom item" className="flex flex-wrap items-end gap-3">
        <label className="w-72 max-w-full">
          <span className="field-label">Name</span>
          <input name="name" required maxLength={128} placeholder="YK Delta Route Authorization" className={INPUT} />
        </label>
        <label className="w-56 max-w-full">
          <span className="field-label">Regulatory reference</span>
          <input name="regulation" required maxLength={64} placeholder="Company GOM 4.2" className={INPUT} />
        </label>
        <label className="w-40">
          <span className="field-label">Interval</span>
          <select
            name="interval_type"
            value={intervalType}
            onChange={(e) => setIntervalType(e.target.value)}
            className={INPUT}
          >
            <option value="annual">Annual</option>
            <option value="semi_annual">Semi-annual</option>
            <option value="rolling_days">Rolling days</option>
          </select>
        </label>
        {intervalType === "rolling_days" ? (
          <>
            <label className="w-28">
              <span className="field-label">Days</span>
              <input name="rolling_days" type="number" min={1} max={3650} required placeholder="90" className={INPUT} />
            </label>
            <label className="w-28">
              <span className="field-label">How many</span>
              <input
                name="rolling_threshold"
                type="number"
                min={1}
                max={1000}
                required
                placeholder="3"
                className={INPUT}
              />
            </label>
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-4 pb-2 text-xs">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_check_event" /> Check event
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="requires_examiner" /> Requires examiner
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_initial_only" /> Initial only
          </label>
        </div>
        <button type="submit" disabled={pending} className={`${buttonSolid} disabled:opacity-60`}>
          {pending ? "Adding…" : "Add item"}
        </button>
        {state.status === "error" && state.message ? (
          <p role="alert" className="w-full text-xs text-status-red">
            {state.message}
          </p>
        ) : null}
        {state.status === "ok" && state.message ? (
          <p role="status" className="w-full text-xs font-semibold text-status-green">
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}

/** Edit and Deactivate or Reactivate, on a company's own item. */
export function CustomItemActions({ item }: { item: CurrencyItemRef }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [regulation, setRegulation] = useState(item.regulation);
  const [error, setError] = useState<string | null>(null);

  function run(work: () => ReturnType<typeof setCustomItemActiveAction>, done?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      done?.();
      router.refresh();
    });
  }

  function toggle() {
    const verb = item.is_active ? "Deactivate" : "Reactivate";
    if (!window.confirm(`${verb} ${item.name}? Records already logged are kept.`)) return;
    run(() => setCustomItemActiveAction(item.id, !item.is_active));
  }

  const failure = error ? (
    <p role="alert" className="mt-1 max-w-[18rem] whitespace-normal text-left text-xs text-status-red">
      {error}
    </p>
  ) : null;

  if (editing) {
    return (
      <div className="flex min-w-[16rem] flex-col gap-2 text-left">
        <label>
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={128} className={INPUT} />
        </label>
        <label>
          <span className="field-label">Regulatory reference</span>
          <input value={regulation} onChange={(e) => setRegulation(e.target.value)} maxLength={64} className={INPUT} />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => renameCustomItemAction(item.id, name, regulation), () => setEditing(false))}
            className={`${buttonSolid} px-3 py-1.5 disabled:opacity-60`}
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" disabled={pending} onClick={() => setEditing(false)} className={`${buttonOutline} px-3 py-1.5`}>
            Cancel
          </button>
        </div>
        {failure}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center justify-end gap-3 whitespace-nowrap text-xs">
        <button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${item.name}`} className="text-primary hover:underline">
          Edit
        </button>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-label={`${item.is_active ? "Deactivate" : "Reactivate"} ${item.name}`}
          className={item.is_active ? "text-status-red hover:underline" : "text-primary hover:underline"}
        >
          {item.is_active ? "Deactivate" : "Reactivate"}
        </button>
      </div>
      {failure}
    </div>
  );
}
