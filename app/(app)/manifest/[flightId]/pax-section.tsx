"use client";

import { useActionState, useEffect, useState } from "react";

import { TICKET_TYPES, TICKET_TYPE_LABELS, type ManifestPaxRow } from "@/lib/api/manifest";

import { savePaxAction, type ManifestFormState } from "./actions";
import { FIELD, Flag, fmtLbs, FormNotice, TH, THEAD, TicketBadge } from "./manifest-bits";
import { RemoveLine } from "./remove-line";

const _initial: ManifestFormState = { status: "idle", attempt: 0 };

/** Seat order, then the unseated by last name. */
function _sorted(rows: ManifestPaxRow[]): ManifestPaxRow[] {
  return [...rows].sort((a, b) => {
    const sa = a.seat_number ?? "";
    const sb = b.seat_number ?? "";
    if (sa && sb) return sa.localeCompare(sb, undefined, { numeric: true });
    if (sa) return -1;
    if (sb) return 1;
    return a.last_name.localeCompare(b.last_name);
  });
}

/**
 * Legacy's "Passengers & Crew" block: the table, "+ Add Passenger"
 * opening the form below it, and Edit and Remove on each row while the
 * manifest is a draft. Its waitlist and per-leg segments are not here:
 * a FlightOps manifest is who flew (#62).
 */
export function PassengersSection({
  flightId,
  rows,
  editable,
}: {
  flightId: string;
  rows: ManifestPaxRow[];
  editable: boolean;
}) {
  // "add", the id of the passenger being edited, or null when closed.
  const [open, setOpen] = useState<string | null>(null);
  const editing = open && open !== "add" ? (rows.find((p) => p.id === open) ?? null) : null;
  const formOpen = editable && (open === "add" || editing !== null);
  const crew = rows.filter((p) => p.is_crew).length;

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Passengers &amp; Crew
        </h2>
        <span className="text-xs text-muted-foreground">
          {rows.length - crew} pax · {crew} crew
        </span>
        {editable ? (
          <button
            type="button"
            onClick={() => setOpen(open === "add" ? null : "add")}
            className="ml-auto rounded-md border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground/80 hover:bg-accent"
          >
            + Add Passenger
          </button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No passengers on this manifest.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Seat</th>
                  <th className={TH}>Last</th>
                  <th className={TH}>First</th>
                  <th className={TH}>Ticket</th>
                  <th className={`${TH} text-right`}>Weight</th>
                  <th className={`${TH} text-right`}>Baggage</th>
                  <th className={TH}>Flags</th>
                  <th className={TH}>Contact</th>
                  {editable ? <th className={`${TH} text-right`}>Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {_sorted(rows).map((p) => (
                  <tr key={p.id} className="hover:bg-accent">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{p.seat_number ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium">{p.last_name}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{p.first_name}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <TicketBadge ticket={p.ticket_type} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">{fmtLbs(p.weight_lbs)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">{fmtLbs(p.baggage_lbs)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {p.is_crew && <Flag label="CREW" tone="blue" />}
                        {p.is_unaccompanied_minor && <Flag label="UM" tone="yellow" />}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {p.contact_phone ?? p.contact_email ?? "—"}
                    </td>
                    {editable ? (
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <span className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setOpen(p.id)}
                            className="text-xs font-semibold text-foreground/80 hover:text-foreground hover:underline"
                          >
                            Edit
                          </button>
                          <RemoveLine
                            flightId={flightId}
                            kind="pax"
                            lineId={p.id}
                            label={`${p.first_name} ${p.last_name}`}
                          />
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {formOpen ? (
        <PaxForm key={open} flightId={flightId} pax={editing} onClose={() => setOpen(null)} />
      ) : null}
    </section>
  );
}

/** Legacy's add-passenger form, which also edits one. An add stays open
 *  and empties for the next passenger; an edit closes once saved. */
function PaxForm({
  flightId,
  pax,
  onClose,
}: {
  flightId: string;
  pax: ManifestPaxRow | null;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(savePaxAction, _initial);
  const sent = state.status === "error" ? state.values : undefined;
  const value = (key: string, saved: string | null | undefined) => sent?.[key] ?? saved ?? "";
  const checked = (key: string, saved: boolean | undefined) => (sent ? sent[key] === "on" : (saved ?? false));
  const done = state.status === "ok" && pax !== null;
  useEffect(() => {
    if (done) onClose();
  }, [done, onClose]);

  return (
    <form
      key={state.attempt}
      action={formAction}
      aria-label={pax ? `Edit ${pax.first_name} ${pax.last_name}` : "Add passenger"}
      className="mt-3 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <input type="hidden" name="flight_id" value={flightId} />
      <input type="hidden" name="pax_id" value={pax?.id ?? ""} />
      <h3 className="col-span-full text-sm font-semibold">
        {pax ? `Edit ${pax.first_name} ${pax.last_name}` : "Add Passenger"}
      </h3>
      <FormNotice status={state.status} message={state.message} />

      <label className="grid gap-1 text-xs">
        First Name *
        <input name="first_name" required maxLength={80} defaultValue={value("first_name", pax?.first_name)} className={FIELD} />
      </label>
      <label className="grid gap-1 text-xs">
        Last Name *
        <input name="last_name" required maxLength={80} defaultValue={value("last_name", pax?.last_name)} className={FIELD} />
      </label>
      <label className="grid gap-1 text-xs">
        Weight (lbs) *
        <input
          name="weight_lbs"
          type="number"
          required
          min={0}
          step="any"
          defaultValue={value("weight_lbs", pax ? String(Number(pax.weight_lbs)) : "")}
          className={FIELD}
        />
      </label>
      <label className="grid gap-1 text-xs">
        Baggage (lbs)
        <input
          name="baggage_lbs"
          type="number"
          min={0}
          step="any"
          defaultValue={value("baggage_lbs", pax ? String(Number(pax.baggage_lbs)) : "0")}
          className={FIELD}
        />
      </label>
      <label className="grid gap-1 text-xs">
        Seat
        <input name="seat_number" maxLength={10} placeholder="1A" defaultValue={value("seat_number", pax?.seat_number)} className={FIELD} />
      </label>
      <label className="grid gap-1 text-xs">
        Ticket Type
        <select name="ticket_type" defaultValue={value("ticket_type", pax?.ticket_type ?? "revenue")} className={FIELD}>
          {TICKET_TYPES.map((t) => (
            <option key={t} value={t}>
              {TICKET_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs">
        Phone
        <input name="contact_phone" type="tel" maxLength={32} defaultValue={value("contact_phone", pax?.contact_phone)} className={FIELD} />
      </label>
      <label className="grid gap-1 text-xs">
        Email
        <input name="contact_email" type="email" maxLength={160} defaultValue={value("contact_email", pax?.contact_email)} className={FIELD} />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="is_crew" defaultChecked={checked("is_crew", pax?.is_crew)} className="accent-primary" />
        Crew member
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="is_unaccompanied_minor"
          defaultChecked={checked("is_unaccompanied_minor", pax?.is_unaccompanied_minor)}
          className="accent-primary"
        />
        Unaccompanied minor
      </label>
      <label className="col-span-full grid gap-1 text-xs">
        Notes
        <input
          name="notes"
          maxLength={2000}
          placeholder="Special requests, dietary, accessibility"
          defaultValue={value("notes", pax?.notes)}
          className={FIELD}
        />
      </label>
      <div className="col-span-full flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
          {pax ? "Cancel" : "Close"}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : pax ? "Save Passenger" : "Add Passenger"}
        </button>
      </div>
    </form>
  );
}
