"use client";

import { buttonOutline } from "@/components/ff/controls";
import { CloseGlyph, PlusGlyph } from "@/components/ff/glyphs";
import { type BagDraft, MAX_BAGS, MAX_BAGS_LBS, bagInputs, bagsSummary, newDraft } from "@/lib/bags";
import { cn } from "@/lib/utils";

const INPUT = "ff-input px-3 py-2 text-sm";

/**
 * A passenger's bags, each with its weight, carried on or checked, and what
 * it looks like (the client, 18 Nov). `value` null is not answered yet; an
 * empty list is "No bags". With `name`, the bags go with the form as that
 * field, as JSON.
 */
export function BagsEditor({
  value,
  onChange,
  required = false,
  name,
  disabled = false,
  hint,
}: {
  value: BagDraft[] | null;
  onChange: (next: BagDraft[] | null) => void;
  /** The company asks for the bags at check-in. */
  required?: boolean;
  name?: string;
  disabled?: boolean;
  /** A line under the heading, e.g. what was booked. */
  hint?: string;
}) {
  const rows = value ?? [];
  const none = value !== null && value.length === 0;

  function update(key: string, patch: Partial<BagDraft>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="field-label">
        Bags
        {required ? (
          <span className="text-status-red" aria-hidden>
            {" *"}
          </span>
        ) : null}
      </legend>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {rows.map((row, i) => (
        <div
          key={row.key}
          role="group"
          aria-label={`Bag ${i + 1}`}
          className="flex flex-wrap items-end gap-x-3 gap-y-2 border-l-[3px] border-l-border pl-3"
        >
          <label className="block w-24">
            <span className="field-label">Weight (lb)</span>
            <input
              type="number"
              inputMode="decimal"
              required
              min={0}
              max={MAX_BAGS_LBS}
              step="0.1"
              value={row.weight}
              onChange={(e) => update(row.key, { weight: e.target.value })}
              className={cn(INPUT, "w-full")}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={row.carryOn}
              onChange={(e) => update(row.key, { carryOn: e.target.checked })}
            />
            Carry-on
          </label>
          <label className="block min-w-[12rem] flex-1">
            <span className="field-label">Description</span>
            <input
              maxLength={200}
              value={row.description}
              placeholder="Black duffel, red tag"
              onChange={(e) => update(row.key, { description: e.target.value })}
              className={cn(INPUT, "w-full")}
            />
          </label>
          <button
            type="button"
            aria-label={`Remove bag ${i + 1}`}
            onClick={() => onChange(rows.filter((other) => other.key !== row.key))}
            className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <CloseGlyph className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => onChange([...rows, newDraft()])}
          disabled={rows.length >= MAX_BAGS}
          className={cn(buttonOutline, "inline-flex items-center gap-1.5 px-3 py-1.5")}
        >
          <PlusGlyph className="h-3 w-3" />
          Add bag
        </button>
        {rows.length === 0 ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={none} onChange={(e) => onChange(e.target.checked ? [] : null)} />
            No bags
          </label>
        ) : (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {bagsSummary(bagInputs(rows))}
          </p>
        )}
      </div>
      {name && value !== null ? <input type="hidden" name={name} value={JSON.stringify(bagInputs(rows))} /> : null}
    </fieldset>
  );
}
