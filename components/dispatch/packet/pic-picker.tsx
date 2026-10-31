"use client";

import { SpinnerGlyph } from "@/components/ff/glyphs";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  assignCrewAction,
  unassignCrewAction,
} from "@/app/(app)/dispatch/crew-actions";

import type { CrewOption } from "@/lib/api/ops";
import type { CurrencyStatus, UserRef } from "@/lib/api/types";

import { NotAvailableList, unavailableIds } from "./not-available";
import type { SeatTypeWarning } from "./type-warnings";
import { useDispatchQuery } from "./use-dispatch-query";

/**
 * Spec 5 / M2-G-5 — PIC dropdown on the dispatch packet's Flight
 * Details section. Replaces the freeform PIC text input.
 *
 * The parent (server component) loads the pilot roster + per-pilot
 * overall status from the compliance board endpoint and passes them
 * in. Each option renders as:
 *
 *   [●] Sarah Kessler — Fully current
 *   [●] Bob Henderson — Grace month
 *   [●] Alice Chen — NON-CURRENT
 *
 * Dot color follows the same green / yellow / red mapping as the
 * compliance grid so the dispatcher can pre-screen without opening
 * the pilot profile.
 *
 * Selection does two things. It sets `?pic=<uuid>`, which the
 * DispatchComplianceGate downstream reads, and — when a flight is
 * loaded — it writes a real PIC assignment
 * (flight_crew_assignments, flightops-services#171).
 *
 * Before that table existed this only did the first half, so the
 * dispatcher picked a pilot, read their currency, released the flight,
 * and the choice left with the URL. The pilot's own "My Flights today"
 * never heard about it.
 *
 * This is the only PIC control on the packet, which is deliberate:
 * legacy's form.html calls its equivalent the "SINGLE CONSOLIDATED
 * PILOT FIELD ... only way to pick a pilot", and two pickers on one
 * page is precisely the confusion it was warning about. The Crew panel
 * below shows the resulting roster and owns SIC + cabin crew.
 *
 * Empty option clears the param AND stands the pilot down.
 *
 * The status dot next to the label reflects the currently-selected
 * pilot so the dispatcher's eye lands on it immediately when the
 * page re-renders (compliance gate below shows the full detail).
 */

export interface PicOption {
  pilot: UserRef;
  status: CurrencyStatus;
  /** What is wrong with this pilot in each seat on the flight's
   *  aircraft type (#46), where the company enforces it. */
  typeWarning?: SeatTypeWarning | null;
}

// The GOM's five currency levels (#66): Green normal, Gold aware, Red
// alert, Magenta critical, Grey for nothing on record.
const STATUS_TO_DOT: Record<CurrencyStatus, "green" | "gold" | "red" | "magenta" | "gray"> = {
  not_started: "gray",
  upcoming: "green",
  early_month: "green",
  due_this_month: "gold",
  grace_month: "red",
  non_current: "magenta",
};

const DOT_CLASS = {
  green: "bg-status-green",
  gold: "bg-status-gold",
  red: "bg-status-red",
  magenta: "bg-status-magenta",
  gray: "bg-status-gray",
} as const;

const STATUS_LABEL: Record<CurrencyStatus, string> = {
  not_started: "Not started",
  upcoming: "Upcoming",
  early_month: "Fully current",
  due_this_month: "Due this month",
  grace_month: "Grace month",
  non_current: "NON-CURRENT",
};

export function PicPicker({
  options: roster,
  currentPicId,
  flightId,
  availability,
  locked = false,
}: {
  options: PicOption[];
  currentPicId: string | null;
  /** Null when the dispatcher is filling the packet by hand rather than
   *  loading a scheduled flight. There is nothing to assign crew to, so
   *  the picker falls back to its URL-only pre-screen behaviour. */
  flightId?: string | null;
  /** Who release would take as PIC on this flight (#91). A pilot it
   *  would refuse isn't offered; the current PIC stays shown. */
  availability?: CrewOption[] | null;
  /** The flight is released (#155): the crew stays as released until the
   *  release is pulled back. */
  locked?: boolean;
}) {
  const out = unavailableIds(availability);
  const options = roster.filter((o) => !out.has(o.pilot.id) || o.pilot.id === currentPicId);
  const router = useRouter();
  const nextQuery = useDispatchQuery();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The pick shows at once and the box stays usable while it is saved
  // (#155, the client's item 69: it "sat on a loading spinner and
  // couldn't be selected").
  const [chosen, setChosen] = useState<string | null>(null);
  const shownId = chosen ?? currentPicId;

  const selected = options.find((o) => o.pilot.id === shownId) ?? null;
  const selectedDot = selected ? STATUS_TO_DOT[selected.status] : null;

  function onChange(next: string) {
    setError(null);
    setChosen(next);
    startTransition(async () => {
      if (flightId) {
        // Persist first. If the assignment is refused, the URL should
        // not move either, or the compliance gate would start describing
        // a pilot who is not on the flight. Picking a different pilot
        // means "this one instead": the old PIC is stood down in the
        // same step (#109), where the dispatcher used to have to clear
        // the picker first.
        const result =
          next === ""
            ? await unassignCrewAction(flightId, currentPicId ?? "")
            : await assignCrewAction(flightId, next, "pic", { replace: true });
        if (!result.ok) {
          setError(result.error);
          setChosen(null);
          return;
        }
      }
      // Built after the assignment returns, on the newest URL, so an
      // acknowledgment ticked meanwhile is kept. Replaced without
      // scrolling, like the packet's other URL state: a push scrolled
      // the dispatcher back to the top of the page (#70).
      const qs = nextQuery((params) => {
        if (next === "") params.delete("pic");
        else params.set("pic", next);
      });
      router.replace(qs ? `/dispatch/?${qs}` : "/dispatch/", { scroll: false });
    });
  }

  return (
    // min-w-0 so the picker respects its grid column width — without
    // it long option text (e.g. "● Alice Chen — NON-CURRENT") can
    // stretch the cell wider than its 1fr allotment and push the
    // neighbouring cell offscreen.
    <div className="min-w-0">
      <label
        htmlFor="pic-picker"
        className="mb-1.5 flex items-baseline gap-1.5 whitespace-nowrap text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        <span>PIC</span>
        {selectedDot && (
          // Decorative: the selected option already reads "Name — status",
          // and an aria-label on a plain span is not allowed.
          <span
            aria-hidden
            className={
              "inline-block h-2 w-2 shrink-0 " +
              DOT_CLASS[selectedDot]
            }
          />
        )}
        {pending && (
          <SpinnerGlyph className="ml-1 h-3 w-3 animate-spin" aria-hidden />
        )}
      </label>
      {locked ? (
        <p className="ff-input flex items-center justify-between gap-2">
          <span>{selected?.pilot.full_name ?? "—"}</span>
          <span className="text-[0.65rem] font-normal text-muted-foreground">released</span>
        </p>
      ) : (
      <select
        id="pic-picker"
        name="pic"
        aria-label="Pilot in Command"
        value={shownId ?? ""}
        disabled={options.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="ff-input"
      >
        <option value="">
          {options.length === 0
            ? roster.length > 0
              ? "No pilot available"
              : "No pilots on roster"
            : "— Select a pilot —"}
        </option>
        {options.map((opt) => (
          <option key={opt.pilot.id} value={opt.pilot.id}>
            ● {opt.pilot.full_name} — {STATUS_LABEL[opt.status]}
            {opt.typeWarning?.pic ? ` · ${opt.typeWarning.pic}` : ""}
            {out.has(opt.pilot.id) ? " · not available" : ""}
          </option>
        ))}
      </select>
      )}
      {selected?.typeWarning?.pic ? (
        <p className="mt-1.5 text-[0.68rem] text-status-red">
          {selected.pilot.full_name} is {selected.typeWarning.pic}. Release needs a
          supervisor override.
        </p>
      ) : null}
      {availability ? <NotAvailableList seat="PIC" options={availability} /> : null}
      {error ? (
        // The backend names the incumbent — "Ann Pilot is already PIC on
        // PGR900" tells the dispatcher who to stand down. Shown as-is
        // rather than flattened to "couldn't assign".
        <p role="alert" className="mt-1.5 text-[0.68rem] text-status-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Unicode BLACK CIRCLE (U+25CF) is used in the option labels above —
// it ships with every font. The colored 🔴/🟡/🟢 emoji fall back to
// missing-glyph boxes on systems without a color emoji font
// (common on Linux desktops + kiosks). Compliance colour still
// signals through the label-swatched dot rendered above the select
// for the currently-selected pilot, plus the trailing status word
// ("NON-CURRENT" / "Grace month" / "Not started").
