"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { reassignAircraftAction } from "@/app/(app)/dashboards/dispatcher/actions";
import { buttonOutline } from "@/components/ff/controls";

/** Give an aircraft taken today to another pilot (#93: "Dispatch can reassign"). */
export function ReassignAircraft({
  preflightId,
  tail,
  currentPilotId,
  pilots,
}: {
  preflightId: string;
  tail: string;
  currentPilotId: string;
  pilots: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const others = pilots.filter((p) => p.id !== currentPilotId);
  if (!others.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`Give ${tail} to`}
        className="ff-input h-8 py-0 text-xs"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      >
        <option value="" disabled>
          Give to…
        </option>
        {others.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={buttonOutline}
        disabled={pending || !to}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await reassignAircraftAction(preflightId, to);
            if (result.ok) router.refresh();
            else setError(result.error ?? "Couldn't move the aircraft.");
          });
        }}
      >
        {pending ? "Moving…" : "Give"}
      </button>
      {error ? (
        <p role="alert" className="field-error w-full">
          {error}
        </p>
      ) : null}
    </div>
  );
}
