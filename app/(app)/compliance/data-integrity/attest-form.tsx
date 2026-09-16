"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AttestResult } from "./actions";

/**
 * The signature.
 *
 * A note is required, and the button says what signing does rather
 * than "Submit". The GOM makes a person accountable for this review,
 * so the affordance should read like putting a name to something —
 * and the copy is explicit that signing records the review and does
 * not clear what was found, because that is the one thing somebody
 * might reasonably assume it does.
 */

/** Matches the service. Checked here too so the button can be
 *  disabled rather than the note bouncing back as a 422. */
const MIN_NOTE = 10;

export function AttestForm({
  findingsHash,
  contradictions,
  omissions,
  canSign,
  attestAction,
}: {
  findingsHash: string;
  contradictions: number;
  omissions: number;
  /** False for the roles that can read the audit but not sign it —
   *  a chief pilot or DOM looking at what needs correcting. The button
   *  is absent rather than present-and-403. */
  canSign: boolean;
  attestAction: (
    findingsHash: string,
    notes: string,
  ) => Promise<AttestResult>;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AttestResult | null>(null);
  const [, startTransition] = useTransition();

  if (!canSign) {
    return (
      <p className="text-xs text-muted-foreground">
        Recording the review is the Director of Operations&rsquo; to sign.
      </p>
    );
  }

  const tooShort = notes.trim().length < MIN_NOTE;
  const outstanding = contradictions + omissions;

  const submit = async () => {
    setBusy(true);
    setResult(null);
    const next = await attestAction(findingsHash, notes.trim());
    setBusy(false);
    setResult(next);
    if (next.status === "ok") {
      setNotes("");
      startTransition(() => router.refresh());
    }
  };

  return (
    <div>
      <label
        htmlFor="attest-notes"
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
      >
        What you reviewed, and what you did about it
      </label>
      <textarea
        id="attest-notes"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Reviewed the window. PGR319 block time referred to dispatch for correction; missing cost factors raised with the DO."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-status-blue focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || tooShort}
          title={
            tooShort ? "Describe the review before signing it" : undefined
          }
          className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Recording…" : "Record this review"}
        </button>
        {outstanding > 0 && (
          <p className="text-[0.7rem] text-muted-foreground">
            This records that you reviewed {outstanding} outstanding{" "}
            {outstanding === 1 ? "finding" : "findings"}. It does not
            clear them.
          </p>
        )}
      </div>
      {result?.status === "stale" && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-status-yellow/40 bg-status-yellow/5 px-3 py-2 text-[0.7rem] text-status-yellow"
        >
          {result.message}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="ml-2 font-semibold underline"
          >
            Reload the audit
          </button>
        </div>
      )}
      {result?.status === "error" && (
        <p role="alert" className="mt-2 text-[0.7rem] text-status-red">
          {result.message}
        </p>
      )}
      {result?.status === "ok" && (
        <p role="status" className="mt-2 text-[0.7rem] text-status-green">
          Review recorded.
        </p>
      )}
    </div>
  );
}
