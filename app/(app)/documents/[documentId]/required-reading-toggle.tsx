"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateDocumentAction } from "../actions";

/**
 * Make a document required reading: everyone is asked to acknowledge its
 * current version, and it joins the Required Reading list.
 *
 * The flag existed on every document and the API took it on create and
 * update, but nothing in the app could set it, so a bulletin uploaded
 * today could never be made required reading. Mirrors the
 * compliance-source toggle beside it: optimistic, snapped back when the
 * server refuses (the API gates the PATCH on exec-admin claims).
 */
export function RequiredReadingToggle({
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
    setValue(next);
    startTransition(async () => {
      const result = await updateDocumentAction(documentId, {
        requires_acknowledgment: next,
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
            Required reading
          </span>
          <span className="mt-0.5 block text-[0.7rem] leading-relaxed text-muted-foreground">
            Everyone is asked to read the current version and acknowledge it.
            Each acknowledgment is logged with its version, and the document
            joins the Required Reading list until it&rsquo;s read.
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
