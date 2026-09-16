"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateDocumentAction } from "../actions";

/**
 * Designate a document as a compliance source.
 *
 * Legacy carries this as a checkbox on the document edit panel
 * (`templates/documents/view.html`), and the detail page is the right
 * place for it: whether a document states a company limitation is a
 * judgement somebody makes after reading it, not something known at
 * upload time.
 *
 * WHY THIS EXISTS AT ALL
 *
 * The library's "Compliance sources only" filter had no field behind
 * it and approximated the answer from the document's category, which
 * excluded the GOM. The filter now reads a real per-document flag —
 * and a flag with no way to set it would leave that filter
 * permanently empty, so the two ship together.
 *
 * Not role-gated in the UI, matching the upload drawer on the library
 * page: the API gates the PATCH on exec-admin claims and a refusal
 * surfaces as the error line below.
 */
export function ComplianceSourceToggle({
  documentId,
  initialValue,
}: {
  documentId: string;
  initialValue: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  function onToggle(next: boolean) {
    setError(null);
    // Optimistic, then reconciled by the refresh below. On failure it
    // snaps back rather than leaving the box showing a state the
    // server rejected.
    setValue(next);
    startTransition(async () => {
      const result = await updateDocumentAction(documentId, {
        is_compliance_source: next,
      });
      if (!result.ok) {
        setValue(!next);
        setError(result.error ?? "Couldn't update this document.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={value}
          disabled={pending}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 rounded border-border"
        />
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-foreground">
            Compliance source
          </span>
          <span className="mt-0.5 block text-[0.7rem] leading-relaxed text-muted-foreground">
            This document states a company limitation — weather minimums,
            wind limits, crew rules, or policy a dispatcher has to follow.
            Marked documents appear under &ldquo;Compliance sources
            only&rdquo; in the library.
          </span>
        </span>
      </label>
      {error && (
        <p role="alert" className="mt-2 text-[0.7rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
