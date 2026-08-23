"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import {
  assignCrewAction,
  unassignCrewAction,
} from "@/app/(app)/dispatch/crew-actions";

import type { CurrencyStatus, UserRef } from "@/lib/api/types";

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
}

const STATUS_TO_DOT: Record<CurrencyStatus, "green" | "yellow" | "red"> = {
  not_started: "yellow",
  upcoming: "green",
  early_month: "green",
  due_this_month: "yellow",
  grace_month: "yellow",
  non_current: "red",
};

const STATUS_LABEL: Record<CurrencyStatus, string> = {
  not_started: "Not started",
  upcoming: "Upcoming",
  early_month: "Fully current",
  due_this_month: "Due this month",
  grace_month: "Grace month",
  non_current: "NON-CURRENT",
};

export function PicPicker({
  options,
  currentPicId,
  flightId,
}: {
  options: PicOption[];
  currentPicId: string | null;
  /** Null when the dispatcher is filling the packet by hand rather than
   *  loading a scheduled flight. There is nothing to assign crew to, so
   *  the picker falls back to its URL-only pre-screen behaviour. */
  flightId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selected = options.find((o) => o.pilot.id === currentPicId) ?? null;
  const selectedDot = selected ? STATUS_TO_DOT[selected.status] : null;

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "") {
      params.delete("pic");
    } else {
      params.set("pic", next);
    }
    const qs = params.toString();
    setError(null);
    startTransition(async () => {
      if (flightId) {
        // Persist first. If the assignment is refused — someone else is
        // already PIC — the URL should not move either, or the
        // compliance gate would start describing a pilot who is not on
        // the flight.
        const result =
          next === ""
            ? await unassignCrewAction(flightId, currentPicId ?? "")
            : await assignCrewAction(flightId, next, "pic");
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }
      router.push(qs ? `/dispatch/?${qs}` : "/dispatch/");
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
          <span
            aria-label={`PIC compliance ${selectedDot}`}
            className={
              "inline-block h-2 w-2 shrink-0 rounded-full " +
              (selectedDot === "green"
                ? "bg-status-green"
                : selectedDot === "yellow"
                  ? "bg-status-yellow"
                  : "bg-status-red")
            }
          />
        )}
        {pending && (
          <Loader2 className="ml-1 h-3 w-3 animate-spin" aria-hidden />
        )}
      </label>
      <select
        id="pic-picker"
        name="pic"
        aria-label="Pilot in Command"
        value={currentPicId ?? ""}
        disabled={pending || options.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="ff-input"
      >
        <option value="">
          {options.length === 0
            ? "No pilots on roster"
            : "— Select a pilot —"}
        </option>
        {options.map((opt) => (
          <option key={opt.pilot.id} value={opt.pilot.id}>
            ● {opt.pilot.full_name} — {STATUS_LABEL[opt.status]}
          </option>
        ))}
      </select>
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
