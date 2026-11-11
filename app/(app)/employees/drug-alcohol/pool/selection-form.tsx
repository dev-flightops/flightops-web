"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonSolid, segment, segmentGroup } from "@/components/ff/controls";

import { createSelectionAction } from "../actions";

/**
 * A random selection, legacy's Run Random Draw: drawn here from the pool,
 * each person equally likely, or entered from the list a consortium drew.
 * The selected aren't told by FlightOps: the DER notifies each one when
 * they're sent to test, since a random test is unannounced.
 */
export function SelectionForm({
  poolSize,
  people,
}: {
  poolSize: number;
  people: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    method: "drawn",
    panel: "both",
    count: "1",
    user_ids: [] as string[],
    period_label: "",
    source: "",
    notes: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (name: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [name]: e.target.value }));

  if (poolSize === 0) {
    return <p className="text-sm text-muted-foreground">No one is in the random pool yet.</p>;
  }

  return (
    <form
      method="post"
      aria-label="New random selection"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setMessage(null);
          const result = await createSelectionAction(values);
          if (result.ok && result.id) router.push(`/employees/drug-alcohol/selections/${result.id}`);
          else if (!result.ok) setMessage(result.message);
        });
      }}
    >
      <div role="radiogroup" aria-label="How the selection is made" className={segmentGroup}>
        {[
          { value: "drawn", label: "Draw here" },
          { value: "entered", label: "Enter a consortium's list" },
        ].map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={values.method === m.value}
            className={segment(values.method === m.value)}
            onClick={() => setValues((v) => ({ ...v, method: m.value }))}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="selection-panel" className="field-label">
            Tested For
          </label>
          <select id="selection-panel" value={values.panel} onChange={set("panel")} className="ff-input w-full px-3 py-2 text-sm">
            <option value="both">Drug and alcohol</option>
            <option value="drug">Drug only</option>
            <option value="alcohol">Alcohol only</option>
          </select>
        </div>
        {values.method === "drawn" ? (
          <div>
            <label htmlFor="selection-count" className="field-label">
              How Many<span className="text-status-red"> *</span>
            </label>
            <input
              id="selection-count"
              type="number"
              min={1}
              max={poolSize}
              value={values.count}
              onChange={set("count")}
              className="ff-input w-full px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">From the {poolSize} in the pool.</p>
          </div>
        ) : (
          <div>
            <label htmlFor="selection-source" className="field-label">
              Whose List<span className="text-status-red"> *</span>
            </label>
            <input
              id="selection-source"
              value={values.source}
              onChange={set("source")}
              maxLength={200}
              placeholder="The consortium's name"
              className="ff-input w-full px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label htmlFor="selection-period" className="field-label">
            Period
          </label>
          <input
            id="selection-period"
            value={values.period_label}
            onChange={set("period_label")}
            maxLength={80}
            placeholder="Q4 2026"
            className="ff-input w-full px-3 py-2 text-sm"
          />
        </div>
      </div>
      {values.method === "entered" ? (
        <fieldset>
          <legend className="field-label">On the List</legend>
          <div className="grid gap-1 sm:grid-cols-3">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.user_ids.includes(p.id)}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      user_ids: e.target.checked ? [...v.user_ids, p.id] : v.user_ids.filter((x) => x !== p.id),
                    }))
                  }
                />
                {p.full_name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div>
        <label htmlFor="selection-notes" className="field-label">
          Notes
        </label>
        <input id="selection-notes" value={values.notes} onChange={set("notes")} maxLength={4000} className="ff-input w-full px-3 py-2 text-sm" />
      </div>
      {message ? (
        <p role="alert" className="field-error">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Saving…" : values.method === "drawn" ? "Draw" : "Enter the List"}
        </button>
      </div>
    </form>
  );
}
