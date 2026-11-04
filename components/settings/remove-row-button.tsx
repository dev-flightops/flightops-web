"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * The Remove on a settings row: asks first, as legacy's forms did, then runs
 * the row's server action. The action says why when it can't.
 */
export function RemoveRowButton({
  label,
  confirm,
  action,
}: {
  /** Says which row, for a screen reader: "Remove the rate for all pilots". */
  label: string;
  confirm: string;
  action: () => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!window.confirm(confirm)) return;
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label={label}
        className="text-xs text-status-red hover:underline disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error ? (
        <span role="alert" className="max-w-[16rem] whitespace-normal text-right text-xs text-status-red">
          {error}
        </span>
      ) : null}
    </span>
  );
}
