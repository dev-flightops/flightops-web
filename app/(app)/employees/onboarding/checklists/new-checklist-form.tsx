"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { ROLES, formatRole } from "@/lib/roles";

import { createChecklistAction, duplicateChecklistAction } from "../actions";

/** A new checklist (#180), legacy's "Create Checklist": its name, the role
 *  it's meant for and a line about it. Its tasks are added next. */
export function NewChecklistForm() {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", target_role: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (name: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [name]: e.target.value }));

  return (
    <form
      method="post"
      aria-label="Create a checklist"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const result = await createChecklistAction(values);
          if (result.ok && result.id) router.push(`/employees/onboarding/checklists/${result.id}`);
          else if (!result.ok) setError(result.message);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="checklist-name" className="field-label">
            Name<span className="text-status-red"> *</span>
          </label>
          <input
            id="checklist-name"
            value={values.name}
            onChange={set("name")}
            maxLength={200}
            placeholder="New Hire Pilot"
            className="ff-input w-full px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="checklist-role" className="field-label">
            For
          </label>
          <select id="checklist-role" value={values.target_role} onChange={set("target_role")} className="ff-input w-full px-3 py-2 text-sm">
            <option value="">Any role</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {formatRole(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="checklist-description" className="field-label">
            Description
          </label>
          <input
            id="checklist-description"
            value={values.description}
            onChange={set("description")}
            maxLength={4000}
            className="ff-input w-full px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Creating…" : "Create & Add Tasks"}
        </button>
      </div>
    </form>
  );
}

/** Legacy's Duplicate: a copy with every task, opened to be edited. */
export function DuplicateButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        className={buttonOutline}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await duplicateChecklistAction(id);
            if (result.ok && result.id) router.push(`/employees/onboarding/checklists/${result.id}`);
            else if (!result.ok) setError(result.message);
          })
        }
      >
        Duplicate<span className="sr-only"> {name}</span>
      </button>
      {error ? (
        <span role="alert" className="field-error ml-2">
          {error}
        </span>
      ) : null}
    </>
  );
}
