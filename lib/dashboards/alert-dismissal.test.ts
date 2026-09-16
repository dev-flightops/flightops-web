import { describe, expect, it } from "vitest";

import {
  applyDismissals,
  isDismissed,
  type DismissableAlert,
  type DismissalLike,
} from "./alert-dismissal";

/**
 * The dismissal filter.
 *
 * One rule, and it is the whole reason this file exists rather than a
 * `Set` of keys: a dismissal covers an *occurrence*, not an id. Alert
 * ids are stable per underlying record, which is what makes them
 * dismissable and also a trap — ground an aircraft, dismiss, return it
 * to service, ground it again, and the id is identical.
 */

function alert(over: Partial<DismissableAlert> = {}): DismissableAlert {
  return {
    id: "grounded-abc",
    occurredAt: "2026-09-10T08:00:00Z",
    ...over,
  };
}

function acks(...entries: [string, string][]): Map<string, DismissalLike> {
  return new Map(
    entries.map(([key, occurrence]) => [
      key,
      { occurrence_at: occurrence },
    ]),
  );
}

describe("isDismissed", () => {
  it("is false when nothing was dismissed", () => {
    expect(isDismissed(alert(), acks())).toBe(false);
  });

  it("is false when a different alert was dismissed", () => {
    expect(
      isDismissed(alert(), acks(["overdue-xyz", "2026-09-10T08:00:00Z"])),
    ).toBe(false);
  });

  it("is true for the occurrence that was dismissed", () => {
    expect(
      isDismissed(alert(), acks(["grounded-abc", "2026-09-10T08:00:00Z"])),
    ).toBe(true);
  });

  it("is true when the dismissal is newer than the occurrence", () => {
    // Can happen when an alert's onset is re-read slightly earlier
    // than the one the client sent. Dismissed is dismissed.
    expect(
      isDismissed(alert(), acks(["grounded-abc", "2026-09-12T08:00:00Z"])),
    ).toBe(true);
  });

  it("is FALSE for a fresh occurrence of the same alert", () => {
    // The case the whole design turns on. Ground, dismiss, return to
    // service, ground again: identical id, later onset, and the alert
    // must come back.
    const regrounded = alert({ occurredAt: "2026-09-14T06:00:00Z" });
    expect(
      isDismissed(regrounded, acks(["grounded-abc", "2026-09-10T08:00:00Z"])),
    ).toBe(false);
  });

  it("does not care about the severity or the copy", () => {
    // Matching is on key and time only. A detail string that changes
    // as a countdown ticks down — "4h remaining" — must not resurrect
    // a dismissed MEL.
    const later = alert({ id: "mel-soon-1" });
    expect(
      isDismissed(later, acks(["mel-soon-1", "2026-09-10T08:00:00Z"])),
    ).toBe(true);
  });
});


describe("applyDismissals", () => {
  const grounded = alert({ id: "grounded-abc" });
  const overdue = alert({ id: "overdue-xyz" });

  it("hides what was dismissed and counts it", () => {
    const out = applyDismissals(
      [grounded, overdue],
      acks(["grounded-abc", "2026-09-10T08:00:00Z"]),
    );
    expect(out.alerts.map((a) => a.id)).toEqual(["overdue-xyz"]);
    expect(out.dismissedCount).toBe(1);
    expect(out.filterUnavailable).toBe(false);
  });

  it("shows EVERY alert when the dismissal list cannot be read", () => {
    // The direction matters. Failing towards "you have things to look
    // at" costs a dismissed alert reappearing; failing the other way
    // shows a clear bell while an aircraft is grounded.
    //
    // A mutation that returned an empty list here passed every test in
    // the repo, which is why this behaviour is a tested function
    // rather than a comment in a fetch wrapper.
    const out = applyDismissals([grounded, overdue], null);
    expect(out.alerts).toHaveLength(2);
    expect(out.filterUnavailable).toBe(true);
  });

  it("reports nothing dismissed when the filter is unavailable", () => {
    // Not "0 of 2 hidden" — we do not know how many would have been.
    const out = applyDismissals([grounded, overdue], null);
    expect(out.dismissedCount).toBe(0);
  });

  it("hides nothing when there are no dismissals", () => {
    const out = applyDismissals([grounded, overdue], acks());
    expect(out.alerts).toHaveLength(2);
    expect(out.dismissedCount).toBe(0);
    expect(out.filterUnavailable).toBe(false);
  });

  it("counts a fresh occurrence as outstanding, not dismissed", () => {
    const regrounded = alert({
      id: "grounded-abc",
      occurredAt: "2026-09-14T06:00:00Z",
    });
    const out = applyDismissals(
      [regrounded],
      acks(["grounded-abc", "2026-09-10T08:00:00Z"]),
    );
    expect(out.alerts).toHaveLength(1);
    expect(out.dismissedCount).toBe(0);
  });
});
