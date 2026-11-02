"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { removeEquipmentAction, restoreEquipmentAction } from "@/app/(app)/equipment/[id]/actions";
import { buttonOutline } from "@/components/ff/controls";

/**
 * Edit a unit, take it off the list, or put it back (#134). Legacy had all
 * three; the port had none. Removing keeps the record, its maintenance and
 * its documents (legacy's soft delete), so a unit removed by mistake comes
 * back with Put back.
 */
export function UnitListControls({ unitId, name, isActive }: { unitId: string; name: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ status: string; message?: string }>) => {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.status === "ok") router.refresh();
      else if (result.status === "api-error") setError(result.message ?? "That didn't work.");
    });
  };

  return (
    <>
      {isActive ? (
        <>
          <Link href={`/equipment/${unitId}/edit`} className={buttonOutline}>
            Edit
          </Link>
          <button
            type="button"
            className={buttonOutline}
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Take ${name} off the equipment list? Its record and documents are kept.`)) {
                run(() => removeEquipmentAction(unitId));
              }
            }}
          >
            {pending ? "Removing…" : "Remove"}
          </button>
        </>
      ) : (
        <button type="button" className={buttonOutline} disabled={pending} onClick={() => run(() => restoreEquipmentAction(unitId))}>
          {pending ? "Putting back…" : "Put back on the list"}
        </button>
      )}
      {error ? (
        <p role="alert" className="field-error w-full">
          {error}
        </p>
      ) : null}
    </>
  );
}
