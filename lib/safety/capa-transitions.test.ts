import { describe, expect, it } from "vitest";

import type { CapaStatus } from "@/lib/api/safety";

import {
  NEXT_STATUS_OPTIONS,
  defaultNextStatus,
  isTerminal,
  requiresClosureReason,
} from "./capa-transitions";

const ALL: CapaStatus[] = ["open", "in_progress", "closed"];

/**
 * Closure is the leg of the SMS chain an auditor asks about, so most of
 * these assert what the lifecycle will NOT allow.
 */

describe("the lifecycle", () => {
  it("lets an open finding go to work or straight to closed", () => {
    expect(NEXT_STATUS_OPTIONS.open).toEqual(["in_progress", "closed"]);
  });

  it("never walks a finding backwards", () => {
    // Reopening is a new finding, not a status flip. If "open" ever
    // appears as a destination, someone can undo progress silently.
    for (const from of ALL) {
      expect(
        NEXT_STATUS_OPTIONS[from],
        `${from} offers a route back to open`,
      ).not.toContain("open");
    }
  });

  it("treats closed as terminal", () => {
    expect(NEXT_STATUS_OPTIONS.closed).toEqual([]);
    expect(isTerminal("closed")).toBe(true);
    expect(isTerminal("open")).toBe(false);
    expect(isTerminal("in_progress")).toBe(false);
  });

  it("never offers a status as a move to itself", () => {
    for (const from of ALL) {
      expect(NEXT_STATUS_OPTIONS[from], `${from} -> ${from}`).not.toContain(
        from,
      );
    }
  });

  it("only ever names real statuses", () => {
    for (const from of ALL) {
      for (const to of NEXT_STATUS_OPTIONS[from]) {
        expect(ALL, `${from} -> ${to}`).toContain(to);
      }
    }
  });

  it("can reach closed from every non-terminal status", () => {
    // Every open finding needs a way to be finished, or it sits on the
    // board forever.
    for (const from of ALL) {
      if (isTerminal(from)) continue;
      expect(NEXT_STATUS_OPTIONS[from], `${from} cannot be closed`).toContain(
        "closed",
      );
    }
  });
});

describe("closure requires a reason", () => {
  it("demands one for closure and nothing else", () => {
    expect(requiresClosureReason("closed")).toBe(true);
    expect(requiresClosureReason("open")).toBe(false);
    expect(requiresClosureReason("in_progress")).toBe(false);
  });

  it("covers every route that ends in closed", () => {
    // Stated as a property: whichever status you come from, arriving at
    // closed carries the reason requirement. This is the assertion that
    // should fail if the reason is ever made optional.
    for (const from of ALL) {
      for (const to of NEXT_STATUS_OPTIONS[from]) {
        if (to === "closed") {
          expect(
            requiresClosureReason(to),
            `${from} -> closed without a reason`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("the panel's opening state", () => {
  it("points at the first available move", () => {
    expect(defaultNextStatus("open")).toBe("in_progress");
  });

  it("opens already pointed at closure when that is the only move", () => {
    // From in_progress the sole option is closed, so the reason box has
    // to be present on first render rather than only after an onChange.
    expect(defaultNextStatus("in_progress")).toBe("closed");
    expect(requiresClosureReason(defaultNextStatus("in_progress"))).toBe(true);
  });

  it("falls back to the current status on a terminal finding", () => {
    // The panel renders nothing in this case, but the default still has
    // to be a real status rather than undefined.
    expect(defaultNextStatus("closed")).toBe("closed");
  });

  it("always defaults to something the finding can actually move to", () => {
    for (const from of ALL) {
      if (isTerminal(from)) continue;
      expect(NEXT_STATUS_OPTIONS[from]).toContain(defaultNextStatus(from));
    }
  });
});
