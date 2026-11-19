"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setMelLimitAction } from "@/app/(app)/dispatch/maintenance-actions";
import type { MelOperatingLimit } from "@/lib/api/types";
import { MEL_LIMIT_LABELS } from "@/lib/maintenance/mel-limits";

/**
 * What an open deferral limits the aircraft to, changed in place (#200):
 * the client's nav light was deferred with "day VFR only" written in its
 * description, which nothing could read. Maintenance's (the DOM or a
 * mechanic): the release reads it.
 */
export function MelLimitSelect({
  melItemId,
  ataChapter,
  limit,
}: {
  melItemId: string;
  ataChapter: string;
  limit: MelOperatingLimit | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState<MelOperatingLimit | "">(limit ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: MelOperatingLimit | "") => {
    const before = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setMelLimitAction(melItemId, next || null);
      if (result.ok) {
        router.refresh();
      } else {
        setValue(before);
        setError(result.error);
      }
    });
  };

  return (
    <div>
      <select
        aria-label={`Limit for MEL ${ataChapter}`}
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value as MelOperatingLimit | "")}
        className="ff-input h-8 py-1 text-xs"
      >
        <option value="">None</option>
        <option value="day_vfr">{MEL_LIMIT_LABELS.day_vfr}</option>
        <option value="vfr">{MEL_LIMIT_LABELS.vfr}</option>
      </select>
      {error ? (
        <p role="alert" className="field-error mt-1">
          {error}
        </p>
      ) : null}
    </div>
  );
}
