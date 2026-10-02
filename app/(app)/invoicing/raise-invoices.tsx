"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { money } from "./money";
import type { FlownFlightOption, RaiseState } from "./raise";
import { raiseInvoicesAction, recentFlownFlightsAction } from "./raise-actions";

/**
 * "Raise invoices" on /invoicing: pick a flown flight, raise its draft
 * invoices, and see what was created and what was not.
 *
 * Legacy raised invoices only when a flight's arrival was recorded
 * (flight_following/router.py:1697-1708; #26 brings that back here), and
 * its list page linked to an /invoicing/new that had no route. Raising
 * by hand is safe to repeat: a customer already invoiced for the flight
 * is skipped, with the invoice named.
 *
 * Renders as two items of the page header: the button, and when open a
 * full-width panel that wraps onto its own row below the header line.
 * The flights load when the panel opens, not with the page: the list is
 * read far more often than invoices are raised.
 */
export function RaiseInvoices() {
  const [open, setOpen] = useState(false);
  const [flights, setFlights] = useState<FlownFlightOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flightId, setFlightId] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RaiseState>({ status: "idle" });
  const panelId = useId();
  const headingId = useId();

  async function openPanel() {
    setOpen(true);
    setResult({ status: "idle" });
    setLoadError(null);
    setFlights(null);
    setFlightId("");
    const loaded = await recentFlownFlightsAction();
    if (loaded.status === "ok") setFlights(loaded.flights);
    else setLoadError(loaded.message);
  }

  async function raise() {
    setPending(true);
    setResult({ status: "idle" });
    setResult(await raiseInvoicesAction(flightId));
    setPending(false);
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? setOpen(false) : void openPanel())}
        className="ml-auto self-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
      >
        Raise invoices
      </button>

      {open && (
        <section
          id={panelId}
          aria-labelledby={headingId}
          className="order-last basis-full rounded-lg border border-border bg-card p-4"
        >
          <h2
            id={headingId}
            className="text-sm font-semibold text-foreground"
          >
            Raise invoices for a flown flight
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One draft invoice for each customer booked on the flight. A
            customer already invoiced for it is skipped.
          </p>

          {loadError ? (
            <p
              role="alert"
              className="mt-3 rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red"
            >
              {loadError}
            </p>
          ) : flights === null ? (
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              Loading flown flights…
            </p>
          ) : flights.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No flown flights yet. A flight counts as flown once its
              arrival is recorded.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="block min-w-[16rem] flex-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Flown flight
                <select
                  value={flightId}
                  onChange={(e) => {
                    setFlightId(e.target.value);
                    setResult({ status: "idle" });
                  }}
                  className="ff-input mt-1 font-normal normal-case tracking-normal"
                >
                  <option value="">Choose a flight…</option>
                  {flights.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void raise()}
                disabled={!flightId || pending}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {pending ? "Raising…" : "Raise"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-1 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          )}

          <div aria-live="polite">
            {result.status === "error" && (
              <p
                role="alert"
                className="mt-3 rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {result.message}
              </p>
            )}
            {result.status === "ok" && <RaiseOutcome result={result} />}
          </div>
        </section>
      )}
    </>
  );
}

function RaiseOutcome({
  result,
}: {
  result: Extract<RaiseState, { status: "ok" }>;
}) {
  const { created, skipped, notes } = result;
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div>
        <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {created.length === 0
            ? "No new invoices"
            : `Created ${created.length} draft invoice${created.length === 1 ? "" : "s"}`}
        </h3>
        {created.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {created.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  href={`/invoicing/${inv.id}`}
                  className="font-mono font-semibold text-primary hover:underline"
                >
                  {inv.invoiceNumber}
                </Link>
                <span className="text-foreground">{inv.customer}</span>
                <span className="tabular-nums text-muted-foreground">
                  {money(inv.totalCents)}
                </span>
                {inv.hasUnpricedLines && (
                  <span className="rounded bg-status-yellow/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase text-status-yellow">
                    needs pricing
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {skipped.length > 0 && (
        <div>
          <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Not invoiced
          </h3>
          <ul className="mt-1 space-y-0.5">
            {skipped.map((s, i) => (
              <li key={i} className="text-foreground">
                {s.customer}
                <span className="text-muted-foreground"> — {s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
