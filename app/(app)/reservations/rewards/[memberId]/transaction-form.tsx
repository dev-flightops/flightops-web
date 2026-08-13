"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  QUYANA_TRANSACTION_TYPE_LABELS,
  QUYANA_TRANSACTION_TYPES,
  type QuyanaTransactionType,
} from "@/lib/api/rewards";

import { createTransactionAction, type QuyanaActionState } from "../actions";

const INITIAL: QuyanaActionState = { status: "idle" };

/** Manual points ledger update. Positive for earn/adjustment,
 *  negative for redeem/expire. Backend enforces balance never
 *  goes below zero and returns 422 if the customer redeems
 *  more than they have; we surface that as a friendly message. */
export function TransactionForm({ memberId }: { memberId: string }) {
  const router = useRouter();
  const boundAction = createTransactionAction.bind(null, memberId);
  const [state, action, pending] = useActionState(boundAction, INITIAL);

  useEffect(() => {
    if (state.status === "ok") {
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
    >
      <label className="block">
        <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Type
        </span>
        <select
          name="transaction_type"
          defaultValue=""
          required
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Select…
          </option>
          {(QUYANA_TRANSACTION_TYPES as readonly QuyanaTransactionType[]).map(
            (t) => (
              <option key={t} value={t}>
                {QUYANA_TRANSACTION_TYPE_LABELS[t]}
              </option>
            ),
          )}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Points
        </span>
        <input
          type="number"
          name="points"
          required
          placeholder="e.g. 500 or -100"
          className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block flex-1 min-w-[12rem]">
        <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Description
        </span>
        <input
          type="text"
          name="description"
          maxLength={500}
          placeholder="Optional — e.g. PGR101 booking"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-[38px] rounded-md bg-status-blue px-4 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Recording…" : "Record"}
      </button>
      {state.status === "error" && state.message ? (
        <span role="alert" className="basis-full text-xs text-status-red">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
