"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

import { cancelStaleFlightsAction } from "./actions";

/**
 * "Cancel N stale flight(s)" button on the EOD page (M2-G-25).
 *
 * Client component because we want a useTransition spinner during the
 * server action + a `confirm()` prompt before the (non-trivial)
 * status change goes through. Loops server-side, one cancel per row.
 *
 * On partial failure (some flights raced into a non-cancellable
 * state) we surface a one-time alert with the count; the page
 * re-fetches via revalidatePath so the survivors disappear from the
 * Stale section.
 */
export function CancelStaleButton({ flightIds }: { flightIds: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const n = flightIds.length;

  const onClick = () => {
    const message =
      n === 1
        ? "Cancel 1 stale planned flight?"
        : `Cancel ${n} stale planned flights?`;
    if (!window.confirm(message)) return;

    startTransition(async () => {
      const result = await cancelStaleFlightsAction(flightIds);
      if (result.failures.length > 0) {
        const summary =
          result.failures.length === n
            ? "All cancels failed."
            : `${result.cancelled} cancelled, ${result.failures.length} failed (${result.failures[0].reason}).`;
        window.alert(summary);
      }
      // Server action already calls revalidatePath; refresh keeps
      // the cached client tree in sync.
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-status-red px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
    >
      {pending && <Spinner size="xs" />}
      {pending ? "Cancelling…" : `Cancel ${n} Stale Flight${n === 1 ? "" : "s"}`}
    </button>
  );
}
