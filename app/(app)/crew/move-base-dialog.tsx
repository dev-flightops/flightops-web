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
  CrewCalendarMember,
  CrewCalendarStation,
} from "@/lib/api/crew-calendar";

import { moveHomeBaseAction } from "./actions";

/**
 * Legacy's "Move to Base": the home base the calendar groups a pilot
 * under. The same field as the employee record's station.
 */
export function MoveBaseDialog({
  member,
  onClose,
  stations,
}: {
  member: CrewCalendarMember | null;
  onClose: () => void;
  stations: CrewCalendarStation[];
}) {
  return (
    <Dialog open={member !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        {member && (
          <MoveBaseForm key={member.user_id} member={member} onClose={onClose} stations={stations} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveBaseForm({
  member,
  onClose,
  stations,
}: {
  member: CrewCalendarMember;
  onClose: () => void;
  stations: CrewCalendarStation[];
}) {
  const uid = useId();
  const [station, setStation] = useState(member.station ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const outcome = await moveHomeBaseAction(member.user_id, station);
      if (outcome.ok) onClose();
      else setError(outcome.error);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Move to Base</DialogTitle>
        <DialogDescription>
          {member.full_name}&rsquo;s home base. Assignments stay where they are.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
          >
            {error}
          </p>
        )}
        <div>
          <label
            htmlFor={`${uid}-base`}
            className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
          >
            Home base
          </label>
          <select
            id={`${uid}-base`}
            value={station}
            onChange={(e) => setStation(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            {!station && <option value="">Pick a base…</option>}
            {stations.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name ? `${s.code} — ${s.name}` : s.code}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter className="gap-2 pt-2">
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
            disabled={pending || !station || station === member.station}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-60"
          >
            {pending && <Spinner size="xs" />}
            Move
          </button>
        </DialogFooter>
      </form>
    </>
  );
}
