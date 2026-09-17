import type {
  ChecklistItem,
  ChecklistResponse,
} from "@/lib/api/employee-documents";
import {
  DOCUMENT_STATE_LABELS,
  DOCUMENT_STATE_TOKENS,
  NEEDS_ACTION,
  type DocumentState,
} from "@/lib/employee-documents/states";

import { UploadDocumentDrawer } from "./upload-document-drawer";

/**
 * The Documents tab on an employee record.
 *
 * Legacy's `/training/employee/{id}/docs`: the documents the operator
 * requires of this person, and which are on file, missing or expiring.
 *
 * Presentational, so it renders under vitest — the upload drawer is the
 * only client piece, and it takes a directly-callable server action.
 *
 * WHY THE DATE IS ON SCREEN
 *
 * "Expiring" only means anything relative to a day. The service reports
 * the date it computed against, and this shows it, so a reader looking
 * at a stale tab is not guessing which "today" a yellow badge refers
 * to.
 *
 * WHY `undated` IS ITS OWN BADGE AND NOT A MISSING DATE
 *
 * A certificate on file with no expiry recorded, where the requirement
 * wants one, reads as current forever. Showing it as "on file" with an
 * empty date column would be the same mistake in the UI that the
 * service refuses to make in the data.
 */


export function DocumentsPanel({
  employeeId,
  checklist,
  canUpload,
  loadError,
}: {
  employeeId: string;
  checklist: ChecklistResponse | null;
  /** Exec admin. Reading your own file does not let you file your own
   *  medical. */
  canUpload: boolean;
  loadError: string | null;
}) {
  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-status-yellow/40 bg-status-yellow/10 px-4 py-3 text-sm text-status-yellow"
      >
        {loadError}
      </div>
    );
  }
  if (!checklist) return null;

  const { items, outstanding, as_of: asOf } = checklist;

  return (
    <section aria-labelledby="documents-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="documents-heading" className="text-sm font-bold">
            Required documents
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {items.length === 0
              ? "No document requirements apply to this employee."
              : outstanding === 0
                ? `All ${items.length} on file.`
                : `${outstanding} of ${items.length} needing attention.`}
            <span className="text-muted-foreground/70">
              {" "}
              · as of {asOf}
            </span>
          </p>
        </div>
        {canUpload && items.length > 0 && (
          <UploadDocumentDrawer
            employeeId={employeeId}
            requirements={items.map((i) => i.requirement)}
          />
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {/* Not "no documents" — the distinction matters. Nothing is
              required of this person, which is a statement about the
              requirements list, not about their file. */}
          Nothing is required of this employee&rsquo;s role yet. Requirements
          are set for the whole company, not per person.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {items.map((item) => (
            <ChecklistRow
              key={item.requirement.id}
              item={item}
              canUpload={canUpload}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ChecklistRow({
  item,
  canUpload,
}: {
  item: ChecklistItem;
  canUpload: boolean;
}) {
  const { requirement, state, days_to_expiry: days, current, superseded } = item;
  const token =
    DOCUMENT_STATE_TOKENS[state as DocumentState] ??
    "border-border bg-muted/20 text-muted-foreground";
  const label =
    DOCUMENT_STATE_LABELS[state as DocumentState] ?? state;
  const needsAction = NEEDS_ACTION.has(state as DocumentState);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {requirement.name}
            </span>
            <span
              className={
                "rounded border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider " +
                token
              }
            >
              {label}
            </span>
            {requirement.required_on_hire && (
              <span
                className="rounded border border-border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground"
                title="The operator marks this as required before a new hire starts"
              >
                On hire
              </span>
            )}
          </div>
          {requirement.description && (
            <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
              {requirement.description}
            </p>
          )}
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
            <ExpiryLine
              state={state}
              days={days}
              expiresOn={current?.expires_on ?? null}
              reminderDays={requirement.reminder_days}
            />
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3 text-[0.7rem]">
          {current ? (
            <a
              href={`/api/employee-documents/${current.id}/download`}
              className="font-semibold text-status-blue hover:underline"
            >
              {current.original_filename}
            </a>
          ) : (
            <span className="text-muted-foreground">No file</span>
          )}
          {canUpload && (
            <span className="text-muted-foreground/60">
              {current ? "Replace via Upload" : "Upload to file"}
            </span>
          )}
        </div>
      </div>

      {superseded.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {superseded.length} earlier upload
            {superseded.length === 1 ? "" : "s"}
          </summary>
          {/* The renewal history. Uploads are additive on the service,
              so these are the record of what was on file before, not
              duplicates to chase. */}
          <ul className="mt-1 space-y-0.5">
            {superseded.map((d) => (
              <li key={d.id} className="text-[0.7rem] text-muted-foreground">
                <a
                  href={`/api/employee-documents/${d.id}/download`}
                  className="text-status-blue hover:underline"
                >
                  {d.original_filename}
                </a>
                {d.expires_on && <> · expired {d.expires_on}</>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {needsAction && state === "undated" && (
        <p className="mt-1.5 text-[0.7rem] text-status-orange">
          {/* Named explicitly, because this row LOOKS satisfied — there
              is a file against it. */}
          A file is on record but no expiry date was captured, so it
          cannot be checked. Re-upload it with the expiry to fix this.
        </p>
      )}
    </li>
  );
}

function ExpiryLine({
  state,
  days,
  expiresOn,
  reminderDays,
}: {
  state: string;
  days: number | null;
  expiresOn: string | null;
  reminderDays: number;
}) {
  if (state === "missing") {
    return <>Nothing on file.</>;
  }
  if (state === "undated") {
    return <>On file, no expiry recorded.</>;
  }
  if (expiresOn === null) {
    return <>On file. This document does not expire.</>;
  }
  if (days === null) {
    return <>Expires {expiresOn}.</>;
  }
  if (days < 0) {
    const ago = Math.abs(days);
    return (
      <>
        Expired {expiresOn} — {ago} day{ago === 1 ? "" : "s"} ago.
      </>
    );
  }
  if (days === 0) {
    return <>Expires today, {expiresOn}.</>;
  }
  return (
    <>
      Expires {expiresOn} — {days} day{days === 1 ? "" : "s"} away
      {state === "expiring" && <> (inside the {reminderDays}-day warning)</>}.
    </>
  );
}
