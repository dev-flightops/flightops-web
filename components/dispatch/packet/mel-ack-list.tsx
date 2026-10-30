"use client";

import type { MelItemResponse } from "@/lib/api/types";

import { useSavedAcks } from "./use-saved-acks";

/**
 * Open-MEL acknowledgment checkboxes (Spec 7).
 *
 * Acknowledgment state lives in the URL `?mels_acked=` query param
 * — same pattern as the NOTAM acks. Toggling a checkbox does a
 * router.replace so the back button doesn't fill up with one entry
 * per click. The page server-component reads the same param to
 * decide which checkboxes are checked on next render.
 *
 * Layout: header with "X of Y acknowledged" counter, then one row
 * per open MEL with checkbox + ATA chapter + description + category
 * badge + due-date.
 */
export function MelAckList({
  flightId,
  items,
  ackedMelIds,
}: {
  flightId: string;
  items: MelItemResponse[];
  /** The MELs the viewer acknowledged, as saved (#155). */
  ackedMelIds: string[];
}) {
  const { isOn, change, pending, error } = useSavedAcks(flightId, "mel", new Set(ackedMelIds));
  const ackedCount = items.filter((m) => isOn(m.id)).length;
  const allAcked = ackedCount === items.length;

  function toggle(melId: string, checked: boolean) {
    change([melId], checked, (id) => {
      const mel = items.find((m) => m.id === id);
      return mel ? { ata_chapter: mel.ata_chapter, description: mel.description } : null;
    });
  }

  const borderTone = allAcked
    ? "border-status-green/40 bg-status-green/[0.06]"
    : "border-status-yellow/40 bg-status-yellow/[0.06]";
  const headingTone = allAcked ? "text-status-green" : "text-status-yellow";

  return (
    <div
      className={`rounded-md border px-5 py-4 ${borderTone}`}
      aria-busy={pending}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span
          className={`font-bold uppercase tracking-[0.06em] ${headingTone}`}
        >
          Open MELs — {ackedCount} of {items.length} acknowledged
        </span>
        {!allAcked && (
          <span className="text-[0.7rem] text-muted-foreground">
            Each MEL needs dispatcher acknowledgment before release.
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {items.map((mel) => {
          const isAcked = isOn(mel.id);
          return (
            <li
              key={mel.id}
              className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2"
            >
              <input
                id={`mel-${mel.id}`}
                type="checkbox"
                checked={isAcked}
                onChange={(e) => toggle(mel.id, e.target.checked)}
                className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                aria-label={`Acknowledge MEL ${mel.ata_chapter} — ${mel.description}`}
              />
              <label
                htmlFor={`mel-${mel.id}`}
                className="flex-1 cursor-pointer text-xs"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono font-semibold text-foreground">
                    ATA {mel.ata_chapter}
                  </span>
                  <CategoryBadge category={mel.category} />
                  <span className="text-[0.65rem] text-muted-foreground">
                    Due {formatDate(mel.due_at)}
                  </span>
                </div>
                <div className="mt-1 text-foreground/90">{mel.description}</div>
              </label>
            </li>
          );
        })}
      </ul>
      {pending ? <p className="mt-2 text-[0.65rem] text-muted-foreground">Saving…</p> : null}
      {error ? (
        <p role="alert" className="field-error mt-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  // Cat A = 3 days, B = 10, C = 30, D = 120 — common Part 135
  // categorization. Color-coded so the dispatcher can scan urgency at
  // a glance. Unknown categories fall through to gray.
  const tone =
    category === "A"
      ? "text-status-red"
      : category === "B"
        ? "text-status-orange"
        : category === "C"
          ? "text-status-yellow"
          : category === "D"
            ? "text-status-blue"
            : "text-muted-foreground";
  return <span className={`status-mark ${tone}`}>Cat {category}</span>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}
