"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { DocumentRequirementRow } from "@/lib/api/employee-documents";
import type { RoleSummary } from "@/lib/api/types";

import {
  createRequirementAction,
  retireRequirementAction,
  updateRequirementAction,
} from "./actions";

/**
 * The company's document requirements.
 *
 * Every employee's checklist is built from this list, so the two
 * fields that decide what the checklist can say are the ones given
 * the most room: who a requirement applies to, and whether it is
 * checked against an expiry.
 *
 * `required_on_hire` is recorded and shown on the checklist, and is
 * deliberately NOT wired to user activation, though legacy's column
 * comment says new hires cannot be activated without it. Letting a
 * document requirement lock a real person out of the system is an
 * enforcement decision, not a side effect of ticking a box here — so
 * the label says what it does rather than implying a gate.
 */
export function RequirementsTable({
  requirements,
  roles,
}: {
  requirements: DocumentRequirementRow[];
  /** Served by /auth/settings/roles, not taken from `lib/roles.ts` —
   *  that file's own docstring says it is not the source of truth for
   *  anything the user picks, so a role added backend-side appears
   *  here without a web change. */
  roles: RoleSummary[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setAdding(false);
      router.refresh();
    });
  }

  const active = requirements.filter((r) => r.is_active);
  const retired = requirements.filter((r) => !r.is_active);

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {active.length} in use
          {retired.length > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · {retired.length} retired
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAdding((v) => !v);
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
        >
          {adding ? "Cancel" : "+ New requirement"}
        </button>
      </div>

      {adding && (
        <RequirementForm
          pending={pending}
          roles={roles}
          onSubmit={(payload) => run(() => createRequirementAction(payload))}
        />
      )}

      {active.length === 0 && !adding ? (
        <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {/* Said plainly: with no requirements, every employee's
              Documents tab is empty, and that is a configuration state
              rather than a clean bill of health. */}
          No requirements yet, so every employee&rsquo;s Documents tab is
          empty. Add the documents your operation requires and they will
          appear on the people they apply to.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {active.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{r.name}</span>
                    {r.required_on_hire && (
                      <span
                        className="rounded border border-border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground"
                        title="Shown on the checklist. Does not block activating a new hire."
                      >
                        On hire
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                      {r.description}
                    </p>
                  )}
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {r.applies_to_roles.length === 0 ? (
                      <>Applies to everyone.</>
                    ) : (
                      <>
                        Applies to{" "}
                        {r.applies_to_roles
                          .map((id) => labelFor(roles, id))
                          .join(", ")}
                        .
                      </>
                    )}{" "}
                    {r.has_expiry ? (
                      <>Checked against its expiry, warning {r.reminder_days} days ahead.</>
                    ) : (
                      // Explicit, because the alternative reading is
                      // "we forgot to set one".
                      <>Does not expire.</>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => retireRequirementAction(r.id))}
                  className="text-[0.7rem] font-semibold text-status-red hover:underline disabled:opacity-50"
                  title="Stops it appearing on checklists. Documents already filed against it stay readable."
                >
                  Retire
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {retired.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {retired.length} retired
          </summary>
          <ul className="mt-2 space-y-1">
            {retired.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded border border-border px-3 py-1.5 text-[0.7rem] text-muted-foreground"
              >
                <span>{r.name}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => updateRequirementAction(r.id, { is_active: true }))
                  }
                  className="font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  Put back in use
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Falls back to the raw id rather than hiding a role the served list
 *  does not know about — a requirement scoped to something unrecognised
 *  is worth seeing, not smoothing over. */
function labelFor(roles: RoleSummary[], roleId: string): string {
  return roles.find((r) => r.id === roleId)?.label ?? roleId;
}

function RequirementForm({
  pending,
  roles,
  onSubmit,
}: {
  pending: boolean;
  roles: RoleSummary[];
  onSubmit: (payload: {
    name: string;
    description: string | null;
    applies_to_roles: string[];
    required_on_hire: boolean;
    has_expiry: boolean;
    reminder_days: number;
  }) => void;
}) {
  const [hasExpiry, setHasExpiry] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit({
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? "").trim() || null,
          applies_to_roles: fd.getAll("applies_to_roles").map(String),
          required_on_hire: fd.get("required_on_hire") === "on",
          has_expiry: fd.get("has_expiry") === "on",
          reminder_days: Number(fd.get("reminder_days") ?? 30),
        });
      }}
      className="space-y-3 rounded-lg border border-border bg-card px-4 py-3"
    >
      <label className="block">
        <span className={LABEL}>Name *</span>
        <input name="name" required maxLength={200} className={INPUT} />
      </label>
      <label className="block">
        <span className={LABEL}>Description</span>
        <input name="description" className={INPUT} />
      </label>

      <fieldset>
        <legend className={LABEL}>Applies to</legend>
        <p className="mb-1 text-[0.65rem] text-muted-foreground">
          {/* The empty case is a real choice, not an oversight, so it
              is stated rather than left to be inferred. */}
          Tick none to require it of everyone.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground"
            >
              <input
                type="checkbox"
                name="applies_to_roles"
                value={role.id}
                className="h-3.5 w-3.5 rounded border-border"
              />
              {role.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="required_on_hire"
          className="h-3.5 w-3.5 rounded border-border"
        />
        Required on hire
        <span className="text-muted-foreground">
          (shown on the checklist; does not block activating a new hire)
        </span>
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="has_expiry"
          checked={hasExpiry}
          onChange={(e) => setHasExpiry(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border"
        />
        Has an expiry date
      </label>

      {hasExpiry && (
        <label className="block">
          <span className={LABEL}>Warn this many days ahead</span>
          <input
            name="reminder_days"
            type="number"
            min={0}
            max={3650}
            defaultValue={30}
            className={INPUT}
          />
          <span className="mt-1 block text-[0.65rem] text-muted-foreground">
            An upload will be refused without an expiry date once this is
            on.
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Saving…" : "Create requirement"}
      </button>
    </form>
  );
}

const LABEL =
  "mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground";
const INPUT =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none";
