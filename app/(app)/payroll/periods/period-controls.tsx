"use client";

import { useActionState, useState, useTransition } from "react";

import type { PayPeriodStatus } from "@/lib/api/payroll";

import {
  createPeriodAction,
  exportPeriodAction,
  lockPeriodAction,
  type PeriodActionState,
} from "./actions";

const INITIAL: PeriodActionState = { status: "idle" };

export function NewPeriodForm() {
  const [state, formAction, pending] = useActionState(
    createPeriodAction,
    INITIAL,
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Period Start
        </span>
        <input
          type="date"
          name="period_start"
          required
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Period End
        </span>
        <input
          type="date"
          name="period_end"
          required
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="block flex-1 min-w-[10rem]">
        <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Notes
        </span>
        <input
          type="text"
          name="notes"
          maxLength={200}
          placeholder="Optional — e.g. Bi-weekly #14"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-[38px] rounded-md bg-status-blue px-4 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Creating…" : "+ New Period"}
      </button>
      {state.status === "error" && state.message ? (
        <span
          role="alert"
          className="basis-full text-xs text-status-red"
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function LockExportButtons({
  periodId,
  status,
  startIso,
  endIso,
}: {
  periodId: string;
  status: PayPeriodStatus;
  startIso: string;
  endIso: string;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onLock() {
    if (
      !confirm(
        "Lock this period? Pay events within it will roll into this period on export.",
      )
    )
      return;
    start(async () => {
      const result = await lockPeriodAction(periodId);
      if (result.status === "error") setErr(result.message ?? "Error");
      else setErr(null);
    });
  }

  function onExport() {
    start(async () => {
      const result = await exportPeriodAction(periodId);
      if ("ok" in result) {
        const filename = `payroll_${startIso}_${endIso}.csv`;
        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 100);
        setErr(null);
      } else {
        setErr(result.message ?? "Export failed");
      }
    });
  }

  const canLock = status === "open";
  const canExport = status === "locked" || status === "exported";

  return (
    <div className="flex items-center justify-end gap-3">
      {canLock ? (
        <button
          type="button"
          disabled={pending}
          onClick={onLock}
          className="text-xs font-semibold text-status-yellow hover:text-status-yellow/80 disabled:opacity-50"
        >
          Lock
        </button>
      ) : null}
      {canExport ? (
        <button
          type="button"
          disabled={pending}
          onClick={onExport}
          className="text-xs font-semibold text-status-green hover:text-status-green/80 disabled:opacity-50"
        >
          {status === "exported" ? "Re-export CSV" : "Export CSV"}
        </button>
      ) : null}
      {err ? (
        <span role="alert" className="text-xs text-status-red">
          {err}
        </span>
      ) : null}
    </div>
  );
}
