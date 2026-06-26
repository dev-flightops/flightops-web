"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

import { updateMiscAction } from "./misc-actions";

/**
 * Editable MX Discrepancy textarea (Spec 4 §"Tab 7: Misc").
 *
 * Save model matches the other elog tabs: local typing state, PATCH
 * on blur only when the value actually changed. Empty input writes
 * null (clears the field) — the M2-M-9 chain treats null as "no
 * discrepancy" and skips the work-order auto-fire.
 *
 * Submitted-log mode renders the same textarea but disables it so
 * the pilot can read what was reported without editing.
 */
export function MxDiscrepancyField({
  logId,
  initialValue,
  readOnly,
}: {
  logId: string;
  initialValue: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(initialValue);

  function commit() {
    if (value === initialValue) return; // no change → skip PATCH
    const trimmed = value.trim();
    const payload = trimmed === "" ? null : trimmed;
    startTransition(async () => {
      setError(null);
      const result = await updateMiscAction(logId, {
        mx_discrepancy: payload,
      });
      if (result.status === "error") {
        setError(result.message);
        setValue(initialValue);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <label
        htmlFor="mx-discrepancy"
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        MX Discrepancy
      </label>
      <textarea
        id="mx-discrepancy"
        rows={3}
        value={value}
        maxLength={4000}
        disabled={readOnly || pending}
        placeholder={
          readOnly
            ? "No discrepancy reported."
            : "Describe any maintenance issues found during flight…"
        }
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 disabled:opacity-60"
      />
      <p className="mt-1 text-[0.65rem] text-muted-foreground">
        Auto-creates a work order in Maintenance on submit.
      </p>
      {pending && (
        <p className="mt-1 inline-flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
          <Spinner size="xs" /> Saving…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
