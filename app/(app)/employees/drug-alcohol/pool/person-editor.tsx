"use client";

import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import type { PoolPerson } from "@/lib/api/drug-alcohol";
import { FAA_CATEGORIES } from "@/lib/drug-alcohol/options";

import { savePersonAction } from "../actions";

/**
 * One employee's place in the random pool, legacy's Force in / Exclude /
 * Clear override, and their FAA category, which the MIS form counts their
 * tests under. Leaving someone out needs the reason.
 */
export function PersonEditor({ person }: { person: PoolPerson }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    pool: person.pool,
    pool_note: person.pool_note ?? "",
    category: person.category_set ? (person.category ?? "") : "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = { pool: `pool-${person.user_id}`, note: `note-${person.user_id}`, category: `category-${person.user_id}` };

  if (!open) {
    return (
      <button type="button" className={linkCaps} onClick={() => setOpen(true)}>
        Change<span className="sr-only"> {person.full_name}</span>
      </button>
    );
  }

  return (
    <form
      method="post"
      aria-label={`${person.full_name} in the pool`}
      className="ml-auto grid max-w-sm gap-2 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setMessage(null);
          const result = await savePersonAction(person.user_id, values);
          if (result.ok) setOpen(false);
          else setMessage(result.message);
        });
      }}
    >
      <label htmlFor={ids.pool} className="field-label">
        Random pool
      </label>
      <select
        id={ids.pool}
        value={values.pool}
        onChange={(e) => setValues((v) => ({ ...v, pool: e.target.value as PoolPerson["pool"] }))}
        className="ff-input w-full px-3 py-2 text-sm"
      >
        <option value="auto">By their role</option>
        <option value="in">Add to the pool</option>
        <option value="out">Leave out of the pool</option>
      </select>
      {values.pool === "out" ? (
        <>
          <label htmlFor={ids.note} className="field-label">
            Why<span className="text-status-red"> *</span>
          </label>
          <input
            id={ids.note}
            value={values.pool_note}
            onChange={(e) => setValues((v) => ({ ...v, pool_note: e.target.value }))}
            maxLength={1000}
            placeholder="On leave until March"
            className="ff-input w-full px-3 py-2 text-sm"
          />
        </>
      ) : null}
      <label htmlFor={ids.category} className="field-label">
        FAA category
      </label>
      <select
        id={ids.category}
        value={values.category}
        onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
        className="ff-input w-full px-3 py-2 text-sm"
      >
        <option value="">From their role</option>
        {FAA_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      {message ? (
        <p role="alert" className="field-error">
          {message}
        </p>
      ) : null}
      <span className="flex justify-end gap-2">
        <button type="button" className={buttonOutline} onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </span>
    </form>
  );
}
