"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import type { UserRef } from "@/lib/api/types";

import { updateSummaryAction } from "./summary-actions";

/**
 * SIC pilot picker on Tab 1 (Flight Info).
 *
 * The roster (`candidates`) is fetched server-side from the
 * compliance board's pilot list — every active pilot in the tenant.
 * Pilots can't pick themselves; submitted-mode disables the picker.
 *
 * Save model matches the rest of the elog: on change, fire PATCH +
 * router.refresh(). No optimistic UI — the SIC selection cascades
 * into the M2-M-9b currency recompute on submit, so we want the
 * server's view of truth.
 */
export function SicPicker({
  logId,
  initialSic,
  candidates,
  selfUserId,
  readOnly,
}: {
  logId: string;
  initialSic: UserRef | null;
  candidates: UserRef[];
  /** The currently-logged-in user — filtered out so a pilot can't
   *  pick themselves as their own SIC. */
  selfUserId: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<string>(initialSic?.id ?? "");

  const options = candidates
    .filter((c) => c.id !== selfUserId)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  function commit(nextId: string) {
    if (nextId === (initialSic?.id ?? "")) return;
    startTransition(async () => {
      setError(null);
      const result = await updateSummaryAction(logId, {
        sic_user_id: nextId === "" ? null : nextId,
      });
      if (result.status === "error") {
        setError(result.message);
        setValue(initialSic?.id ?? ""); // rollback
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          SIC / Check Airman / Instructor / Advisory
        </span>
        {pending && (
          <span className="inline-flex items-center gap-1.5 text-[0.6rem] text-muted-foreground">
            <Spinner size="xs" /> Saving…
          </span>
        )}
      </div>
      <select
        aria-label="SIC / Check Airman / Instructor / Advisory"
        value={value}
        disabled={readOnly || pending}
        onChange={(e) => {
          setValue(e.target.value);
          commit(e.target.value);
        }}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs disabled:opacity-60"
      >
        <option value="">— No SIC (single-pilot flight)</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[0.6rem] text-muted-foreground">
        Selecting a SIC routes per-leg SIC landings + Tab 4 SIC counters
        into their currency records on submit.
      </p>
      {error && (
        <p role="alert" className="mt-1 text-[0.6rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
