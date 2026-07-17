"use client";

import { useActionState } from "react";

import { type OpenCapaFormState, openCapaAction } from "./actions";

const _initial: OpenCapaFormState = { status: "idle" };

interface OwnerOption {
  id: string;
  full_name: string;
  email: string;
}

function _defaultDueDate(): string {
  // Two weeks out — a reasonable default for follow-through work.
  const d = new Date();
  d.setDate(d.getDate() + 14);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function OpenCapaForm({
  sourceType,
  sourceId,
  users,
}: {
  sourceType: "hazard" | "incident";
  sourceId: string;
  users: OwnerOption[];
}) {
  const [state, formAction, pending] = useActionState(
    openCapaAction,
    _initial,
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}

      <input type="hidden" name="source_type" value={sourceType} />
      <input type="hidden" name="source_id" value={sourceId} />

      <Field label="Title" name="title" error={state.fieldErrors?.title}>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder="e.g. Install ramp bollards at A-row"
          className="ff-input"
        />
      </Field>

      <Field
        label="Description"
        name="description"
        error={state.fieldErrors?.description}
        hint="What needs to happen? Reference vendor + spec if relevant."
      >
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          minLength={10}
          maxLength={4000}
          className="ff-input"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Owner"
          name="owner_user_id"
          error={state.fieldErrors?.owner_user_id}
          hint="Who will do this work?"
        >
          <select
            id="owner_user_id"
            name="owner_user_id"
            required
            className="ff-input"
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.email})
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Due date"
          name="due_date"
          error={state.fieldErrors?.due_date}
        >
          <input
            id="due_date"
            name="due_date"
            type="date"
            required
            defaultValue={_defaultDueDate()}
            className="ff-input"
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Opening…" : "Open CAPA"}
        </button>
      </div>

      <style>{`
        .ff-input {
          width: 100%;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .ff-input:focus:not(:disabled) {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
        textarea.ff-input { resize: vertical; font-family: inherit; }
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
