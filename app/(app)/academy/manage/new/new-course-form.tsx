"use client";

import { useActionState } from "react";

import {
  COURSE_CATEGORIES,
  COURSE_CATEGORY_LABELS,
} from "@/lib/api/academy";

import {
  createCourseAction,
  type NewCourseFormState,
} from "./actions";

const _initial: NewCourseFormState = { status: "idle" };

export function NewCourseForm() {
  const [state, formAction, pending] = useActionState(
    createCourseAction,
    _initial,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}

      <Field label="Title" name="title" error={state.fieldErrors?.title}>
        <input
          id="title"
          name="title"
          required
          maxLength={200}
          className="ff"
          placeholder="e.g. Annual Part 135 Refresher"
        />
      </Field>

      <Field
        label="Description"
        name="description"
        error={state.fieldErrors?.description}
      >
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={10_000}
          className="ff"
          placeholder="What does this course cover?"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Category"
          name="category"
          error={state.fieldErrors?.category}
        >
          <select
            id="category"
            name="category"
            required
            className="ff"
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {COURSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {COURSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Cert valid (days)"
          name="cert_valid_days"
          hint="0 = never expires. 365 for annual recurrent."
          error={state.fieldErrors?.cert_valid_days}
        >
          <input
            id="cert_valid_days"
            name="cert_valid_days"
            type="number"
            min={0}
            max={3650}
            required
            defaultValue={365}
            className="ff"
          />
        </Field>
      </div>

      <label className="flex items-start gap-2 rounded-md border border-border bg-card/40 px-3 py-2.5">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked
          className="mt-0.5"
        />
        <span className="text-xs text-foreground/80">
          <span className="font-semibold">Active</span> — appears in the
          public catalog. Turn off to hide from learners while you draft.
        </span>
      </label>

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create Course"}
        </button>
      </div>

      <style>{`
        .ff {
          width: 100%;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          outline: none;
        }
        .ff:focus:not(:disabled) {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
        textarea.ff { resize: vertical; font-family: inherit; }
      `}</style>
    </form>
  );
}

function Field({
  label,
  name,
  hint,
  error,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={name}
        className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-[0.6875rem] text-muted-foreground/80">{hint}</p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[0.6875rem] text-status-red">{error}</p>
      ) : null}
    </div>
  );
}
