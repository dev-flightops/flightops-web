"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import type { SelectionEntry } from "@/lib/api/drug-alcohol";

import { entryAction } from "../../actions";

/**
 * What can be done for a person picked: record telling them, enter their
 * test (which answers the selection), excuse them with the reason, or put
 * an excused person back on the list.
 */
export function EntryButtons({ selectionId, entry }: { selectionId: string; entry: SelectionEntry }) {
  const [excusing, setExcusing] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const who = entry.full_name ?? "them";

  function run(action: "notify" | "excuse" | "reopen") {
    startTransition(async () => {
      setMessage(null);
      const result = await entryAction(selectionId, entry.id, action, reason);
      if (result.ok) setExcusing(false);
      else setMessage(result.message);
    });
  }

  if (entry.status === "tested") return null;

  return (
    <span className="flex flex-col items-end gap-1">
      {entry.status === "excused" ? (
        <button type="button" className={linkCaps} onClick={() => run("reopen")} disabled={pending}>
          Back on the list<span className="sr-only">: {who}</span>
        </button>
      ) : excusing ? (
        <span className="flex flex-wrap items-center justify-end gap-2">
          <label htmlFor={`excuse-${entry.id}`} className="sr-only">
            Why {who} is excused
          </label>
          <input
            id={`excuse-${entry.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            placeholder="Why they're excused"
            className="ff-input px-3 py-1.5 text-sm"
          />
          <button type="button" className={buttonSolid} onClick={() => run("excuse")} disabled={pending}>
            Excuse
          </button>
          <button type="button" className={buttonOutline} onClick={() => setExcusing(false)} disabled={pending}>
            Cancel
          </button>
        </span>
      ) : (
        <span className="flex flex-wrap items-center justify-end gap-3">
          {entry.status === "selected" ? (
            <button type="button" className={linkCaps} onClick={() => run("notify")} disabled={pending}>
              Notified now<span className="sr-only">: {who}</span>
            </button>
          ) : null}
          <Link
            href={`/employees/drug-alcohol/employees/${entry.user_id}?entry=${entry.id}&panel=${entry.panel}`}
            className={linkCaps}
          >
            Enter test<span className="sr-only"> for {who}</span> <span aria-hidden>›</span>
          </Link>
          <button type="button" className={linkCaps} onClick={() => setExcusing(true)} disabled={pending}>
            Excuse<span className="sr-only"> {who}</span>
          </button>
        </span>
      )}
      {message ? (
        <span role="alert" className="field-error">
          {message}
        </span>
      ) : null}
    </span>
  );
}
