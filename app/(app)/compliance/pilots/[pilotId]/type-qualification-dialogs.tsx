"use client";

import { useId, useState, useTransition, type FormEvent } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type {
  TypeCheck,
  TypePosition,
  TypeQualificationCell,
} from "@/lib/api/type-qualifications";

import {
  CHECK_LABELS,
  POSITION_LABELS,
  TYPE_POSITIONS,
  typeLabel,
} from "../../type-qualifications/display";
import {
  authorisePositionAction,
  recordCheckRideAction,
  revokePositionAction,
  type ActionResult,
} from "./type-qualification-actions";

const LABEL =
  "mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground";
const FIELD =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
const CANCEL =
  "rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-60";
const SUBMIT =
  "inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-60";

/** The currency item a type's check is logged against. */
export interface CheckItemRef {
  id: string;
  requiresExaminer: boolean;
}

/** What a dialog opens on, pre-filled from the cell it was opened from. */
export type TypeDialog =
  | { kind: "authorise"; airframeType: string; position: TypePosition }
  | { kind: "revoke"; cell: TypeQualificationCell }
  | { kind: "check"; airframeType: string; check: TypeCheck };

export function TypeQualificationDialogs({
  dialog,
  onClose,
  pilotId,
  pilotName,
  airframeTypes,
  checkItems,
}: {
  dialog: TypeDialog | null;
  onClose: () => void;
  pilotId: string;
  pilotName: string;
  airframeTypes: string[];
  checkItems: Record<TypeCheck, CheckItemRef | null>;
}) {
  return (
    <Dialog open={dialog !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        {dialog?.kind === "authorise" && (
          <AuthoriseForm
            initial={dialog}
            pilotId={pilotId}
            pilotName={pilotName}
            airframeTypes={airframeTypes}
            onClose={onClose}
          />
        )}
        {dialog?.kind === "revoke" && (
          <RevokeForm
            cell={dialog.cell}
            pilotId={pilotId}
            pilotName={pilotName}
            onClose={onClose}
          />
        )}
        {dialog?.kind === "check" && (
          <CheckRideForm
            initial={dialog}
            pilotId={pilotId}
            pilotName={pilotName}
            airframeTypes={airframeTypes}
            checkItems={checkItems}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Submit through a server action; close on success, show the error if not. */
function useSubmit(onClose: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(run: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const outcome = await run();
      if (outcome.ok) onClose();
      else setError(outcome.error);
    });
  }
  return { error, pending, submit };
}

function AuthoriseForm({
  initial,
  pilotId,
  pilotName,
  airframeTypes,
  onClose,
}: {
  initial: { airframeType: string; position: TypePosition };
  pilotId: string;
  pilotName: string;
  airframeTypes: string[];
  onClose: () => void;
}) {
  const uid = useId();
  const { error, pending, submit } = useSubmit(onClose);
  const today = todayIso();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit(() =>
      authorisePositionAction(pilotId, {
        airframe_type: text(form, "airframe_type"),
        position: text(form, "position") as TypePosition,
        authorised_on: text(form, "authorised_on"),
        notes: text(form, "notes"),
      }),
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Authorise a position</DialogTitle>
        <DialogDescription>
          {pilotName}. The position is current while the check rides on the
          type are in date.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <ErrorLine error={error} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${uid}-type`} className={LABEL}>
              Aircraft type
            </label>
            <select
              id={`${uid}-type`}
              name="airframe_type"
              defaultValue={initial.airframeType}
              className={FIELD}
            >
              {!initial.airframeType && <option value="">Pick a type…</option>}
              {airframeTypes.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-position`} className={LABEL}>
              Position
            </label>
            <select
              id={`${uid}-position`}
              name="position"
              defaultValue={initial.position}
              className={FIELD}
            >
              {TYPE_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {POSITION_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor={`${uid}-on`} className={LABEL}>
            Date authorised
          </label>
          <input
            id={`${uid}-on`}
            name="authorised_on"
            type="date"
            defaultValue={today}
            max={today}
            className={FIELD}
          />
        </div>
        <Notes uid={uid} label="Notes" />
        <DialogFooter className="gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={pending} className={CANCEL}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={SUBMIT}>
            {pending && <Spinner size="xs" />}
            Authorise
          </button>
        </DialogFooter>
      </form>
    </>
  );
}

function RevokeForm({
  cell,
  pilotId,
  pilotName,
  onClose,
}: {
  cell: TypeQualificationCell;
  pilotId: string;
  pilotName: string;
  onClose: () => void;
}) {
  const uid = useId();
  const { error, pending, submit } = useSubmit(onClose);
  const today = todayIso();
  const qualificationId = cell.qualification_id;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!qualificationId) return;
    const form = new FormData(event.currentTarget);
    submit(() =>
      revokePositionAction(pilotId, qualificationId, {
        revoked_on: text(form, "revoked_on"),
        notes: text(form, "notes"),
      }),
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Revoke a position</DialogTitle>
        <DialogDescription>
          {pilotName} — {POSITION_LABELS[cell.position]} on{" "}
          {typeLabel(cell.airframe_type)}, authorised {cell.authorised_on}. The
          record stays in the history.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <ErrorLine error={error} />
        <div>
          <label htmlFor={`${uid}-on`} className={LABEL}>
            Date revoked
          </label>
          <input
            id={`${uid}-on`}
            name="revoked_on"
            type="date"
            defaultValue={today}
            min={cell.authorised_on ?? undefined}
            max={today}
            className={FIELD}
          />
        </div>
        <Notes uid={uid} label="Reason" />
        <DialogFooter className="gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={pending} className={CANCEL}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md border border-status-red/50 bg-status-red/10 px-3 py-2 text-sm font-semibold text-status-red disabled:opacity-60"
          >
            {pending && <Spinner size="xs" />}
            Revoke
          </button>
        </DialogFooter>
      </form>
    </>
  );
}

function CheckRideForm({
  initial,
  pilotId,
  pilotName,
  airframeTypes,
  checkItems,
  onClose,
}: {
  initial: { airframeType: string; check: TypeCheck };
  pilotId: string;
  pilotName: string;
  airframeTypes: string[];
  checkItems: Record<TypeCheck, CheckItemRef | null>;
  onClose: () => void;
}) {
  const uid = useId();
  const { error, pending, submit } = useSubmit(onClose);
  const [check, setCheck] = useState<TypeCheck>(initial.check);
  const item = checkItems[check];
  const today = todayIso();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit(() =>
      recordCheckRideAction(pilotId, {
        currency_item_id: item?.id ?? "",
        airframe_type: text(form, "airframe_type"),
        completion_date: text(form, "completion_date"),
        result: text(form, "result") as "pass" | "fail",
        completed_by: text(form, "completed_by"),
        examiner_cert_number: text(form, "examiner_cert_number"),
        notes: text(form, "notes"),
      }),
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record a check ride</DialogTitle>
        <DialogDescription>
          {pilotName}. It also counts on the currency board; a fail is kept on
          record and renews nothing.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <ErrorLine
          error={
            error ??
            (item
              ? null
              : `The company has no active ${CHECK_LABELS[check]} item to log this against.`)
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${uid}-type`} className={LABEL}>
              Aircraft type
            </label>
            <select
              id={`${uid}-type`}
              name="airframe_type"
              defaultValue={initial.airframeType}
              className={FIELD}
            >
              {!initial.airframeType && <option value="">Pick a type…</option>}
              {airframeTypes.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-check`} className={LABEL}>
              Check
            </label>
            <select
              id={`${uid}-check`}
              value={check}
              onChange={(e) => setCheck(e.target.value as TypeCheck)}
              className={FIELD}
            >
              <option value="competency">Competency (135.293)</option>
              <option value="instrument">Instrument (135.297)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${uid}-date`} className={LABEL}>
              Date
            </label>
            <input
              id={`${uid}-date`}
              name="completion_date"
              type="date"
              defaultValue={today}
              max={today}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-result`} className={LABEL}>
              Result
            </label>
            <select id={`${uid}-result`} name="result" defaultValue="" className={FIELD}>
              <option value="">Select…</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor={`${uid}-by`} className={LABEL}>
            Examiner
          </label>
          <input
            id={`${uid}-by`}
            name="completed_by"
            type="text"
            maxLength={200}
            placeholder="Check airman or examiner"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-cert`} className={LABEL}>
            Examiner certificate #{item && !item.requiresExaminer ? " (optional)" : ""}
          </label>
          <input
            id={`${uid}-cert`}
            name="examiner_cert_number"
            type="text"
            maxLength={64}
            className={FIELD}
          />
        </div>
        <Notes uid={uid} label="Notes" />
        <DialogFooter className="gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={pending} className={CANCEL}>
            Cancel
          </button>
          <button type="submit" disabled={pending || !item} className={SUBMIT}>
            {pending && <Spinner size="xs" />}
            Record
          </button>
        </DialogFooter>
      </form>
    </>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
    >
      {error}
    </p>
  );
}

function Notes({ uid, label }: { uid: string; label: string }) {
  return (
    <div>
      <label htmlFor={`${uid}-notes`} className={LABEL}>
        {label}
      </label>
      <textarea
        id={`${uid}-notes`}
        name="notes"
        rows={2}
        maxLength={2000}
        className={FIELD}
      />
    </div>
  );
}

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
