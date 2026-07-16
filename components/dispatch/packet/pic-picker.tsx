"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

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
 * Selection persists in the URL as `?pic=<uuid>` (matches the
 * DispatchComplianceGate reader downstream). Empty option clears
 * the param and returns to the "awaiting PIC" placeholder state.
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
}: {
  options: PicOption[];
  currentPicId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

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
    startTransition(() => {
      router.push(qs ? `/dispatch/?${qs}` : "/dispatch/");
    });
  }

  return (
    <div>
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
            {dotChar(STATUS_TO_DOT[opt.status])} {opt.pilot.full_name} —{" "}
            {STATUS_LABEL[opt.status]}
          </option>
        ))}
      </select>
    </div>
  );
}

// Unicode filled circle — plain <option> elements can't hold JSX, so
// the color-coded dot in the list is a text glyph. The visible label
// above the select shows a real color-swatched dot for the current
// selection.
function dotChar(color: "green" | "yellow" | "red"): string {
  return color === "red" ? "🔴" : color === "yellow" ? "🟡" : "🟢";
}
