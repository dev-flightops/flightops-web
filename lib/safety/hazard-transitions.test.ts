import { describe, expect, it } from "vitest";

import type { HazardStatus } from "@/lib/api/safety";

import {
  NEXT_STATUS_OPTIONS,
  defaultNextStatus,
  isTerminal,
} from "./hazard-transitions";

const ALL: HazardStatus[] = ["submitted", "triaged", "in_progress", "closed"];

/**
 * The backend map, written out by hand.
 *
 * Copied from `_STATUS_TRANSITIONS` in
 * services/safety/app/routes/hazards.py. The backend is the authority —
 * it rejects a disallowed transition with a 400 whatever the UI thinks —
 * so the only failure this file can catch is drift: the UI offering a
 * move the backend will refuse, or hiding one it would accept.
 *
 * If this fails, someone changed one side. Change the other, or decide
 * deliberately that they should differ and say why here.
 */
const BACKEND_TRANSITIONS: Record<HazardStatus, HazardStatus[]> = {
  submitted: ["triaged", "closed"],
  triaged: ["in_progress", "closed"],
  in_progress: ["closed"],
  closed: [],
};

describe("parity with the safety service", () => {
  it("offers exactly the moves the backend accepts", () => {
    for (const from of ALL) {
      expect(
        [...NEXT_STATUS_OPTIONS[from]].sort(),
        `UI and backend disagree on what follows "${from}"`,
      ).toEqual([...BACKEND_TRANSITIONS[from]].sort());
    }
  });

  it("covers every status the backend knows about", () => {
    expect(Object.keys(NEXT_STATUS_OPTIONS).sort()).toEqual(
      Object.keys(BACKEND_TRANSITIONS).sort(),
    );
  });

  it("never offers a move the backend would reject", () => {
    // Stated separately from the equality check because this is the
    // direction that produces a dead menu item — a dropdown option that
    // always 400s.
    for (const from of ALL) {
      for (const to of NEXT_STATUS_OPTIONS[from]) {
        expect(
          BACKEND_TRANSITIONS[from],
          `UI offers ${from} -> ${to}, backend refuses it`,
        ).toContain(to);
      }
    }
  });
});

describe("the lifecycle", () => {
  it("treats closed as terminal", () => {
    expect(NEXT_STATUS_OPTIONS.closed).toEqual([]);
    expect(isTerminal("closed")).toBe(true);
  });

  it("leaves every other status with somewhere to go", () => {
    for (const from of ALL) {
      if (from === "closed") continue;
      expect(isTerminal(from), `${from} is a dead end`).toBe(false);
    }
  });

  it("can reach closed from every open status", () => {
    // A hazard that cannot be closed sits on the board forever.
    for (const from of ALL) {
      if (isTerminal(from)) continue;
      expect(
        NEXT_STATUS_OPTIONS[from],
        `${from} cannot be closed`,
      ).toContain("closed");
    }
  });

  it("never walks a hazard back to submitted", () => {
    for (const from of ALL) {
      expect(
        NEXT_STATUS_OPTIONS[from],
        `${from} offers a route back to submitted`,
      ).not.toContain("submitted");
    }
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
});

describe("the panel's opening state", () => {
  it("points at triage from a fresh submission", () => {
    expect(defaultNextStatus("submitted")).toBe("triaged");
  });

  it("falls back to the current status on a closed hazard", () => {
    // The panel renders nothing here, but the default still has to be a
    // real status rather than undefined.
    expect(defaultNextStatus("closed")).toBe("closed");
  });

  it("always defaults to something the hazard can actually move to", () => {
    for (const from of ALL) {
      if (isTerminal(from)) continue;
      expect(NEXT_STATUS_OPTIONS[from]).toContain(defaultNextStatus(from));
    }
  });
});
