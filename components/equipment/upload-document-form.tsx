"use client";

import { useActionState, useRef, useState } from "react";

import { type EquipmentActionState, uploadGseDocumentAction } from "@/app/(app)/equipment/[id]/actions";
import { buttonSolid } from "@/components/ff/controls";
import { GSE_DOCUMENT_TYPES } from "@/lib/equipment/document-types";
import { formOversizeMessage, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

const INITIAL: EquipmentActionState = { status: "idle" };

/** Keep a file with the unit (#134): its manual, an inspection record. */
export function UploadDocumentForm({ unitId }: { unitId: string }) {
  const [state, dispatch, pending] = useActionState(uploadGseDocumentAction.bind(null, unitId), INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  // Cleared once uploaded, so the next one doesn't send the same file.
  if (state.status === "ok" && formRef.current) formRef.current.reset();

  const error =
    sizeError ??
    (state.status === "api-error" ? state.message : state.status === "field-errors" ? state.errors.file : null);

  return (
    <form
      ref={formRef}
      action={dispatch}
      onSubmit={(e) => {
        const tooBig = formOversizeMessage(e.currentTarget);
        setSizeError(tooBig);
        if (tooBig) e.preventDefault();
      }}
      aria-label="Upload a document"
      className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
    >
      <label>
        <span className="field-label">File (up to {MAX_UPLOAD_LABEL})</span>
        <input name="file" type="file" required disabled={pending} className="ff-input py-1.5 text-sm" />
      </label>
      <label>
        <span className="field-label">Title</span>
        <input name="title" maxLength={300} placeholder="The file's name" disabled={pending} className="ff-input" />
      </label>
      <label>
        <span className="field-label">Type</span>
        <select name="doc_type" defaultValue="manual" disabled={pending} className="ff-input">
          {GSE_DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={buttonSolid} disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </button>
      {error ? (
        <p role="alert" className="field-error sm:col-span-4">
          {error}
        </p>
      ) : null}
    </form>
  );
}
