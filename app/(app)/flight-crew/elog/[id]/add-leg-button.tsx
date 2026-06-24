"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

import { addLegAction } from "./legs-actions";

/**
 * "+ Add Leg" trigger. Server action does the actual POST + path
 * revalidation; we follow up with router.refresh() so the new leg
 * card appears in this same render rather than after a manual
 * reload.
 */
export function AddLegButton({ logId }: { logId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await addLegAction(logId);
      if (result.status === "ok") {
        router.refresh();
      } else {
        // Surface as an alert(); a richer toast lands when the
        // dispatch packet adopts a global toast system. Spec 4 doesn't
        // call for inline error rendering on this button.
         
        alert(result.message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-status-blue/40 bg-status-blue/10 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/15 disabled:opacity-50"
    >
      {pending && <Spinner size="xs" />}
      + Add Leg
    </button>
  );
}
