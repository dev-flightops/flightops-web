"use client";

import { useState } from "react";

import type { CurrencyItemRef } from "@/lib/api/types";

import { LogCompletionModal } from "./log-completion-modal";

/**
 * Trigger button for the Log Completion modal. Lives on each
 * currency-item card; pre-fills pilot + item when opening.
 */
export function LogCompletionButton({
  pilotId,
  pilotName,
  item,
}: {
  pilotId: string;
  pilotName: string;
  item: CurrencyItemRef;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-status-blue/40 bg-status-blue/10 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/15"
      >
        Log Completion
      </button>
      {open && (
        <LogCompletionModal
          pilotId={pilotId}
          pilotName={pilotName}
          item={item}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
