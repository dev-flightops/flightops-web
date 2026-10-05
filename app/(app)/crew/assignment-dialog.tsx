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
import {
  DUTY_TYPE_LABELS,
  DUTY_TYPES,
  DUTY_TYPES_NEEDING_AIRFRAME,
  type CrewCalendarAircraft,
  type CrewCalendarMember,
  type CrewCalendarStation,
  type DutyType,
  type RosterEntry,
} from "@/lib/api/crew-calendar";

import { deleteAssignmentAction, saveAssignmentAction } from "./actions";

const LABEL =
  "mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground";
const FIELD =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";

/** What the dialog opens on: a fresh assignment (from a day cell or the
 *  Add button) or an existing one. */
export type AssignmentTarget =
  | { kind: "new"; userId?: string; day?: string }
  | { kind: "edit"; entry: RosterEntry };

export interface AssignmentDialogProps {
  target: AssignmentTarget | null;
  onClose: () => void;
  crew: CrewCalendarMember[];
  stations: CrewCalendarStation[];
  airframeTypes: string[];
  aircraft: CrewCalendarAircraft[];
  /** The day the form defaults to when opened from the Add button. */
  defaultDay: string;
}

export function AssignmentDialog(props: AssignmentDialogProps) {
  const { target, onClose } = props;
  return (
    <Dialog open={target !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        {target && (
          // Keyed so each opening starts from its own defaults.
          <AssignmentForm
            key={target.kind === "edit" ? target.entry.id : `${target.userId}-${target.day}`}
            {...props}
            target={target}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssignmentForm({
  target,
  onClose,
  crew,
  stations,
  airframeTypes,
  aircraft,
  defaultDay,
}: AssignmentDialogProps & { target: AssignmentTarget }) {
  const uid = useId();
  const editing = target.kind === "edit" ? target.entry : null;
  const startUser = editing?.user_id ?? (target.kind === "new" ? target.userId : undefined) ?? "";
  const startDay = (target.kind === "new" ? target.day : undefined) ?? defaultDay;

  const [userId, setUserId] = useState(startUser);
  const [station, setStation] = useState(
    editing?.station ?? crew.find((c) => c.user_id === startUser)?.station ?? "",
  );
  const [dutyType, setDutyType] = useState<DutyType>(editing?.duty_type ?? "flying");
  const [airframeType, setAirframeType] = useState(editing?.airframe_type ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [pending, startTransition] = useTransition();

  const tails = aircraft.filter((a) => a.airframe_type === airframeType);
  const needsType = DUTY_TYPES_NEEDING_AIRFRAME.has(dutyType);

  function onPilotChange(next: string) {
    setUserId(next);
    // A new assignment starts at the pilot's home base; an edit keeps its base.
    if (!editing) {
      const home = crew.find((c) => c.user_id === next)?.station;
      if (home) setStation(home);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const outcome = await saveAssignmentAction(formData);
      if (outcome.ok) onClose();
      else setError(outcome.error);
    });
  }

  function onRemove() {
    if (!editing) return;
    startTransition(async () => {
      const outcome = await deleteAssignmentAction(editing.id);
      if (outcome.ok) onClose();
      else {
        setConfirmingRemove(false);
        setError(outcome.error);
      }
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit Assignment" : "Add Assignment"}</DialogTitle>
        <DialogDescription>
          A pilot at a base, on an aircraft type, for a run of days. A pilot can
          hold one assignment on any day.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        {editing && <input type="hidden" name="entry_id" value={editing.id} />}
        {error && (
          <p
            role="alert"
            className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
          >
            {error}
          </p>
        )}

        <div>
          <label htmlFor={`${uid}-pilot`} className={LABEL}>
            Pilot <span className="text-status-red">*</span>
          </label>
          <select
            id={`${uid}-pilot`}
            name="user_id"
            required
            value={userId}
            onChange={(e) => onPilotChange(e.target.value)}
            className={FIELD}
          >
            {!userId && <option value="">Pick a pilot…</option>}
            {crew.map((c) => (
              <option key={c.user_id} value={c.user_id}>
                {c.station ? `${c.full_name} (${c.station})` : c.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${uid}-duty`} className={LABEL}>
              Duty <span className="text-status-red">*</span>
            </label>
            <select
              id={`${uid}-duty`}
              name="duty_type"
              value={dutyType}
              onChange={(e) => setDutyType(e.target.value as DutyType)}
              className={FIELD}
            >
              {DUTY_TYPES.map((d) => (
                <option key={d} value={d}>
                  {DUTY_TYPE_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-base`} className={LABEL}>
              Base <span className="text-status-red">*</span>
            </label>
            <select
              id={`${uid}-base`}
              name="station"
              required
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className={FIELD}
            >
              {!station && <option value="">Pick a base…</option>}
              {stations.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name ? `${s.code} — ${s.name}` : s.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${uid}-type`} className={LABEL}>
              Aircraft type {needsType && <span className="text-status-red">*</span>}
            </label>
            <select
              id={`${uid}-type`}
              name="airframe_type"
              value={airframeType}
              onChange={(e) => setAirframeType(e.target.value)}
              className={FIELD}
            >
              <option value="">{needsType ? "Pick a type…" : "— None —"}</option>
              {airframeTypes.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-tail`} className={LABEL}>
              Tail
            </label>
            <select
              id={`${uid}-tail`}
              name="aircraft_id"
              defaultValue={editing?.aircraft_id ?? ""}
              disabled={!airframeType}
              className={FIELD}
            >
              <option value="">Any</option>
              {tails.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tail_number}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${uid}-start`} className={LABEL}>
              From <span className="text-status-red">*</span>
            </label>
            <input
              id={`${uid}-start`}
              type="date"
              name="start_date"
              required
              defaultValue={editing?.start_date ?? startDay}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-end`} className={LABEL}>
              To <span className="text-status-red">*</span>
            </label>
            <input
              id={`${uid}-end`}
              type="date"
              name="end_date"
              required
              defaultValue={editing?.end_date ?? startDay}
              className={FIELD}
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${uid}-notes`} className={LABEL}>
            Notes
          </label>
          <textarea
            id={`${uid}-notes`}
            name="notes"
            rows={2}
            maxLength={2000}
            defaultValue={editing?.notes ?? ""}
            className={FIELD}
          />
        </div>

        <DialogFooter className="gap-2 pt-2 sm:justify-between">
          <div>
            {editing &&
              (confirmingRemove ? (
                <span className="flex items-center gap-2 text-xs text-foreground">
                  Remove this assignment?
                  <button
                    type="button"
                    onClick={onRemove}
                    disabled={pending}
                    className="rounded-md border border-status-red/50 bg-status-red/10 px-2 py-1 font-semibold text-status-red disabled:opacity-60"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(false)}
                    disabled={pending}
                    className="rounded-md border border-border px-2 py-1 font-semibold"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  disabled={pending}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-status-red hover:bg-accent disabled:opacity-60"
                >
                  Remove
                </button>
              ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-60"
            >
              {pending && <Spinner size="xs" />}
              Save Assignment
            </button>
          </div>
        </DialogFooter>
      </form>
    </>
  );
}
