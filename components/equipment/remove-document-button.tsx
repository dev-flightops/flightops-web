"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteGseDocumentAction } from "@/app/(app)/equipment/[id]/actions";
import { linkCaps } from "@/components/ff/controls";

export function RemoveDocumentButton({ unitId, documentId, title }: { unitId: string; documentId: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={linkCaps}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Remove ${title} from this unit?`)) return;
          setError(null);
          start(async () => {
            const result = await deleteGseDocumentAction(unitId, documentId);
            if (result.status === "ok") router.refresh();
            else if (result.status === "api-error") setError(result.message);
          });
        }}
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error ? (
        <span role="alert" className="field-error block">
          {error}
        </span>
      ) : null}
    </>
  );
}
