"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  addDueItemAction,
  retireDueItemAction,
  signOffDueItemAction,
} from "@/app/(app)/maintenance/due-list/actions";
import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DUE_ITEM_KINDS, type DueItem, type DueItemKind } from "@/lib/api/maintenance";

/**
 * Adding to the due list, signing an item off, retiring it (#156). The
 * maintenance sign-off's own (AIRWORTHINESS_WRITERS): the pages only
 * offer these to them, and the service refuses anyone else.
 */

function num(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function text(value: FormDataEntryValue | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
}

/** The company's date in Alaska, as the service judges "today". */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Anchorage" }).format(new Date());
}

export function AddDueItemDialog({
  aircraft,
}: {
  /** One aircraft (its page), or the fleet to pick from (the due list). */
  aircraft: { id: string; tail_number: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const aircraftId = String(form.get("aircraft_id") ?? aircraft[0]?.id ?? "");
    setError(null);
    start(async () => {
      const result = await addDueItemAction(aircraftId, {
        kind: String(form.get("kind")) as DueItemKind,
        title: String(form.get("title") ?? "").trim(),
        reference: text(form.get("reference")),
        interval_hours: num(form.get("interval_hours")),
        interval_days: num(form.get("interval_days")),
        due_hours: num(form.get("due_hours")),
        due_on: text(form.get("due_on")),
        last_done_on: text(form.get("last_done_on")),
        last_done_hours: num(form.get("last_done_hours")),
        grounds_when_overdue: form.get("grounds_when_overdue") === "on",
        notes: text(form.get("notes")),
      });
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <button type="button" className={buttonOutline} onClick={() => setOpen(true)}>
        Add to due list
      </button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add to the due list</DialogTitle>
            <DialogDescription>
              Due by aircraft hours, by date, or both: whichever comes first. With an
              interval, signing it off sets the next due.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            {aircraft.length > 1 ? (
              <label className="sm:col-span-2">
                <span className="field-label">Aircraft</span>
                <select name="aircraft_id" required className="ff-input">
                  {aircraft.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tail_number}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span className="field-label">Kind</span>
              <select name="kind" defaultValue="inspection" className="ff-input">
                {DUE_ITEM_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Reference</span>
              <input name="reference" className="ff-input" placeholder="AD 2026-14-07" maxLength={100} />
            </label>
            <label className="sm:col-span-2">
              <span className="field-label">Item</span>
              <input name="title" required maxLength={200} className="ff-input" placeholder="100-hour inspection" />
            </label>
            <label>
              <span className="field-label">Every (aircraft hours)</span>
              <input name="interval_hours" type="number" min="0.1" step="0.1" className="ff-input" />
            </label>
            <label>
              <span className="field-label">Every (days)</span>
              <input name="interval_days" type="number" min="1" step="1" className="ff-input" placeholder="365" />
            </label>
            <label>
              <span className="field-label">Last done (date)</span>
              <input name="last_done_on" type="date" max={today()} className="ff-input" />
            </label>
            <label>
              <span className="field-label">Last done (aircraft hours)</span>
              <input name="last_done_hours" type="number" min="0" step="0.1" className="ff-input" />
            </label>
            <label>
              <span className="field-label">Next due (aircraft hours)</span>
              <input name="due_hours" type="number" min="0" step="0.1" className="ff-input" />
            </label>
            <label>
              <span className="field-label">Next due (date)</span>
              <input name="due_on" type="date" className="ff-input" />
            </label>
            <p className="text-[0.7rem] text-muted-foreground sm:col-span-2">
              Leave the next due empty to count it from when it was last done.
            </p>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input name="grounds_when_overdue" type="checkbox" defaultChecked />
              Overdue, it grounds the aircraft
            </label>
            <label className="sm:col-span-2">
              <span className="field-label">Notes</span>
              <textarea name="notes" rows={2} maxLength={2000} className="ff-input" />
            </label>
            {error ? (
              <Notice tone="red" className="sm:col-span-2">
                {error}
              </Notice>
            ) : null}
            <DialogFooter className="sm:col-span-2">
              <button type="button" className={buttonOutline} onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
              <button type="submit" className={buttonSolid} disabled={pending}>
                {pending ? "Adding…" : "Add"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SignOffDueItemDialog({ item }: { item: DueItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    start(async () => {
      const result = await signOffDueItemAction(item.aircraft_id, item.id, {
        done_on: String(form.get("done_on")),
        done_hours: num(form.get("done_hours")),
        done_by_name: String(form.get("done_by_name") ?? "").trim(),
        certificate_number: text(form.get("certificate_number")),
        notes: text(form.get("notes")),
      });
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <button type="button" className={linkCaps} onClick={() => setOpen(true)}>
        Sign off
      </button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Sign off · {item.tail_number} {item.title}
            </DialogTitle>
            <DialogDescription>
              {item.interval_hours || item.interval_days
                ? "The next due is counted on from when it was done."
                : "A one-off: once signed off it leaves the list."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="field-label">Done on</span>
              <input name="done_on" type="date" required defaultValue={today()} max={today()} className="ff-input" />
            </label>
            <label>
              <span className="field-label">At aircraft hours</span>
              <input
                name="done_hours"
                type="number"
                min="0"
                step="0.1"
                defaultValue={item.aircraft_total_hours}
                className="ff-input"
              />
            </label>
            <label>
              <span className="field-label">Done by</span>
              <input name="done_by_name" required maxLength={200} className="ff-input" />
            </label>
            <label>
              <span className="field-label">Certificate number</span>
              <input name="certificate_number" maxLength={64} className="ff-input" />
            </label>
            <label className="sm:col-span-2">
              <span className="field-label">Notes</span>
              <textarea name="notes" rows={2} maxLength={2000} className="ff-input" />
            </label>
            {error ? (
              <Notice tone="red" className="sm:col-span-2">
                {error}
              </Notice>
            ) : null}
            <DialogFooter className="sm:col-span-2">
              <button type="button" className={buttonOutline} onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
              <button type="submit" className={buttonSolid} disabled={pending}>
                {pending ? "Signing off…" : "Sign off"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Takes an item off the list, asking first in the row itself. */
export function RetireDueItemButton({ item }: { item: DueItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!asking) {
    return (
      <button type="button" className={`${linkCaps} ml-3 text-muted-foreground`} onClick={() => setAsking(true)}>
        Retire
      </button>
    );
  }
  return (
    <span className="ml-3 inline-flex items-center gap-2 text-[0.7rem]">
      <span>Take it off the list? Its records stay.</span>
      <button
        type="button"
        className={linkCaps}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await retireDueItemAction(item.aircraft_id, item.id);
            if (result.ok) {
              setAsking(false);
              router.refresh();
            } else {
              setError(result.error);
            }
          })
        }
      >
        {pending ? "Retiring…" : "Retire"}
      </button>
      <button type="button" className={`${linkCaps} text-muted-foreground`} onClick={() => setAsking(false)}>
        Keep
      </button>
      {error ? <span className="text-status-red">{error}</span> : null}
    </span>
  );
}
